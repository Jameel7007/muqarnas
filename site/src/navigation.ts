import { prefersReducedMotion } from '@muqarnas/scenes';

/**
 * NAVIGATION — the piece, addressable.
 *
 * A scroll piece with no landmarks cannot be linked to, resumed, or paged
 * through. Each act carries a stable slug (#iv-the-plan), the hash follows
 * the reader, and a rail on the right edge gives the argument a shape and a
 * length. The rail is a set of hairlines until the pointer approaches it —
 * chrome should not compete with the plaster.
 *
 * Keyboard: ↑/↓, PageUp/PageDown, Home/End move act to act, so the piece can
 * be read without a scroll wheel at all.
 */

export interface Act {
  readonly el: HTMLElement;
  readonly slug: string;
  readonly label: string;
  readonly numeral: string;
}

const NUMERALS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];

export interface NavigationOptions {
  /** Smooth scroller; jumps go through it so momentum stays consistent. */
  readonly scrollTo: (target: number, immediate: boolean) => void;
}

export function createNavigation(opts: NavigationOptions) {
  const acts: Act[] = Array.from(
    document.querySelectorAll<HTMLElement>('[data-act]'),
  ).map((el, i) => ({
    el,
    slug: el.dataset.slug ?? `act-${i}`,
    label: el.dataset.label ?? '',
    // the intro takes no numeral and the coda takes a mark, so the rail
    // reads I…IX exactly as the captions do
    numeral: el.dataset.slug === 'intro' ? '·' : el.dataset.slug === 'coda' ? '◆' : NUMERALS[i] ?? '·',
  }));
  if (acts.length === 0) return { destroy() {} };

  const rail = document.querySelector<HTMLElement>('#act-rail');
  const ticks = new Map<string, HTMLElement>();

  if (rail) {
    for (const act of acts) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'act-tick';
      b.dataset.slug = act.slug;
      b.setAttribute('aria-label', act.label || act.slug);
      b.innerHTML = `<span class="act-numeral" aria-hidden="true">${act.numeral}</span><i aria-hidden="true"></i>`;
      b.addEventListener('click', () => go(act));
      rail.append(b);
      ticks.set(act.slug, b);
    }
  }

  const topOf = (act: Act) => act.el.offsetTop;

  function go(act: Act) {
    opts.scrollTo(topOf(act), prefersReducedMotion());
    // announce immediately; the scroll handler would otherwise lag the jump
    mark(act.slug);
    history.replaceState(null, '', `#${act.slug}`);
  }

  function mark(slug: string) {
    for (const [s, el] of ticks) {
      const on = s === slug;
      el.classList.toggle('is-current', on);
      el.setAttribute('aria-current', on ? 'true' : 'false');
    }
  }

  /** The act containing the reader, by track extent. */
  function currentAct(): Act {
    const y = window.scrollY + window.innerHeight * 0.35;
    let found = acts[0]!;
    for (const act of acts) {
      if (y >= topOf(act)) found = act;
    }
    return found;
  }

  let last = '';
  let queued = false;
  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      const act = currentAct();
      if (act.slug === last) return;
      last = act.slug;
      mark(act.slug);
      history.replaceState(null, '', `#${act.slug}`);
    });
  };

  const step = (delta: number) => {
    const i = acts.indexOf(currentAct());
    const next = acts[Math.min(acts.length - 1, Math.max(0, i + delta))];
    if (next) go(next);
  };

  const onKey = (e: KeyboardEvent) => {
    // never steal keys from the light slider, a button, or a text field.
    // (the target is not always an Element — a synthetic event can target
    // window — so test for Element before reaching for closest)
    const t = e.target;
    if (t instanceof Element && (t.closest('input, textarea, select, button') || t.closest('#viewer-ui'))) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    switch (e.key) {
      case 'ArrowDown': case 'PageDown': step(1); break;
      case 'ArrowUp': case 'PageUp': step(-1); break;
      case 'Home': go(acts[0]!); break;
      case 'End': go(acts[acts.length - 1]!); break;
      default: return;
    }
    e.preventDefault();
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('keydown', onKey);

  // honour a hash on arrival, once the tracks have their real heights
  const openAtHash = () => {
    const slug = location.hash.replace(/^#/, '');
    const act = acts.find((a) => a.slug === slug);
    if (act) opts.scrollTo(topOf(act), true);
    mark((act ?? currentAct()).slug);
  };

  const skip = document.querySelector<HTMLElement>('#skip-to-coda');
  const coda = acts.find((a) => a.slug === 'coda');
  if (skip && coda) skip.addEventListener('click', (e) => { e.preventDefault(); go(coda); });

  return {
    openAtHash,
    destroy() {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('keydown', onKey);
    },
  };
}
