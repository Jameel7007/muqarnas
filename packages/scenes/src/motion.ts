/**
 * prefers-reduced-motion: the piece is scroll-driven, so most of its motion
 * is the user's own hand — what must go is the motion the page adds on top:
 * the scrub's catch-up tween (frames keep moving after the hand stops) and
 * the coda's self-driving orbit.
 */
export const prefersReducedMotion = (): boolean =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
