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
    scrub: 0.35,
    onUpdate: (self) => {
      latest = self.progress;
      gsap.to(proxy, {
        p: latest,
        duration: 0.12,
        overwrite: true,
        ease: 'none',
        onUpdate: apply,
      });
    },
  });
  onProgress(0);
  return st;
}

export { gsap, ScrollTrigger };
