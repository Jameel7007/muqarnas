import { BufferAttribute, BufferGeometry, Mesh, type Material } from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CurvedVault } from '@muqarnas/lift';

/**
 * Lift output → three geometry. The lift's mesh is already welded by exact
 * keys, so the indexed geometry preserves that topology; smooth vertex
 * normals on it are what the AO bake wants for ray directions. The display
 * geometry then un-welds and re-creases: smooth across the profile's arc,
 * hard at ridges, facet tops, and wall seams — plaster reads as carved, not
 * inflated.
 */

export function vaultToGeometry(vault: CurvedVault): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(vault.mesh.positions), 3));
  // the lift orients windings toward the solid; the seen surface — the
  // intrados, the air the viewer stands in — is the other side, so flip
  const flipped: number[] = new Array(vault.mesh.triangles.length);
  for (let t = 0; t < vault.mesh.triangles.length; t += 3) {
    flipped[t] = vault.mesh.triangles[t]!;
    flipped[t + 1] = vault.mesh.triangles[t + 2]!;
    flipped[t + 2] = vault.mesh.triangles[t + 1]!;
  }
  g.setIndex(flipped);
  // ao defaults to fully open, paint/ornament/gilt to bare plaster, so
  // materials work before any bake or glaze pass
  const vcount = vault.mesh.positions.length / 3;
  g.setAttribute('ao', new BufferAttribute(new Float32Array(vcount).fill(1), 1));
  g.setAttribute('paint', new BufferAttribute(new Float32Array(vcount), 1));
  g.setAttribute('orn', new BufferAttribute(new Float32Array(vcount * 3), 3));
  g.setAttribute('glow', new BufferAttribute(new Float32Array(vcount), 1));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/** Non-indexed, creased-normal copy for display; carries the ao attribute. */
export function toDisplayGeometry(welded: BufferGeometry, creaseAngleDeg = 32): BufferGeometry {
  const nonIndexed = welded.toNonIndexed();
  const creased = toCreasedNormals(nonIndexed, (creaseAngleDeg * Math.PI) / 180);
  creased.computeBoundingSphere();
  return creased;
}

/** A shadow-casting vault mesh, ready for the stage. */
export function makeVaultMesh(geometry: BufferGeometry, material: Material): Mesh {
  const mesh = new Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Give any geometry the `ao`/`paint`/`orn`/`glow` attributes the plaster expects. */
export function withAoAttribute(geometry: BufferGeometry): BufferGeometry {
  const count = geometry.getAttribute('position').count;
  if (!geometry.getAttribute('ao')) {
    geometry.setAttribute('ao', new BufferAttribute(new Float32Array(count).fill(1), 1));
  }
  if (!geometry.getAttribute('paint')) {
    geometry.setAttribute('paint', new BufferAttribute(new Float32Array(count), 1));
  }
  if (!geometry.getAttribute('orn')) {
    geometry.setAttribute('orn', new BufferAttribute(new Float32Array(count * 3), 3));
  }
  if (!geometry.getAttribute('glow')) {
    geometry.setAttribute('glow', new BufferAttribute(new Float32Array(count), 1));
  }
  return geometry;
}

/**
 * The paint map: Takht-i Sulaymān's cells wore fired colour on their
 * curved canopy, painted ornament on the plaster, and gilt. From the
 * lift's own data (non-indexed display geometry, three corners per lifted
 * triangle, in the lift's order — the rig's convention) this emits:
 *
 *   paint — 1 turquoise / 2 cobalt on roof corners, alternating by cell
 *           (the tilework mixed its blues); 0 bare plaster.
 *   orn   — facet-local coordinates for the painted stencil: (u along the
 *           facet's horizontal tangent, v = height, flag 1 on facets).
 *           The pattern is periodic, so a facet cropping it mid-figure
 *           reads as a panel edge — as painted panels really do.
 *   glow  — gilt: each cell's bowl warms toward gold near its apex, the
 *           highest point of that cell's roof.
 */
export function withPaintAttribute(
  displayGeometry: BufferGeometry,
  tris: readonly { role: 'facet' | 'roof' | 'wall'; cell?: number }[],
): BufferGeometry {
  const count = displayGeometry.getAttribute('position').count;
  if (count !== tris.length * 3) {
    throw new Error(`paint: display geometry (${count} corners) does not match ${tris.length} triangles`);
  }
  const pos = displayGeometry.getAttribute('position');
  const nrm = displayGeometry.getAttribute('normal');
  const paint = new Float32Array(count);
  const orn = new Float32Array(count * 3);
  const glow = new Float32Array(count);

  // pass one: hues, facet panels, and each cell's apex (its roof's peak).
  // A PANEL is a fact the lift already knows: one cell, one facing — no
  // mesh connectivity involved. (An earlier connectivity grouping let
  // coplanar facets of NEIGHBOURING cells chain through shared wall-line
  // vertices into one long band with a single centred star: shards at the
  // ends, the design review's "still a lot of bugs".) Coincident
  // double-wall panels — two cells' facets on the same rectangle — are
  // unified afterwards by rect identity, so both sides carry one frame
  // and the depth-fight stays invisible.
  const apex = new Map<number, [number, number, number]>();
  const cornerU = new Float32Array(count);
  interface FacetField {
    corners: number[];
    nk: string;
    sumNx: number;
    sumNy: number;
  }
  const fields = new Map<string, FacetField>();

  for (let t = 0; t < tris.length; t++) {
    const role = tris[t]!.role;
    const cell = tris[t]!.cell ?? 0;
    if (role === 'roof') {
      const hue = cell % 3 === 1 ? 2 : 1;
      for (let c = 0; c < 3; c++) {
        const i = t * 3 + c;
        paint[i] = hue;
        const z = pos.getZ(i);
        const best = apex.get(cell);
        if (!best || z > best[2]) apex.set(cell, [pos.getX(i), pos.getY(i), z]);
      }
    } else if (role === 'facet') {
      for (let c = 0; c < 3; c++) {
        const i = t * 3 + c;
        // fold the normal to a canonical half-plane, so both sides of a
        // double wall land in the same field
        let nx = nrm.getX(i);
        let ny = nrm.getY(i);
        const len = Math.hypot(nx, ny) || 1;
        nx /= len;
        ny /= len;
        if (nx * 0.9848 + ny * 0.1736 < 0) {
          nx = -nx;
          ny = -ny;
        }
        const nk = `${Math.round(nx * 8)},${Math.round(ny * 8)}`;
        const key = `${cell}|${nk}`;
        let f = fields.get(key);
        if (!f) {
          f = { corners: [], nk, sumNx: 0, sumNy: 0 };
          fields.set(key, f);
        }
        f.corners.push(i);
        f.sumNx += nx;
        f.sumNy += ny;
      }
    }
  }

  // unify coincident panels into components. Coincidence is decided by
  // SHARED EXACT VERTICES, not by rectangle identity: a wide panel (a
  // half-square's collinear double facet) can be backed by TWO smaller
  // panels from two different neighbouring cells — different rectangles,
  // same wall — and every such stack must paint identically, or the
  // depth-fight stitches one big star against two small ones. Coincident
  // panels share a whole rectangle (three or more bit-exact corners);
  // merely adjacent panels share one edge (two). Same facing plus ≥3
  // shared vertices → one component, one union frame. The frame's tangent
  // comes from the component's AVERAGED facing, never per corner: the
  // jug's facet quad is genuinely warped (its triangles' normals sit ~3°
  // apart), and per-corner tangents sheared its star.
  const fieldList = [...fields.values()];
  const fparent = fieldList.map((_, i) => i);
  const ffind = (a: number): number => {
    let r = a;
    while (fparent[r] !== r) r = fparent[r]!;
    while (fparent[a] !== r) {
      const next = fparent[a]!;
      fparent[a] = r;
      a = next;
    }
    return r;
  };
  const posOwners = new Map<string, number[]>();
  fieldList.forEach((f, fi) => {
    const seen = new Set<string>();
    for (const i of f.corners) {
      const k = `${f.nk}|${pos.getX(i)},${pos.getY(i)},${pos.getZ(i)}`;
      if (seen.has(k)) continue;
      seen.add(k);
      let owners = posOwners.get(k);
      if (!owners) {
        owners = [];
        posOwners.set(k, owners);
      }
      owners.push(fi);
    }
  });
  const sharedCount = new Map<string, number>();
  for (const owners of posOwners.values()) {
    for (let a = 0; a < owners.length; a++) {
      for (let b = a + 1; b < owners.length; b++) {
        const pk = `${Math.min(owners[a]!, owners[b]!)}-${Math.max(owners[a]!, owners[b]!)}`;
        const n = (sharedCount.get(pk) ?? 0) + 1;
        sharedCount.set(pk, n);
        if (n >= 3) fparent[ffind(owners[a]!)] = ffind(owners[b]!);
      }
    }
  }
  const components = new Map<number, { members: number[]; sumNx: number; sumNy: number }>();
  fieldList.forEach((f, fi) => {
    const root = ffind(fi);
    let comp = components.get(root);
    if (!comp) {
      comp = { members: [], sumNx: 0, sumNy: 0 };
      components.set(root, comp);
    }
    comp.members.push(fi);
    comp.sumNx += f.sumNx;
    comp.sumNy += f.sumNy;
  });
  for (const comp of components.values()) {
    const nlen = Math.hypot(comp.sumNx, comp.sumNy) || 1;
    const nx = comp.sumNx / nlen;
    const ny = comp.sumNy / nlen;
    let uMin = Infinity;
    let uMax = -Infinity;
    let vMin = Infinity;
    let vMax = -Infinity;
    for (const fi of comp.members) {
      for (const i of fieldList[fi]!.corners) {
        const u = pos.getX(i) * -ny + pos.getY(i) * nx;
        cornerU[i] = u;
        uMin = Math.min(uMin, u);
        uMax = Math.max(uMax, u);
        vMin = Math.min(vMin, pos.getZ(i));
        vMax = Math.max(vMax, pos.getZ(i));
      }
    }
    // a medallion needs a real panel: degenerate fields — sliver strips of
    // transition geometry with near-zero extent — stay bare plaster, or
    // their blown-up frames depth-fight garbage over the true panels
    if (uMax - uMin < 0.12 || vMax - vMin < 0.12) continue;
    const uc = (uMin + uMax) / 2;
    const vc = (vMin + vMax) / 2;
    const r = Math.min((uMax - uMin) / 2, (vMax - vMin) / 2);
    for (const fi of comp.members) {
      for (const i of fieldList[fi]!.corners) {
        orn[i * 3] = (cornerU[i]! - uc) / r;
        orn[i * 3 + 1] = (pos.getZ(i) - vc) / r;
        orn[i * 3 + 2] = 1;
      }
    }
  }

  // pass two: the gilt falloff around each apex
  for (let t = 0; t < tris.length; t++) {
    if (tris[t]!.role !== 'roof') continue;
    const a = apex.get(tris[t]!.cell ?? 0);
    if (!a) continue;
    for (let c = 0; c < 3; c++) {
      const i = t * 3 + c;
      const d = Math.hypot(pos.getX(i) - a[0], pos.getY(i) - a[1], pos.getZ(i) - a[2]);
      const g = Math.max(0, 1 - d / 0.9);
      glow[i] = g * g;
    }
  }

  displayGeometry.setAttribute('paint', new BufferAttribute(paint, 1));
  displayGeometry.setAttribute('orn', new BufferAttribute(orn, 3));
  displayGeometry.setAttribute('glow', new BufferAttribute(glow, 1));
  return displayGeometry;
}
