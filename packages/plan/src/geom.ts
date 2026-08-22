import { Q2 } from './q2.js';

/** A point (or vector) with exact ℚ(√2) coordinates. */
export class Pt {
  constructor(readonly x: Q2, readonly y: Q2) {}

  static of(x: Q2 | bigint | number, y: Q2 | bigint | number): Pt {
    return new Pt(x instanceof Q2 ? x : Q2.of(x), y instanceof Q2 ? y : Q2.of(y));
  }

  add(o: Pt): Pt {
    return new Pt(this.x.add(o.x), this.y.add(o.y));
  }
  sub(o: Pt): Pt {
    return new Pt(this.x.sub(o.x), this.y.sub(o.y));
  }
  scale(k: Q2): Pt {
    return new Pt(this.x.mul(k), this.y.mul(k));
  }
  neg(): Pt {
    return new Pt(this.x.neg(), this.y.neg());
  }
  eq(o: Pt): boolean {
    return this.x.eq(o.x) && this.y.eq(o.y);
  }
  key(): string {
    return `${this.x.key()}|${this.y.key()}`;
  }
  toNumbers(): [number, number] {
    return [this.x.toNumber(), this.y.toNumber()];
  }
  toString(): string {
    return `(${this.x}, ${this.y})`;
  }
}

export const pt = Pt.of;

export function cross2(u: Pt, v: Pt): Q2 {
  return u.x.mul(v.y).sub(u.y.mul(v.x));
}
export function dot2(u: Pt, v: Pt): Q2 {
  return u.x.mul(v.x).add(u.y.mul(v.y));
}
/** Rotate a vector by +90°. */
export function perp(v: Pt): Pt {
  return new Pt(v.y.neg(), v.x);
}

/** cos/sin of k·45° as exact Q2, k = 0..7. */
const COS45: Q2[] = [
  Q2.ONE,
  Q2.SQRT2_HALF,
  Q2.ZERO,
  Q2.SQRT2_HALF.neg(),
  Q2.ONE.neg(),
  Q2.SQRT2_HALF.neg(),
  Q2.ZERO,
  Q2.SQRT2_HALF,
];
const SIN45: Q2[] = [
  Q2.ZERO,
  Q2.SQRT2_HALF,
  Q2.ONE,
  Q2.SQRT2_HALF,
  Q2.ZERO,
  Q2.SQRT2_HALF.neg(),
  Q2.ONE.neg(),
  Q2.SQRT2_HALF.neg(),
];

const mod = (k: number, n: number) => ((k % n) + n) % n;

/**
 * An isometry of the plane whose linear part stays inside ℚ(√2):
 * rotations by multiples of 45°, reflections across axes at multiples of
 * 22.5°, and arbitrary ℚ(√2) translations. This is the full symmetry group a
 * muqarnas plan on the 45° grid ever needs, and it is closed — applying any
 * Iso keeps coordinates exact.
 */
export class Iso {
  constructor(
    readonly m00: Q2,
    readonly m01: Q2,
    readonly m10: Q2,
    readonly m11: Q2,
    readonly tx: Q2,
    readonly ty: Q2,
  ) {}

  static readonly IDENTITY = new Iso(Q2.ONE, Q2.ZERO, Q2.ZERO, Q2.ONE, Q2.ZERO, Q2.ZERO);

  /** CCW rotation by k·45° about the origin. */
  static rotation(k: number): Iso {
    const i = mod(k, 8);
    const c = COS45[i]!;
    const s = SIN45[i]!;
    return new Iso(c, s.neg(), s, c, Q2.ZERO, Q2.ZERO);
  }

  /** Reflection across the line through the origin at k·22.5°. */
  static reflection(k: number): Iso {
    // Matrix [cos 2θ, sin 2θ; sin 2θ, −cos 2θ] with 2θ = k·45°.
    const i = mod(k, 8);
    const c = COS45[i]!;
    const s = SIN45[i]!;
    return new Iso(c, s, s, c.neg(), Q2.ZERO, Q2.ZERO);
  }

  static translation(v: Pt): Iso {
    return new Iso(Q2.ONE, Q2.ZERO, Q2.ZERO, Q2.ONE, v.x, v.y);
  }

  /** Composition: returns the isometry "apply `this` first, then `next`". */
  then(next: Iso): Iso {
    return new Iso(
      next.m00.mul(this.m00).add(next.m01.mul(this.m10)),
      next.m00.mul(this.m01).add(next.m01.mul(this.m11)),
      next.m10.mul(this.m00).add(next.m11.mul(this.m10)),
      next.m10.mul(this.m01).add(next.m11.mul(this.m11)),
      next.m00.mul(this.tx).add(next.m01.mul(this.ty)).add(next.tx),
      next.m10.mul(this.tx).add(next.m11.mul(this.ty)).add(next.ty),
    );
  }

  apply(p: Pt): Pt {
    return new Pt(
      this.m00.mul(p.x).add(this.m01.mul(p.y)).add(this.tx),
      this.m10.mul(p.x).add(this.m11.mul(p.y)).add(this.ty),
    );
  }

  /** Apply the linear part only (for direction vectors). */
  applyVec(v: Pt): Pt {
    return new Pt(this.m00.mul(v.x).add(this.m01.mul(v.y)), this.m10.mul(v.x).add(this.m11.mul(v.y)));
  }

  det(): Q2 {
    return this.m00.mul(this.m11).sub(this.m01.mul(this.m10));
  }
  /** True for rotations/translations, false for reflections. */
  isDirect(): boolean {
    return this.det().sign() === 1;
  }
}

/** Doubled signed area of a polygon (positive = CCW). Exact. */
export function signedArea2(poly: readonly Pt[]): Q2 {
  let acc = Q2.ZERO;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % poly.length]!;
    acc = acc.add(p.x.mul(q.y).sub(q.x.mul(p.y)));
  }
  return acc;
}

/** Exact polygon area (unsigned). */
export function area(poly: readonly Pt[]): Q2 {
  const a2 = signedArea2(poly);
  const abs = a2.sign() === -1 ? a2.neg() : a2;
  return abs.div(Q2.TWO);
}

/** Return the polygon with CCW winding (reverses if needed). */
export function ensureCcw(poly: Pt[]): Pt[] {
  return signedArea2(poly).sign() === -1 ? [...poly].reverse() : poly;
}

/** Intersection of line (p1, dir d1) with line (p2, dir d2). Exact; throws if parallel. */
export function lineIntersect(p1: Pt, d1: Pt, p2: Pt, d2: Pt): Pt {
  const denom = cross2(d1, d2);
  if (denom.isZero()) throw new Error('lineIntersect: parallel lines');
  const t = cross2(p2.sub(p1), d2).div(denom);
  return p1.add(d1.scale(t));
}

/** Collinear with segment [a,b] and strictly between its endpoints. */
export function onSegmentStrict(p: Pt, a: Pt, b: Pt): boolean {
  const ab = b.sub(a);
  const ap = p.sub(a);
  if (!cross2(ab, ap).isZero()) return false;
  const t = dot2(ap, ab);
  return t.sign() === 1 && t.lt(dot2(ab, ab));
}

/**
 * CCW angle from vector u to vector v in units of 22.5°, i.e. a value in
 * 0..15. Throws if the angle is not a multiple of 22.5° — on this grid that
 * always indicates a construction bug.
 *
 * Works exactly: tan of odd multiples of 22.5° is ±(√2−1) or ±(√2+1), tan of
 * even multiples is 0, ±1 or ∞ — all in ℚ(√2) ∪ {∞}.
 */
export function angleUnits(u: Pt, v: Pt): number {
  const d = dot2(u, v);
  const c = cross2(u, v);
  if (d.isZero() && c.isZero()) throw new Error('angleUnits: zero vector');
  if (c.isZero()) return d.sign() === 1 ? 0 : 8;
  if (d.isZero()) return c.sign() === 1 ? 4 : 12;
  const t = c.div(d);
  let base: number | null = null;
  if (t.eq(Q2.SQRT2_M1)) base = 1;
  else if (t.eq(Q2.ONE)) base = 2;
  else if (t.eq(Q2.SQRT2_P1)) base = 3;
  else if (t.eq(Q2.SQRT2_P1.neg())) base = -3;
  else if (t.eq(Q2.ONE.neg())) base = -2;
  else if (t.eq(Q2.SQRT2_M1.neg())) base = -1;
  if (base === null) throw new Error(`angleUnits: tan = ${t} is not a multiple of 22.5°`);
  return mod(base + (d.sign() === -1 ? 8 : 0), 16);
}

/**
 * Interior angle of a CCW polygon at vertex i, in units of 22.5° (so 4 = 90°,
 * 10 = 225° reflex, …).
 */
export function interiorAngleUnits(poly: readonly Pt[], i: number): number {
  const n = poly.length;
  const prev = poly[mod(i - 1, n)]!;
  const cur = poly[i]!;
  const next = poly[mod(i + 1, n)]!;
  const a = cur.sub(prev);
  const b = next.sub(cur);
  const turn = angleUnits(a, b);
  const signedTurn = mod(turn + 8, 16) - 8; // in [-8, 8)
  return 8 - signedTurn;
}
