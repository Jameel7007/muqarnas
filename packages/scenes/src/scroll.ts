import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Scroll plumbing: one scrubbed progress per scene track. The canvas stays
 * fixed; each scene owns a tall track element whose traversal maps to
 * p ∈ [0,1], smoothed slightly so plaster never jitters.
 */
export function bindScrubbedScene(
  track: HTMLElement,
  onProgress: (p: number) => void,
): ScrollTrigger {
  const proxy = { p: 0 };
  let latest = 0;
  const apply = () => onProgress(proxy.p);
  const st = ScrollTrigger.create({
    trigger: track,
    start: 'top top',
    // scrub to the track's very exit, so between scenes only the runway is
    // dead time — a held frame of 160vh was most of what read as "choppy"
    end: 'bottom top',
    scrub: 0.5,
    onUpdate: (self) => {
      latest = self.progress;
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
 * A breath of black across a hard chapter cut. The critical property is
 * ALIGNMENT: the world switch happens the instant the next scene's track
 * begins, so the veil must be at full black exactly there — it rises
 * through the outgoing scene's last stretch, holds across the runway and
 * the switch, and falls only inside the incoming scene. (The first cut of
 * this veil peaked mid-runway and had already fallen by the switch: the
 * old frame faded back in and the new one popped — the "disappears, comes
 * back, then jumps" the design review caught.)
 */
export function bindCutVeil(runway: HTMLElement, veil: HTMLElement): ScrollTrigger {
  const zone = () => window.innerHeight * 0.14;
  return ScrollTrigger.create({
    trigger: runway,
    start: () => runway.offsetTop - zone(),
    end: () => runway.offsetTop + runway.offsetHeight + zone(),
    scrub: 0.2,
    onUpdate: (self) => {
      const s = self.scroll();
      const z = zone();
      const rise = Math.min(1, Math.max(0, (s - (runway.offsetTop - z)) / z));
      const fall = Math.min(
        1,
        Math.max(0, (runway.offsetTop + runway.offsetHeight + z - s) / z),
      );
      const o = Math.min(rise, fall);
      veil.style.opacity = String(o * o * (3 - 2 * o));
    },
    onLeave: () => {
      veil.style.opacity = '0';
    },
    onLeaveBack: () => {
      veil.style.opacity = '0';
    },
  });
}

export { gsap, ScrollTrigger };
