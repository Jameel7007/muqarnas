import './style.css';
import Lenis from 'lenis';
import { Iso, takhtPlateFull, type Pt } from '@muqarnas/plan';
import { enumerateAssignments, liftVault, type TierSolution } from '@muqarnas/lift';
import {
  bakeVertexAO,
  createVaultStage,
  makeVaultMesh,
  plasterMaterial,
  toDisplayGeometry,
  vaultToGeometry,
} from '@muqarnas/render';
import {
  RisingVaultRig,
  ScrollTrigger,
  bindScrubbedScene,
  createScene5,
  createScene7,
  gsap,
  makePlanLines,
} from '@muqarnas/scenes';

/**
 * The scroll piece: scene 5 (the lift) and scene 7 (the same plan, twice).
 * Reading-agnostic throughout — A defaults to the regular-centre reading,
 * B to Harb's, with graceful fallbacks.
 */

const say = (t: string) => {
  document.querySelector('#load-status')!.textContent = t;
};
const el = (sel: string) => document.querySelector<HTMLElement>(sel)!;

const PLATE_SYMMETRIES = [0, 2, 4, 6].flatMap((k) => [
  Iso.rotation(k),
  Iso.reflection(2).then(Iso.rotation(k)),
]);
const openCentre = (a: Pt, b: Pt) => {
  const [ax, ay] = a.toNumbers();
  const [bx, by] = b.toNumbers();
  return !(Math.hypot(ax, ay) < 4.3 && Math.hypot(bx, by) < 4.3);
};

async function buildReading(
  plan: ReturnType<typeof takhtPlateFull>,
  solution: TierSolution,
  label: string,
) {
  say(`${label}: raising the vault…`);
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
    onProgress: (done, total) => say(`${label}: baking the light ${Math.round((100 * done) / total)}%`),
  });
  const display = toDisplayGeometry(welded);
  const rig = new RisingVaultRig(display, vault.tris);
  return { display, rig };
}

async function main() {
  const lenis = new Lenis({ autoRaf: false });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  say('solving the plate…');
  await new Promise((r) => setTimeout(r, 30));
  const plan = takhtPlateFull();
  const report = enumerateAssignments(plan, { maxFreeOrbits: 20, symmetries: PLATE_SYMMETRIES });
  const readingA =
    report.solutions.find((s) => s.graphReach === 17) ?? report.solutions[0]!;
  const readingB =
    report.solutions.find((s) => s.graphReach === 18) ??
    report.solutions.find((s) => s !== readingA) ??
    readingA;

  const a = await buildReading(plan, readingA, 'first reading');
  const b = await buildReading(plan, readingB, 'second reading');

  say('opening the stage…');
  const stage = await createVaultStage(el('#stage'));
  stage.controls.enabled = false;
  const material = plasterMaterial();
  const meshA = makeVaultMesh(a.display, material);
  const meshB = makeVaultMesh(b.display, material);
  meshB.visible = false;
  stage.scene.add(meshA, meshB);

  const planLines = makePlanLines(plan);
  stage.scene.add(planLines);

  const scene5 = createScene5(
    a.rig,
    stage,
    { captionA: el('#cap-a'), captionB: el('#cap-b') },
    { planLines },
  );
  bindScrubbedScene(el('#scene5-track'), (p) => {
    scene5(p);
    el('#hint').style.opacity = p > 0.02 ? '0' : '1';
  });

  const scene7 = createScene7(
    { rigA: a.rig, rigB: b.rig, meshA, meshB, planLines },
    stage,
    { captionA: el('#cap-7a'), captionB: el('#cap-7b'), captionC: el('#cap-7c') },
  );
  bindScrubbedScene(el('#scene7-track'), scene7);

  document.querySelector('#loader')!.classList.add('done');
}

void main().catch((err) => {
  say(`failed: ${err instanceof Error ? err.message : String(err)}`);
  console.error(err);
});
