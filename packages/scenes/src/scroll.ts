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
    end: 'bottom bottom',
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
 * A breath of black across a hard chapter cut: the veil rises to near-full
 * at the runway's middle and is gone at both ends, so neither scene ever
 * pops — it emerges. Bind one per runway that separates unlike spaces;
 * continuous seams need none.
 */
export function bindCutVeil(runway: HTMLElement, veil: HTMLElement): ScrollTrigger {
  return ScrollTrigger.create({
    trigger: runway,
    start: 'top bottom',
    end: 'bottom top',
    scrub: 0.25,
    onUpdate: (self) => {
      const tri = 1 - Math.abs(2 * self.progress - 1);
      veil.style.opacity = String(Math.min(1, Math.pow(tri, 1.4) * 1.15));
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
