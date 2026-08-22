import { Frac } from './frac.js';

/**
 * Exact arithmetic in the field ℚ(√2): numbers of the form a + b·√2 with
 * rational a, b. Closed under +, −, ×, ÷.
 *
 * Every coordinate in a muqarnas plan lives here, because the element
 * alphabet is generated on the 45° grid: placements are translations plus
 * rotations by multiples of 45° (whose matrix entries are 0, ±1, ±√2/2) and
 * reflections across axes at multiples of 22.5° (entries again in ℚ(√2)).
 * That closure is what lets tiling and projection tests assert equality
 * instead of |Δ| < ε.
 */
export class Q2 {
  readonly a: Frac;
  readonly b: Frac;

  constructor(a: Frac, b: Frac) {
    this.a = a;
    this.b = b;
  }

  /** a + b·√2 from integers or fractions. */
  static of(a: Frac | bigint | number, b: Frac | bigint | number = 0n): Q2 {
    const fa = a instanceof Frac ? a : Frac.of(a);
    const fb = b instanceof Frac ? b : Frac.of(b);
    return new Q2(fa, fb);
  }
  /** Rational a/b as a Q2. */
  static frac(n: bigint | number, d: bigint | number): Q2 {
    return new Q2(Frac.of(n, d), Frac.ZERO);
  }

  static readonly ZERO = Q2.of(0n);
  static readonly ONE = Q2.of(1n);
  static readonly TWO = Q2.of(2n);
  static readonly HALF = Q2.frac(1, 2);
  static readonly SQRT2 = Q2.of(0n, 1n);
  /** √2/2 = cos 45° = sin 45° */
  static readonly SQRT2_HALF = Q2.of(Frac.ZERO, Frac.of(1, 2));
  /** √2 − 1 = tan 22.5° */
  static readonly SQRT2_M1 = Q2.of(Frac.of(-1), Frac.ONE);
  /** √2 + 1 = tan 67.5° */
  static readonly SQRT2_P1 = Q2.of(Frac.ONE, Frac.ONE);

  add(o: Q2): Q2 {
    return new Q2(this.a.add(o.a), this.b.add(o.b));
  }
  sub(o: Q2): Q2 {
    return new Q2(this.a.sub(o.a), this.b.sub(o.b));
  }
  neg(): Q2 {
    return new Q2(this.a.neg(), this.b.neg());
  }
  mul(o: Q2): Q2 {
    // (a + b√2)(c + d√2) = (ac + 2bd) + (ad + bc)√2
    const a = this.a.mul(o.a).add(Frac.of(2).mul(this.b.mul(o.b)));
    const b = this.a.mul(o.b).add(this.b.mul(o.a));
    return new Q2(a, b);
  }
  /** Multiplicative inverse: 1/(a + b√2) = (a − b√2)/(a² − 2b²). */
  inv(): Q2 {
    const denom = this.a.mul(this.a).sub(Frac.of(2).mul(this.b.mul(this.b)));
    if (denom.isZero()) throw new Error('Q2: inverse of zero');
    return new Q2(this.a.div(denom), this.b.neg().div(denom));
  }
  div(o: Q2): Q2 {
    return this.mul(o.inv());
  }

  /** Exact sign of a + b·√2. */
  sign(): -1 | 0 | 1 {
    const sa = this.a.sign();
    const sb = this.b.sign();
    if (sb === 0) return sa;
    if (sa === 0) return sb;
    if (sa === sb) return sa;
    // Opposite signs: |a| vs |b|√2 decided by a² vs 2b², both rational.
    const t = this.a.mul(this.a).sub(Frac.of(2).mul(this.b.mul(this.b)));
    const st = t.sign();
    if (st === 0) return 0;
    return st === 1 ? sa : sb;
  }
  isZero(): boolean {
    return this.a.isZero() && this.b.isZero();
  }
  eq(o: Q2): boolean {
    return this.a.eq(o.a) && this.b.eq(o.b);
  }
  cmp(o: Q2): -1 | 0 | 1 {
    return this.sub(o).sign();
  }
  lt(o: Q2): boolean {
    return this.cmp(o) === -1;
  }
  gt(o: Q2): boolean {
    return this.cmp(o) === 1;
  }

  toNumber(): number {
    return this.a.toNumber() + this.b.toNumber() * Math.SQRT2;
  }
  toString(): string {
    if (this.b.isZero()) return this.a.toString();
    if (this.a.isZero()) return `${this.b}√2`;
    const sb = this.b.sign() === 1 ? `+ ${this.b}√2` : `− ${this.b.neg()}√2`;
    return `${this.a} ${sb}`;
  }
  /** Stable serialization for use as a map key. */
  key(): string {
    return `${this.a.key()};${this.b.key()}`;
  }
}
