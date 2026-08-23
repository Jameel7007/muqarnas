import './style.css';
import Lenis from 'lenis';
import { Iso, takhtPlateFull, type Pt } from '@muqarnas/plan';
import { enumerateAssignments, liftVault } from '@muqarnas/lift';
import {
  bakeVertexAO,
  createVaultStage,
  plasterMaterial,
  toDisplayGeometry,
  vaultToGeometry,
} from '@muqarnas/render';
import {
  RisingVaultRig,
  ScrollTrigger,
  bindScrubbedScene,
  createScene5,
  gsap,
  makePlanLines,
} from '@muqarnas/scenes';

/**
 * The scroll piece, beginning at its hinge: scene 5. Reading-agnostic —
 * the regular-centre solution is only the default.
 */

const say = (t: string) => {
  document.querySelector('#load-status')!.textContent = t;
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
  // smooth scroll driving ScrollTrigger
  const lenis = new Lenis({ autoRaf: false });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  say('solving the plate…');
  await new Promise((r) => setTimeout(r, 30));
  const plan = takhtPlateFull();
  const report = enumerateAssignments(plan, { maxFreeOrbits: 20, symmetries: PLATE_SYMMETRIES });
  const solution = report.solutions.find((s) => s.graphReach === 17) ?? report.solutions[0]!;

  say('raising the vault…');
  await new Promise((r) => setTimeout(r, 30));
  const vault = liftVault(plan, solution.faces, {
    arcSegments: 4,
    rampSegments: 2,
    closeBoundary: openCentre,
  });
  const welded = vaultToGeometry(vault);
  await bakeVertexAO(welded, {
    rays: 40,
    maxDistance: 7,
    onProgress: (done, total) => say(`baking the light ${Math.round((100 * done) / total)}%`),
  });
  const display = toDisplayGeometry(welded);

  say('opening the stage…');
  const stage = await createVaultStage(document.querySelector('#stage')!);
  stage.controls.enabled = false; // the scene owns the camera
  stage.setGeometry(display, plasterMaterial());

  const planLines = makePlanLines(plan);
  stage.scene.add(planLines);

  const rig = new RisingVaultRig(display, vault.tris);
  const scene5 = createScene5(
    rig,
    stage,
    {
      captionA: document.querySelector<HTMLElement>('#cap-a')!,
      captionB: document.querySelector<HTMLElement>('#cap-b')!,
    },
    { planLines },
  );
  bindScrubbedScene(document.querySelector('#scene5-track')!, (p) => {
    scene5(p);
    (document.querySelector('#hint') as HTMLElement).style.opacity = p > 0.02 ? '0' : '1';
  });

  document.querySelector('#loader')!.classList.add('done');
}

void main().catch((err) => {
  say(`failed: ${err instanceof Error ? err.message : String(err)}`);
  console.error(err);
});
