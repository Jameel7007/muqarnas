import './style.css';
import Lenis from 'lenis';
import type { Object3D } from 'three';
import { Iso, PLATE_FIELD_SPAN, takhtPlateFull, type Pt } from '@muqarnas/plan';
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
  createScene1,
  createScene2,
  createScene3,
  createScene5,
  createScene7,
  gsap,
  makePlanLines,
  makeScene1Objects,
  makeScene2Objects,
  makeScene3Objects,
} from '@muqarnas/scenes';

/**
 * The scroll piece: scene 1 (the square and the circle), scene 5 (the
 * lift), scene 7 (the same plan, twice). Reading-agnostic throughout — A
 * defaults to the regular-centre reading, B to Harb's, with graceful
 * fallbacks. One fixed stage; each scene's track shows only its world.
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

  const s1 = makeScene1Objects(material, { half: PLATE_FIELD_SPAN.toNumber() });
  stage.scene.add(s1.group);

  const s2 = makeScene2Objects();
  stage.scene.add(s2.group);

  const s3 = makeScene3Objects(plan);
  stage.scene.add(s3.group);

  // the census, from the digitized plate itself
  const tally = (kind: string) => plan.placed.filter((q) => q.def.kind === kind).length;
  el('#cap-3d-total').textContent = String(plan.placed.length);
  el('#cap-3d-sq').textContent = String(tally('square'));
  el('#cap-3d-rh').textContent = String(tally('rhombus'));
  el('#cap-3d-hr').textContent = String(tally('half-rhombus'));
  el('#cap-3d-jug').textContent = String(tally('jug'));

  // each track shows only its scene's world — objects and captions — before
  // the scene runs, so the scenes' own toggles (mesh swaps, ink fades,
  // caption spans) still win within it. Captions must be swept because a
  // track past its end stops updating and would hold its last caption
  // forever.
  const caps = (...sels: string[]) => sels.map(el);
  const worlds = {
    one: { objects: [s1.group] as Object3D[], caps: caps('#cap-1a', '#cap-1b', '#cap-1c') },
    two: {
      objects: [s2.group] as Object3D[],
      caps: caps('#cap-2a', '#cap-2b', '#cap-2c', '#cap-2d'),
    },
    three: {
      objects: [s3.group] as Object3D[],
      caps: caps('#cap-3a', '#cap-3b', '#cap-3c', '#cap-3d'),
    },
    five: { objects: [meshA, planLines] as Object3D[], caps: caps('#cap-a', '#cap-b') },
    seven: {
      objects: [meshA, meshB, planLines] as Object3D[],
      caps: caps('#cap-7a', '#cap-7b', '#cap-7c'),
    },
  };
  const everything = [s1.group, s2.group, s3.group, meshA, meshB, planLines];
  const allCaps = Object.values(worlds).flatMap((w) => w.caps);
  const show = (world: { objects: Object3D[]; caps: HTMLElement[] }) => {
    for (const o of everything) o.visible = world.objects.includes(o);
    for (const c of allCaps) if (!world.caps.includes(c)) c.style.opacity = '0';
  };

  const scene1 = createScene1(s1, stage, {
    captionA: el('#cap-1a'),
    captionB: el('#cap-1b'),
    captionC: el('#cap-1c'),
  });
  bindScrubbedScene(el('#scene1-track'), (p) => {
    show(worlds.one);
    scene1(p);
    el('#hint').style.opacity = p > 0.02 ? '0' : '1';
  });

  const scene2 = createScene2(s2, stage, {
    captionA: el('#cap-2a'),
    captionB: el('#cap-2b'),
    captionC: el('#cap-2c'),
    captionD: el('#cap-2d'),
    numerals: el('#cap-2c-num'),
  });
  bindScrubbedScene(el('#scene2-track'), (p) => {
    show(worlds.two);
    scene2(p);
  });

  const scene3 = createScene3(s3, stage, {
    captionA: el('#cap-3a'),
    captionB: el('#cap-3b'),
    captionC: el('#cap-3c'),
    captionD: el('#cap-3d'),
  });
  bindScrubbedScene(el('#scene3-track'), (p) => {
    show(worlds.three);
    scene3(p);
  });

  const scene5 = createScene5(
    a.rig,
    stage,
    { captionA: el('#cap-a'), captionB: el('#cap-b') },
    { planLines },
  );
  bindScrubbedScene(el('#scene5-track'), (p) => {
    show(worlds.five);
    scene5(p);
  });

  const scene7 = createScene7(
    { rigA: a.rig, rigB: b.rig, meshA, meshB, planLines },
    stage,
    { captionA: el('#cap-7a'), captionB: el('#cap-7b'), captionC: el('#cap-7c') },
  );
  bindScrubbedScene(el('#scene7-track'), (p) => {
    show(worlds.seven);
    scene7(p);
  });

  // the page opens on scene 1's first frame regardless of bind order
  show(worlds.one);
  scene1(0);

  document.querySelector('#loader')!.classList.add('done');
}

void main().catch((err) => {
  say(`failed: ${err instanceof Error ? err.message : String(err)}`);
  console.error(err);
});
