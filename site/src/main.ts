import './style.css';
import {
  ALPHABET,
  EXACT_AREAS,
  elementToSvg,
  gridVaultFull,
  gridVaultWedge,
  kashiProfile,
  planToSvg,
  validatePlan,
} from '@muqarnas/plan';
import { gridVaultLifted, manifoldReport } from '@muqarnas/lift';

const app = document.querySelector<HTMLDivElement>('#app')!;

/* ---------- alphabet gallery ---------- */

const ARABIC: Partial<Record<string, string>> = {
  square: 'murabbaʿ',
  rhombus: 'muʿayyan',
  jug: 'barmak',
  almond: 'bādām',
};

function galleryHtml(): string {
  const tiles = [...ALPHABET.values()]
    .map((def) => {
      const area = EXACT_AREAS[def.kind]!;
      return `<div class="tile">
        ${elementToSvg(def, 150)}
        <div class="name">${def.kind}${ARABIC[def.kind] ? ` · ${ARABIC[def.kind]}` : ''}</div>
        <div class="roles">${def.roles.join(' / ')}</div>
        <div class="meta">area = ${area.toString()} ≈ ${area.toNumber().toFixed(5)}</div>
        <div class="meta">${def.derivation}</div>
      </div>`;
    })
    .join('\n');
  return `<section>
    <h2>The alphabet</h2>
    <p class="caption">Eight of the nine shapes, each constructed from the two seeds —
    the square and the 45° rhombus — never traced. The barley kernel waits on its
    measured definition from the sources.</p>
    <div class="gallery">${tiles}</div>
  </section>`;
}

/* ---------- profile construction ---------- */

function profileHtml(): string {
  const p = kashiProfile();
  const S = 200; // px per module
  const pad = 52;
  const W = S + 2 * pad;
  const H = 2 * S + 2 * pad;
  const X = (x: number) => pad + x * S;
  const Zc = (z: number) => H - pad - z * S;

  const { A, E, Z: Zp, H: Hp, T, divisions } = p.construction;
  const divDots = divisions
    .map(([x, z]) => `<circle cx="${X(x)}" cy="${Zc(z)}" r="2.6" fill="#b7a97f"/>`)
    .join('');
  const profile = p
    .polyline(48)
    .map(([x, z], i) => `${i === 0 ? 'M' : 'L'}${X(x).toFixed(2)} ${Zc(z).toFixed(2)}`)
    .join(' ');
  const rEZ = Math.hypot(Zp[0] - E[0], Zp[1] - E[1]) * S;
  const rotArc = `M${X(Zp[0]).toFixed(2)} ${Zc(Zp[1]).toFixed(2)} A ${rEZ.toFixed(2)} ${rEZ.toFixed(2)} 0 0 1 ${X(Hp[0]).toFixed(2)} ${Zc(Hp[1]).toFixed(2)}`;
  const label = (x: number, z: number, t: string, dx = 6, dy = -6) =>
    `<text x="${X(x) + dx}" y="${Zc(z) + dy}" fill="#9a917d" font-size="11" font-family="ui-monospace, monospace">${t}</text>`;

  return `<section>
    <h2>The module and the profile</h2>
    <p class="caption">Al-Kāshī's "method of the masons," drawn from the construction
    itself, in the 1 : 2 rectangle the excavated Takht-i Sulaymān cells confirm. The 30°
    oblique from the top corner A, five equal parts, and the last two fifths rotated about
    E down onto the vertical give H — the <em>factor</em>, ≈ ${p.factor.toFixed(6)} per
    module (al-Kāshī: 0;57,38,43,14). The arc HZ is exactly one sixth of a circle, radius
    4/5, and the 30° is what makes everything tangent: vertical facet, arc, ramp. Facet +
    half the curve = the <em>taʿdīl</em> ≈ ${p.coefficient.toFixed(6)} (al-Kāshī 1;43,33,45,41),
    the multiplier that turns counted facet bases into vault surface.</p>
    <div class="row">
      <figure class="figure" style="max-width:${W + 40}px">
        <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
          <rect x="${X(0)}" y="${Zc(p.height)}" width="${S}" height="${2 * S}" fill="none" stroke="#2c2820"/>
          <line x1="${X(A[0])}" y1="${Zc(A[1])}" x2="${X(E[0])}" y2="${Zc(E[1])}" stroke="#6f8fa0" stroke-width="1.2"/>
          ${divDots}
          <path d="${rotArc}" fill="none" stroke="#6f8fa0" stroke-width="1" stroke-dasharray="4 4"/>
          <line x1="${X(T[0])}" y1="${Zc(T[1])}" x2="${X(Hp[0])}" y2="${Zc(Hp[1])}" stroke="#3d382e" stroke-width="1"/>
          <line x1="${X(T[0])}" y1="${Zc(T[1])}" x2="${X(Zp[0])}" y2="${Zc(Zp[1])}" stroke="#3d382e" stroke-width="1"/>
          <circle cx="${X(T[0])}" cy="${Zc(T[1])}" r="2.4" fill="#3d382e" stroke="#9a917d" stroke-width="0.8"/>
          <path d="${profile}" fill="none" stroke="#e8e2d5" stroke-width="2.2"/>
          <circle cx="${X(Hp[0])}" cy="${Zc(Hp[1])}" r="3.2" fill="none" stroke="#b7a97f"/>
          <line x1="${X(0) - 7}" y1="${Zc(0)}" x2="${X(0) - 7}" y2="${Zc(p.factor)}" stroke="#9a917d" stroke-width="1"/>
          <text x="${X(0) - 14}" y="${Zc(p.factor / 2)}" fill="#9a917d" font-size="11" font-family="ui-monospace, monospace" text-anchor="end" transform="rotate(-90 ${X(0) - 14} ${Zc(p.factor / 2)})">factor</text>
          ${label(A[0], A[1], 'A', -14, -8)}
          ${label(E[0], E[1], 'E', -16, 0)}
          ${label(Zp[0], Zp[1], 'Z', 8, -2)}
          ${label(Hp[0], Hp[1], 'H', 10, 12)}
          ${label(T[0], T[1], 'T', 6, 14)}
        </svg>
        <figcaption>Base to top: vertical facet to H, sixty degrees of arc about T, then
        the straight 30° ramp to the apex A. Tangent-continuous throughout — the
        construction's own doing, not an interpolation. Dashed: the two fifths EZ swinging
        down about E onto the vertical.</figcaption>
      </figure>
    </div>
  </section>`;
}

/* ---------- demo plan ---------- */

function planHtml(): string {
  const wedge = gridVaultWedge();
  const full = gridVaultFull();
  const vw = validatePlan(wedge);
  const vf = validatePlan(full);
  const status = (name: string, ok: boolean, n: number) =>
    `<span class="status ${ok ? 'ok' : 'bad'}">${name}: ${ok ? 'exact cover ✓' : 'INVALID'} · ${n} elements</span>`;
  return `<section>
    <h2>A first plan, lifted nowhere yet</h2>
    <p class="caption">A deliberately modest two-tier vault plan — squares and half-squares,
    al-Kāshī's simple type — assembled as one eighth and unfolded through the D4
    kaleidoscope. It exists to prove the machinery: assembly, reflection, and the exact
    cover invariant, checked in ℚ(√2) with equality, not epsilon. The Takht-i Sulaymān
    quarter plan takes its place once its element layout is extracted from the sources.</p>
    ${status('wedge', vw.ok, wedge.placed.length)} ${status('full plan', vf.ok, full.placed.length)}
    <div class="row">
      <figure class="figure" style="flex:0 1 320px">
        ${planToSvg(wedge, { width: 300, colorBy: 'tier' })}
        <figcaption>The eighth: crown half-square (tier 2), square and half-square (tier 1).</figcaption>
      </figure>
      <figure class="figure" style="flex:0 1 480px">
        ${planToSvg(full, { width: 460, colorBy: 'tier' })}
        <figcaption>Unfolded: eight copies under rotation and reflection. Seams cancel exactly.</figcaption>
      </figure>
    </div>
  </section>`;
}

/* ---------- the lift, seen ---------- */

function liftHtml(): string {
  const { vault } = gridVaultLifted();
  const { mesh, tris } = vault;
  const report = manifoldReport(mesh);
  const watertight = report.nonManifoldEdges.length === 0;

  // Isometric-ish projection with a painter's sort — verification, not rendering.
  const az = Math.PI / 5.2; // view azimuth
  const P = (x: number, y: number, z: number): [number, number, number] => {
    const rx = x * Math.cos(az) - y * Math.sin(az);
    const ry = x * Math.sin(az) + y * Math.cos(az);
    return [rx, ry * 0.5 - z * 0.72, ry + z]; // [screen x, screen y (down), depth]
  };
  const light = (() => {
    const l = [-0.45, 0.35, 0.82] as const;
    const n = Math.hypot(...l);
    return [l[0] / n, l[1] / n, l[2] / n] as const;
  })();

  type Face = { d: string; depth: number; shade: number; role: string };
  const faces: Face[] = [];
  for (let t = 0; t < tris.length; t++) {
    const [ia, ib, ic] = [mesh.triangles[t * 3]!, mesh.triangles[t * 3 + 1]!, mesh.triangles[t * 3 + 2]!];
    const v = (i: number) => [mesh.positions[i * 3]!, mesh.positions[i * 3 + 1]!, mesh.positions[i * 3 + 2]!] as const;
    const [a, b, c] = [v(ia), v(ib), v(ic)];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let nx = u[1]! * w[2]! - u[2]! * w[1]!;
    let ny = u[2]! * w[0]! - u[0]! * w[2]!;
    let nz = u[0]! * w[1]! - u[1]! * w[0]!;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;
    const lam = Math.max(0, nx * light[0] + ny * light[1] + nz * light[2]);
    const pa = P(...a); const pb = P(...b); const pc = P(...c);
    faces.push({
      d: `M${pa[0].toFixed(3)} ${pa[1].toFixed(3)} L${pb[0].toFixed(3)} ${pb[1].toFixed(3)} L${pc[0].toFixed(3)} ${pc[1].toFixed(3)} Z`,
      depth: (pa[2] + pb[2] + pc[2]) / 3,
      shade: lam,
      role: tris[t]!.role,
    });
  }
  faces.sort((p, q) => p.depth - q.depth);

  // fit
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const [sx, sy] = P(mesh.positions[i]!, mesh.positions[i + 1]!, mesh.positions[i + 2]!);
    minX = Math.min(minX, sx); maxX = Math.max(maxX, sx);
    minY = Math.min(minY, sy); maxY = Math.max(maxY, sy);
  }
  const pad = 0.35;
  const vb = `${(minX - pad).toFixed(2)} ${(minY - pad).toFixed(2)} ${(maxX - minX + 2 * pad).toFixed(2)} ${(maxY - minY + 2 * pad).toFixed(2)}`;
  const paths = faces
    .map((f) => {
      const base = 0.28 + 0.62 * f.shade;
      const rgb = `rgb(${Math.round(214 * base)}, ${Math.round(205 * base)}, ${Math.round(188 * base)})`;
      return `<path d="${f.d}" fill="${rgb}" stroke="rgba(20,18,14,0.35)" stroke-width="0.008"/>`;
    })
    .join('\n    ');

  return `<section>
    <h2>The lift, simple type</h2>
    <p class="caption">The same plan raised: plane facets of constant height on every front
    rib, plane roofs closing to the tier top, tier on tier to a single crown apex. The mesh
    is ${watertight ? 'watertight' : 'NOT watertight'} (${report.boundaryEdges.length} boundary
    edges, all at the springing) and its roofs project back onto the plan exactly — the
    projection identity, tested to 10 decimal places.</p>
    <span class="status ${watertight ? 'ok' : 'bad'}">manifold ${watertight ? '✓' : '✗'} · ${mesh.triangles.length / 3} triangles · ${mesh.positions.length / 3} welded vertices</span>
    <div class="row">
      <figure class="figure" style="flex:0 1 640px">
        <svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg">
          ${paths}
        </svg>
        <figcaption>Painter-sorted flat shading, straight from the mesh — a verification
        view, not the lighting language. From-below and the real materials come with the
        render package.</figcaption>
      </figure>
    </div>
  </section>`;
}

app.innerHTML = `<main>
  <header class="masthead">
    <h1>Muqarnas</h1>
    <p class="sub">plan inspection — the element alphabet, al-Kāshī's profile, and the exact-cover invariant</p>
  </header>
  ${galleryHtml()}
  ${profileHtml()}
  ${planHtml()}
  ${liftHtml()}
</main>`;
