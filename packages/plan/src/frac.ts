/**
 * Exact rational arithmetic over bigint. Immutable, always normalized:
 * denominator > 0, gcd(|n|, d) = 1.
 */

function gcd(a: bigint, b: bigint): bigint {
  while (b !== 0n) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a < 0n ? -a : a;
}

export class Frac {
  readonly n: bigint;
  readonly d: bigint;

  private constructor(n: bigint, d: bigint) {
    this.n = n;
    this.d = d;
  }

  static of(n: bigint | number, d: bigint | number = 1n): Frac {
    let nn = typeof n === 'number' ? BigInt(n) : n;
    let dd = typeof d === 'number' ? BigInt(d) : d;
    if (typeof n === 'number' && !Number.isInteger(n)) throw new Error(`Frac.of: non-integer ${n}`);
    if (typeof d === 'number' && !Number.isInteger(d)) throw new Error(`Frac.of: non-integer ${d}`);
    if (dd === 0n) throw new Error('Frac: division by zero');
    if (dd < 0n) {
      nn = -nn;
      dd = -dd;
    }
    const g = gcd(nn, dd);
    return g === 0n ? new Frac(0n, 1n) : new Frac(nn / g, dd / g);
  }

  static readonly ZERO = Frac.of(0n);
  static readonly ONE = Frac.of(1n);

  add(o: Frac): Frac {
    return Frac.of(this.n * o.d + o.n * this.d, this.d * o.d);
  }
  sub(o: Frac): Frac {
    return Frac.of(this.n * o.d - o.n * this.d, this.d * o.d);
  }
  mul(o: Frac): Frac {
    return Frac.of(this.n * o.n, this.d * o.d);
  }
  div(o: Frac): Frac {
    if (o.n === 0n) throw new Error('Frac: division by zero');
    return Frac.of(this.n * o.d, this.d * o.n);
  }
  neg(): Frac {
    return Frac.of(-this.n, this.d);
  }
  sign(): -1 | 0 | 1 {
    return this.n === 0n ? 0 : this.n > 0n ? 1 : -1;
  }
  isZero(): boolean {
    return this.n === 0n;
  }
  eq(o: Frac): boolean {
    return this.n === o.n && this.d === o.d;
  }
  cmp(o: Frac): -1 | 0 | 1 {
    const t = this.n * o.d - o.n * this.d;
    return t === 0n ? 0 : t > 0n ? 1 : -1;
  }
  toNumber(): number {
    // Split to keep precision for large numerators.
    const q = this.n / this.d;
    const r = this.n % this.d;
    return Number(q) + Number(r) / Number(this.d);
  }
  toString(): string {
    return this.d === 1n ? `${this.n}` : `${this.n}/${this.d}`;
  }
  /** Stable serialization for use as a map key. */
  key(): string {
    return `${this.n}/${this.d}`;
  }
}
