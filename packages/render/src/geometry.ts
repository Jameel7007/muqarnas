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
  // ao defaults to fully open, paint to bare plaster, so materials work
  // before any bake or glaze pass
  const ao = new Float32Array(vault.mesh.positions.length / 3).fill(1);
  g.setAttribute('ao', new BufferAttribute(ao, 1));
  g.setAttribute('paint', new BufferAttribute(new Float32Array(vault.mesh.positions.length / 3), 1));
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

/** Give any geometry the `ao`/`paint` attributes the plaster expects. */
export function withAoAttribute(geometry: BufferGeometry): BufferGeometry {
  const count = geometry.getAttribute('position').count;
  if (!geometry.getAttribute('ao')) {
    geometry.setAttribute('ao', new BufferAttribute(new Float32Array(count).fill(1), 1));
  }
  if (!geometry.getAttribute('paint')) {
    geometry.setAttribute('paint', new BufferAttribute(new Float32Array(count), 1));
  }
  return geometry;
}

/**
 * The glaze map: Takht-i Sulaymān's cells wore fired colour on their curved
 * canopy. Mark every roof corner of the display geometry (non-indexed,
 * three corners per lifted triangle, in the lift's order — the same
 * convention the rig depends on) so the plaster can carry its wash.
 */
export function withPaintAttribute(
  displayGeometry: BufferGeometry,
  tris: readonly { role: 'facet' | 'roof' | 'wall' }[],
): BufferGeometry {
  const count = displayGeometry.getAttribute('position').count;
  if (count !== tris.length * 3) {
    throw new Error(`paint: display geometry (${count} corners) does not match ${tris.length} triangles`);
  }
  const paint = new Float32Array(count);
  for (let t = 0; t < tris.length; t++) {
    if (tris[t]!.role === 'roof') {
      paint[t * 3] = 1;
      paint[t * 3 + 1] = 1;
      paint[t * 3 + 2] = 1;
    }
  }
  displayGeometry.setAttribute('paint', new BufferAttribute(paint, 1));
  return displayGeometry;
}
