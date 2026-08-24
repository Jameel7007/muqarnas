import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Scroll plumbing: one scrubbed progress per scene track. The canvas stays
 * fixed; each scene owns a tall track element whose traversal maps to
 * p ∈ [0,1], smoothed slightly so plaster never jitters.
 */
import { prefersReducedMotion } from './motion.js';

export function bindScrubbedScene(
  track: HTMLElement,
  onProgress: (p: number) => void,
): ScrollTrigger {
  const reduced = prefersReducedMotion();
  const proxy = { p: 0 };
  let latest = 0;
  const apply = () => onProgress(proxy.p);
  const st = ScrollTrigger.create({
    trigger: track,
    start: 'top top',
    // scrub to the track's very exit, so between scenes only the runway is
    // dead time — a held frame of 160vh was most of what read as "choppy"
    end: 'bottom top',
    scrub: reduced ? true : 0.5,
    onUpdate: (self) => {
      latest = self.progress;
      if (reduced) {
        proxy.p = latest;
        apply();
        return;
      }
      gsap.to(proxy, {
        p: latest,
        duration: 0.16,
        overwrite: true,
        ease: 'none',
        onUpdate: apply,
      });
    },
    // a refresh (resize) re-fires every trigger in document order, letting a
    // past-end scene reassert its world over the active one — so the scene
    // that actually contains the scroll position reapplies itself last
    onRefresh: (self) => {
      if (self.isActive) {
        proxy.p = self.progress;
        latest = self.progress;
        apply();
      }
    },
  });
  onProgress(0);
  return st;
}

/**
 * A cross-dissolve across a hard chapter cut — no black anywhere. The
 * moment a scene's scrub freezes at the runway's edge, its frame is
 * snapshotted into the overlay (pixel-identical to the live canvas, so
 * the takeover is invisible); the world switch happens beneath the held
 * picture; and on the far side the picture dissolves into the incoming
 * scene, already live. Symmetric in both scroll directions: the snapshot
 * is taken entering the dead zone from either side, and the fade always
 * happens on the side being exited.
 */
export function bindCutDissolve(
  runway: HTMLElement,
  overlay: HTMLCanvasElement,
  capture: (target: HTMLCanvasElement, onDone: () => void) => void,
): ScrollTrigger {
  const fade = () => window.innerHeight * 0.3;
  let shown = false;
  let captured = false;

  return ScrollTrigger.create({
    trigger: runway,
    start: () => runway.offsetTop - fade(),
    end: () => runway.offsetTop + runway.offsetHeight + fade(),
    onUpdate: (self) => {
      const s = self.scroll();
      const top = runway.offsetTop;
      const bottom = top + runway.offsetHeight;
      if (s >= top && s <= bottom) {
        // the dead zone: both scenes frozen; hold the picture. The copy
        // lands a frame later (a WebGPU canvas is only readable in the
        // same task as its render), and the overlay waits for it —
        // showing pixels identical to the frame beneath, so the takeover
        // is invisible.
        if (!shown) {
          shown = true;
          captured = false;
          capture(overlay, () => {
            captured = true;
            if (shown) overlay.style.opacity = '1';
          });
        } else if (captured) {
          overlay.style.opacity = '1';
        }
      } else if (shown && captured) {
        // exiting: the held picture dissolves into the live scene
        const t = s > bottom ? (s - bottom) / fade() : (top - s) / fade();
        const o = Math.max(0, 1 - t);
        overlay.style.opacity = String(o * o * (3 - 2 * o));
        if (t >= 1) shown = false;
      }
    },
    onLeave: () => {
      overlay.style.opacity = '0';
      shown = false;
    },
    onLeaveBack: () => {
      overlay.style.opacity = '0';
      shown = false;
    },
  });
}

export { gsap, ScrollTrigger };
