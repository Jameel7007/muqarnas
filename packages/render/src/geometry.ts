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

  // pass one: hues, facet frames, and each cell's apex (its roof's peak)
  const apex = new Map<number, [number, number, number]>();
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
        // horizontal tangent of the facet plane: up × normal — with a
        // canonical sign, or back-to-back facet pairs (whose normals
        // oppose) would mirror the stencil mid-figure and shear it
        const nx = nrm.getX(i);
        const ny = nrm.getY(i);
        const len = Math.hypot(nx, ny) || 1;
        let tx = -ny / len;
        let ty = nx / len;
        if (tx * 0.9848 + ty * 0.1736 < 0) {
          tx = -tx;
          ty = -ty;
        }
        orn[i * 3] = pos.getX(i) * tx + pos.getY(i) * ty;
        orn[i * 3 + 1] = pos.getZ(i);
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
