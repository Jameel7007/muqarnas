import type { Plan, PlacedElement } from './plan.js';
import { worldOutline } from './plan.js';
import type { ElementDef, ElementKind } from './elements.js';
import type { Pt } from './geom.js';

/**
 * Flat SVG rendering of plans and elements, for inspection. Straight chords
 * only for now: arc rendering waits until the source-backed arc geometry per
 * element is settled.
 */

export const KIND_COLORS: Record<ElementKind, string> = {
  square: '#8a6f4d',
  'half-square': '#a08154',
  rhombus: '#5e7a8a',
  'half-rhombus': '#6f8fa0',
  jug: '#7a5e8a',
  'large-biped': '#4d5a66',
  almond: '#8a5e5e',
  'small-biped': '#66594d',
  'barley-kernel': '#5e8a6f',
};

const TIER_COLORS = ['#8a6f4d', '#5e7a8a', '#8a5e5e', '#7a5e8a', '#5e8a6f', '#a08154'];

export interface PlanSvgOptions {
  readonly width?: number;
  readonly margin?: number;
  readonly colorBy?: 'kind' | 'tier';
  readonly background?: string;
  readonly showSector?: boolean;
}

function bounds(pts: Iterable<Pt>): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    const [x, y] = p.toNumbers();
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}

function pathOf(verts: readonly Pt[], toSvg: (p: Pt) => [number, number]): string {
  return (
    verts
      .map((v, i) => {
        const [x, y] = toSvg(v);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(4)} ${y.toFixed(4)}`;
      })
      .join(' ') + ' Z'
  );
}

export function planToSvg(plan: Plan, opts: PlanSvgOptions = {}): string {
  const width = opts.width ?? 640;
  const margin = opts.margin ?? 16;
  const colorBy = opts.colorBy ?? 'kind';

  const all: Pt[] = [...plan.sector];
  for (const p of plan.placed) all.push(...worldOutline(p).verts);
  const b = bounds(all);
  const spanX = b.maxX - b.minX || 1;
  const spanY = b.maxY - b.minY || 1;
  const scale = (width - 2 * margin) / Math.max(spanX, spanY);
  const height = spanY * scale + 2 * margin;
  const toSvg = (p: Pt): [number, number] => {
    const [x, y] = p.toNumbers();
    return [margin + (x - b.minX) * scale, height - margin - (y - b.minY) * scale];
  };

  const fill = (p: PlacedElement): string => {
    if (colorBy === 'tier') return TIER_COLORS[(p.tier ?? 0) % TIER_COLORS.length]!;
    return KIND_COLORS[p.def.kind];
  };

  const shapes = plan.placed
    .map((p) => {
      const { verts } = worldOutline(p);
      return `<path d="${pathOf(verts, toSvg)}" fill="${fill(p)}" fill-opacity="0.55" stroke="#e8e2d5" stroke-width="1" stroke-linejoin="round"><title>${p.def.kind} (${p.role}${p.tier !== undefined ? `, tier ${p.tier}` : ''})</title></path>`;
    })
    .join('\n  ');

  const sector = opts.showSector === false
    ? ''
    : `<path d="${pathOf([...plan.sector], toSvg)}" fill="none" stroke="#b7a97f" stroke-width="1.5" stroke-dasharray="6 4"/>`;

  const bg = opts.background ?? 'none';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height.toFixed(2)}" width="${width}" height="${height.toFixed(2)}">
  ${bg === 'none' ? '' : `<rect width="100%" height="100%" fill="${bg}"/>`}
  ${shapes}
  ${sector}
</svg>`;
}

export function elementToSvg(def: ElementDef, size = 160): string {
  const b = bounds(def.verts);
  const margin = 14;
  const span = Math.max(b.maxX - b.minX, b.maxY - b.minY) || 1;
  const scale = (size - 2 * margin) / span;
  const height = (b.maxY - b.minY) * scale + 2 * margin;
  const toSvg = (p: Pt): [number, number] => {
    const [x, y] = p.toNumbers();
    return [margin + (x - b.minX) * scale, height - margin - (y - b.minY) * scale];
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${height.toFixed(2)}" width="${size}" height="${height.toFixed(2)}">
  <path d="${pathOf([...def.verts], toSvg)}" fill="${KIND_COLORS[def.kind]}" fill-opacity="0.55" stroke="#e8e2d5" stroke-width="1.25" stroke-linejoin="round"/>
</svg>`;
}
