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
  // ao defaults to fully open so materials work before any bake
  const ao = new Float32Array(vault.mesh.positions.length / 3).fill(1);
  g.setAttribute('ao', new BufferAttribute(ao, 1));
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
