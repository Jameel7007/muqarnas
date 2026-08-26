import './style.css';
import Lenis from 'lenis';
import type { BufferGeometry, Object3D } from 'three';
import { PLATE_FIELD_SPAN, takhtPlateFull } from '@muqarnas/plan';
import {
  enumerateAssignments,
  liftVault,
  type LiftedTriangle,
  type TierSolution,
} from '@muqarnas/lift';
import {
  bakeVertexAO,
  createVaultStage,
  decodeBakedReading,
  makeVaultMesh,
  plasterMaterial,
  toDisplayGeometry,
  vaultToGeometry,
  withPaintAttribute,
} from '@muqarnas/render';
import {
  BAKED_FILES,
  LIFT_OPTS,
  PLATE_SYMMETRIES,
  PREBAKE_PARAMS,
  RECIPE_HASH,
  pickReadings,
} from './recipe.js';
import {
  RisingVaultRig,
  ScrollTrigger,
  bindCutDissolve,
  bindScrubbedScene,
  createScene1,
  createScene2,
  createScene3,
  createScene4,
  createScene5,
  createScene6,
  createScene7,
  createScene8,
  createScene9,
  createCoda,
  gsap,
  makePlanLines,
  makeScene1Objects,
  makeScene2Objects,
  makeScene3Objects,
  makeScene4Objects,
  makeScene9Objects,
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
const rule = (frac: number) => {
  el('#load-rule i').style.width = `${Math.round(100 * Math.min(1, Math.max(0, frac)))}%`;
};

/**
 * Display geometry + rig from a welded, occluded geometry — the shared
 * tail of both paths. Paint first: it parts the double walls a hair
 * along their normals, and the rig must snapshot the parted positions.
 */
function finishReading(welded: BufferGeometry, tris: readonly LiftedTriangle[]) {
  const display = toDisplayGeometry(welded);
  withPaintAttribute(display, tris);
  const rig = new RisingVaultRig(display, tris);
  return { display, rig };
}

/**
 * The fast path: versioned pre-baked assets from the build (see
 * scripts/prebake.ts). Any mismatch — missing file, foreign schema,
 * stale recipe hash — returns null and the site computes live instead.
 */
async function loadBaked(key: keyof typeof BAKED_FILES) {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}${BAKED_FILES[key]}`);
    if (!res.ok) return null;
    return decodeBakedReading(await res.arrayBuffer(), RECIPE_HASH);
  } catch {
    return null;
  }
}

async function buildReadingLive(
  plan: ReturnType<typeof takhtPlateFull>,
  solution: TierSolution,
  label: string,
  ruleBase: number,
) {
  say(`${label}: raising the vault…`);
  await new Promise((r) => setTimeout(r, 30));
  const vault = liftVault(plan, solution.faces, LIFT_OPTS);
  const welded = vaultToGeometry(vault);
  await bakeVertexAO(welded, {
    ...PREBAKE_PARAMS.ao,
    onProgress: (done, total) => {
      say(`${label}: baking the light`);
      rule(ruleBase + (0.46 * done) / total);
    },
  });
  return finishReading(welded, vault.tris);
}

async function main() {
  const lenis = new Lenis({ autoRaf: false });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  say('drawing the plate…');
  await new Promise((r) => setTimeout(r, 30));
  const plan = takhtPlateFull();

  say('unrolling the vaults…');
  rule(0.2);
  const [bakedA, bakedB] = await Promise.all([loadBaked('a'), loadBaked('b')]);
  let a: ReturnType<typeof finishReading>;
  let b: ReturnType<typeof finishReading>;
  if (bakedA && bakedB) {
    rule(0.85);
    a = finishReading(bakedA.welded, bakedA.tris);
    b = finishReading(bakedB.welded, bakedB.tris);
  } else {
    // missing or stale assets: solve, lift, and bake live — slower, but
    // always correct, and the only path the inspection pages ever use
    say('solving the plate…');
    await new Promise((r) => setTimeout(r, 30));
    const report = enumerateAssignments(plan, { maxFreeOrbits: 20, symmetries: PLATE_SYMMETRIES });
    const readings = pickReadings(report.solutions);
    rule(0.05);
    a = await buildReadingLive(plan, readings.a, 'first reading', 0.05);
    b = await buildReadingLive(plan, readings.b, 'second reading', 0.51);
  }

  say('opening the stage…');
  rule(1);
  const stage = await createVaultStage(el('#stage'));
  // the canvas is one long moving image; the piece's text lives in the
  // sr-only transcript, so the canvas needs only a name, not narration
  const canvas = el('#stage').querySelector('canvas');
  if (canvas) {
    // OrbitControls sets `touch-action: none` on its canvas even while the
    // controls are disabled. Because this canvas covers the viewport, that
    // blocks the browser's native one-finger scroll gesture on phones.
    // Keep vertical touch panning native; horizontal drags still reach the
    // controls when the coda enables them.
    canvas.style.touchAction = 'pan-y';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute(
      'aria-label',
      'Animated three-dimensional rendering of a muqarnas vault being raised from its plan; the full narration is provided as text on this page.',
    );
  }
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

  const s4 = makeScene4Objects(plan);
  stage.scene.add(s4.group);

  const s9 = makeScene9Objects();
  stage.scene.add(s9.group);
  el('#cap-4b-n').textContent = String(s4.quarterCount);
  el('#cap-4d-n').textContent = String(plan.placed.length);

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
    four: {
      objects: [s4.group] as Object3D[],
      caps: caps('#cap-4a', '#cap-4b', '#cap-4c', '#cap-4d'),
    },
    five: { objects: [meshA, planLines] as Object3D[], caps: caps('#cap-a', '#cap-b') },
    six: {
      objects: [meshA, planLines] as Object3D[],
      caps: caps('#cap-6a', '#cap-6b', '#cap-6c'),
    },
    seven: {
      objects: [meshA, meshB, planLines] as Object3D[],
      caps: caps('#cap-7a', '#cap-7b', '#cap-7c'),
    },
    eight: { objects: [meshB] as Object3D[], caps: caps('#cap-8a', '#cap-8b', '#cap-8c') },
    nine: {
      objects: [meshB, planLines, s9.group] as Object3D[],
      caps: caps('#cap-9a', '#cap-9b', '#cap-9c'),
    },
    coda: { objects: [meshB] as Object3D[], caps: caps('#cap-10', '#coda-panel') },
  };
  const everything = [s1.group, s2.group, s3.group, s4.group, meshA, meshB, planLines, s9.group];
  const allCaps = Object.values(worlds).flatMap((w) => w.caps);
  const show = (world: { objects: Object3D[]; caps: HTMLElement[] }) => {
    for (const o of everything) o.visible = world.objects.includes(o);
    for (const c of allCaps) {
      if (!world.caps.includes(c)) {
        c.style.opacity = '0';
        // interactive overlays (the coda's light bar) must not linger as
        // invisible click targets over other scenes
        c.style.pointerEvents = 'none';
      }
    }
  };

  const scene1 = createScene1(s1, stage, {
    captionA: el('#cap-1a'),
    captionB: el('#cap-1b'),
    captionC: el('#cap-1c'),
  });
  // the frontispiece: title, definition, a breath of history — drifting
  // away as the first drawing begins
  bindScrubbedScene(el('#intro-track'), (p) => {
    const fade = 1 - Math.min(1, Math.max(0, (p - 0.12) / 0.55));
    const intro = el('#intro');
    intro.style.opacity = String(fade * fade * (3 - 2 * fade));
    intro.style.transform = `translateY(${-4.5 * (1 - fade)}rem)`;
    el('#hint').style.opacity = p > 0.04 ? '0' : '1';
  });

  bindScrubbedScene(el('#scene1-track'), (p) => {
    show(worlds.one);
    scene1(p);
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

  const scene4 = createScene4(s4, stage, {
    captionA: el('#cap-4a'),
    captionB: el('#cap-4b'),
    captionC: el('#cap-4c'),
    captionD: el('#cap-4d'),
  });
  bindScrubbedScene(el('#scene4-track'), (p) => {
    show(worlds.four);
    scene4(p);
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

  a.display.computeBoundingBox();
  const scene6 = createScene6(
    { rig: a.rig, crownZ: a.display.boundingBox!.max.z, planLines },
    stage,
    { captionA: el('#cap-6a'), captionB: el('#cap-6b'), captionC: el('#cap-6c') },
  );
  el('#cap-6c-n').textContent = String(a.rig.maxTier);
  bindScrubbedScene(el('#scene6-track'), (p) => {
    show(worlds.six);
    scene6(p);
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

  const scene8 = createScene8({ rig: b.rig }, stage, {
    captionA: el('#cap-8a'),
    captionB: el('#cap-8b'),
    captionC: el('#cap-8c'),
  });
  bindScrubbedScene(el('#scene8-track'), (p) => {
    show(worlds.eight);
    scene8(p);
  });

  const scene9 = createScene9({ rig: b.rig, planLines }, s9, stage, {
    captionA: el('#cap-9a'),
    captionB: el('#cap-9b'),
    captionC: el('#cap-9c'),
  });
  bindScrubbedScene(el('#scene9-track'), (p) => {
    show(worlds.nine);
    stage.controls.enabled = false;
    scene9(p);
  });

  // the coda: the vault in the viewer's hands — drag turns it, scroll
  // still scrolls
  const coda = createCoda({ rig: b.rig }, stage, {
    caption: el('#cap-10'),
    hint: el('#drag-hint'),
    panel: el('#coda-panel'),
    light: el('#coda-light') as HTMLInputElement,
  });
  bindScrubbedScene(el('#coda-track'), (p) => {
    show(worlds.coda);
    stage.controls.enabled = true;
    coda(p);
  });

  // a cross-dissolve across each hard chapter cut: the frozen outgoing
  // frame melts into the incoming scene, no black anywhere
  const dissolve = el('#dissolve') as HTMLCanvasElement;
  for (const runway of document.querySelectorAll<HTMLElement>('.runway.cut')) {
    bindCutDissolve(runway, dissolve, (target, onDone) => stage.captureFrame(target, onDone));
  }

  // Every chapter and runway is sized in vh. Keep a snapshot of the last
  // stable layout so an orientation change can retain the same track and
  // normalized progress instead of reinterpreting the old absolute scrollY
  // against the new viewport height.
  type TrackLayout = { track: HTMLElement; top: number; height: number };
  const measureTracks = (): TrackLayout[] =>
    Array.from(document.querySelectorAll<HTMLElement>('.track')).map((track) => ({
      track,
      top: track.offsetTop,
      height: track.offsetHeight,
    }));
  let stableLayout = measureTracks();
  let resizeAnchor: { track: HTMLElement; progress: number } | null = null;
  let resizeReady = false;
  window.setTimeout(() => {
    stableLayout = measureTracks();
    resizeReady = true;
  }, 600);
  const rememberScrollPosition = () => {
    if (!resizeReady || resizeAnchor || stableLayout.length === 0) return;
    const scroll = lenis.scroll;
    const layout =
      stableLayout.find(({ top, height }) => scroll >= top && scroll < top + height) ??
      stableLayout.reduce((nearest, candidate) => {
        const distance = Math.min(
          Math.abs(scroll - candidate.top),
          Math.abs(scroll - candidate.top - candidate.height),
        );
        return distance < nearest.distance ? { layout: candidate, distance } : nearest;
      }, { layout: stableLayout[0]!, distance: Number.POSITIVE_INFINITY }).layout;
    resizeAnchor = {
      track: layout.track,
      progress: Math.min(1, Math.max(0, (scroll - layout.top) / Math.max(1, layout.height))),
    };
  };
  let resizeTimer: number | undefined;
  const settleResize = () => {
    if (!resizeReady) {
      lenis.resize();
      ScrollTrigger.refresh();
      stableLayout = measureTracks();
      return;
    }
    rememberScrollPosition();
    if (resizeTimer !== undefined) window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      lenis.resize();
      ScrollTrigger.refresh();
      if (resizeAnchor) {
        const { track, progress } = resizeAnchor;
        const target = track.offsetTop + track.offsetHeight * progress;
        lenis.scrollTo(target, { immediate: true });
        ScrollTrigger.update();
      }
      stableLayout = measureTracks();
      resizeAnchor = null;
      resizeTimer = undefined;
    }, 160);
  };
  window.addEventListener('resize', settleResize, { passive: true });

  // ResizeObserver updates the camera projection after the browser's own
  // resize event. Settle once more from that exact point so framing and the
  // narrative position use the same final viewport.
  stage.onResize(settleResize);

  // the page opens on scene 1's first frame regardless of bind order
  show(worlds.one);
  scene1(0);

  document.querySelector('#loader')!.classList.add('done');
}

void main().catch((err) => {
  say(`failed: ${err instanceof Error ? err.message : String(err)}`);
  console.error(err);
});
