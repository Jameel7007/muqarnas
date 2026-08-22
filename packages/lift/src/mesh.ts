/**
 * Minimal indexed triangle mesh with key-welded vertices.
 *
 * Welding is by symbolic key, never by float rounding: a vertex key combines
 * the exact plan point (Pt.key()) with a symbolic z-level, so coincident
 * vertices from different cells and tiers weld exactly and the manifold
 * check is meaningful. No CSG anywhere, ever.
 */

export interface Mesh {
  /** xyz triples */
  readonly positions: number[];
  /** vertex index triples */
  readonly triangles: number[];
}

export class MeshBuilder {
  private readonly indexByKey = new Map<string, number>();
  readonly positions: number[] = [];
  readonly triangles: number[] = [];

  vertex(key: string, x: number, y: number, z: number): number {
    const existing = this.indexByKey.get(key);
    if (existing !== undefined) return existing;
    const idx = this.positions.length / 3;
    this.positions.push(x, y, z);
    this.indexByKey.set(key, idx);
    return idx;
  }

  tri(a: number, b: number, c: number): void {
    this.triangles.push(a, b, c);
  }

  quad(a: number, b: number, c: number, d: number): void {
    this.tri(a, b, c);
    this.tri(a, c, d);
  }

  build(): Mesh {
    return { positions: this.positions, triangles: this.triangles };
  }
}

export interface ManifoldReport {
  /** Directed-edge imbalances: edges not traversed once in each direction. */
  readonly boundaryEdges: Array<[number, number]>;
  /** Edges traversed more than twice in total (or twice in the same direction). */
  readonly nonManifoldEdges: Array<[number, number]>;
}

/**
 * Directed-edge audit. In a closed orientable surface every undirected edge
 * is traversed exactly once in each direction; edges traversed once in total
 * are boundary (legal only where the vault meets the springing), anything
 * else is non-manifold.
 */
export function manifoldReport(mesh: Mesh): ManifoldReport {
  const counts = new Map<string, { a: number; b: number; forward: number; backward: number }>();
  const note = (a: number, b: number) => {
    const key = a < b ? `${a}_${b}` : `${b}_${a}`;
    let e = counts.get(key);
    if (!e) {
      e = { a: Math.min(a, b), b: Math.max(a, b), forward: 0, backward: 0 };
      counts.set(key, e);
    }
    if (a < b) e.forward++;
    else e.backward++;
  };
  for (let i = 0; i < mesh.triangles.length; i += 3) {
    const [a, b, c] = [mesh.triangles[i]!, mesh.triangles[i + 1]!, mesh.triangles[i + 2]!];
    note(a, b);
    note(b, c);
    note(c, a);
  }
  const boundaryEdges: Array<[number, number]> = [];
  const nonManifoldEdges: Array<[number, number]> = [];
  for (const e of counts.values()) {
    const total = e.forward + e.backward;
    if (total === 2 && e.forward === 1) continue; // interior, consistently oriented
    if (total === 1) boundaryEdges.push([e.a, e.b]);
    else nonManifoldEdges.push([e.a, e.b]);
  }
  return { boundaryEdges, nonManifoldEdges };
}

/** Area of the mesh's projection footprint contribution of one triangle (signed). */
export function projectedTriangleArea(mesh: Mesh, triIndex: number): number {
  const i = triIndex * 3;
  const [a, b, c] = [mesh.triangles[i]!, mesh.triangles[i + 1]!, mesh.triangles[i + 2]!];
  const ax = mesh.positions[a * 3]!;
  const ay = mesh.positions[a * 3 + 1]!;
  const bx = mesh.positions[b * 3]!;
  const by = mesh.positions[b * 3 + 1]!;
  const cx = mesh.positions[c * 3]!;
  const cy = mesh.positions[c * 3 + 1]!;
  return ((bx - ax) * (cy - ay) - (by - ay) * (cx - ax)) / 2;
}

/** Total unsigned surface area of the mesh in 3D. */
export function surfaceArea(mesh: Mesh): number {
  let total = 0;
  for (let i = 0; i < mesh.triangles.length; i += 3) {
    const [a, b, c] = [mesh.triangles[i]!, mesh.triangles[i + 1]!, mesh.triangles[i + 2]!];
    const ax = mesh.positions[a * 3]!;
    const ay = mesh.positions[a * 3 + 1]!;
    const az = mesh.positions[a * 3 + 2]!;
    const ux = mesh.positions[b * 3]! - ax;
    const uy = mesh.positions[b * 3 + 1]! - ay;
    const uz = mesh.positions[b * 3 + 2]! - az;
    const vx = mesh.positions[c * 3]! - ax;
    const vy = mesh.positions[c * 3 + 1]! - ay;
    const vz = mesh.positions[c * 3 + 2]! - az;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    total += Math.hypot(nx, ny, nz) / 2;
  }
  return total;
}
