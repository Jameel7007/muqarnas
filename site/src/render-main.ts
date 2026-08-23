import './style.css';
import { Iso, takhtPlateFull, type Pt } from '@muqarnas/plan';
import { enumerateAssignments, liftVault } from '@muqarnas/lift';
import {
  bakeVertexAO,
  createVaultStage,
  plasterMaterial,
  toDisplayGeometry,
  vaultToGeometry,
} from '@muqarnas/render';
import type { BufferGeometry } from 'three';

/**
 * The render stage: any of the plate's valid readings, lifted at render
 * sampling, AO-baked, and lit by the from-below language. Nothing here is
 * pinned to one reading — the regular-centre reading is only the
 * development default.
 */

const status = document.querySelector('#status')!;
const readingsBox = document.querySelector('#readings')!;
const say = (t: string) => {
  status.textContent = t;
};

const PLATE_SYMMETRIES = [0, 2, 4, 6].flatMap((k) => [
  Iso.rotation(k),
  Iso.reflection(2).then(Iso.rotation(k)),
]);
const openCentre = (a: Pt, b: Pt) => {
  const [ax, ay] = a.toNumbers();
  const [bx, by] = b.toNumbers();
  return !(Math.hypot(ax, ay) < 4.3 && Math.hypot(bx, by) < 4.3);
};

async function main() {
  say('solving the plate…');
  const plan = takhtPlateFull();
  const report = enumerateAssignments(plan, { maxFreeOrbits: 20, symmetries: PLATE_SYMMETRIES });

  say('starting the renderer…');
  const stage = await createVaultStage(document.querySelector('#stage')!);
  const material = plasterMaterial();

  const cache = new Map<number, BufferGeometry>();
  let busy = false;
  let current = -1;

  const label = (i: number) => {
    const s = report.solutions[i]!;
    const tag = s.graphReach === 17 ? ' · regular centre' : s.graphReach === 18 ? ' · Harb' : '';
    return `${i + 1} — reach ${s.graphReach}${tag}`;
  };

  const show = async (i: number) => {
    if (busy || i === current) return;
    busy = true;
    current = i;
    document.querySelectorAll('[data-reading]').forEach((b) => {
      b.classList.toggle('active', (b as HTMLElement).dataset.reading === String(i));
    });
    let geometry = cache.get(i);
    if (!geometry) {
      const sol = report.solutions[i]!;
      say(`reading ${i + 1}: raising the vault…`);
      await new Promise((r) => setTimeout(r, 16));
      const vault = liftVault(plan, sol.faces, {
        arcSegments: 6,
        rampSegments: 3,
        closeBoundary: openCentre,
      });
      const welded = vaultToGeometry(vault);
      const stats = await bakeVertexAO(welded, {
        rays: 40,
        maxDistance: 7,
        onProgress: (done, total) =>
          say(`reading ${i + 1}: baking occlusion ${Math.round((100 * done) / total)}%`),
      });
      geometry = toDisplayGeometry(welded);
      cache.set(i, geometry);
      say(
        `reading ${i + 1} · reach ${sol.graphReach} · ${vault.mesh.triangles.length / 3} triangles · ` +
          `ao mean ${stats.mean.toFixed(2)}, min ${stats.min.toFixed(2)} · ${stage.backend}`,
      );
    } else {
      const sol = report.solutions[i]!;
      say(`reading ${i + 1} · reach ${sol.graphReach} · ${stage.backend}`);
    }
    stage.setGeometry(geometry, material);
    busy = false;
  };

  report.solutions.forEach((_, i) => {
    const btn = document.createElement('button');
    btn.className = 'pick';
    btn.dataset.reading = String(i);
    btn.textContent = label(i);
    btn.addEventListener('click', () => void show(i));
    readingsBox.appendChild(btn);
  });

  document.querySelectorAll('[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      stage.setView((btn as HTMLElement).dataset.view as 'beneath' | 'profile');
    });
  });

  const initial = report.solutions.findIndex((s) => s.graphReach === 17);
  await show(initial >= 0 ? initial : 0);
}

void main().catch((err) => {
  say(`failed: ${err instanceof Error ? err.message : String(err)}`);
  console.error(err);
});
