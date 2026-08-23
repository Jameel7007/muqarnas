import { Color } from 'three';

/**
 * THE LIGHTING LANGUAGE — locked.
 *
 * Principle: a muqarnas hangs over an opening, so light never falls on it
 * from the sky. It enters from below — bounced off the courtyard as a
 * warm, ground-dominant ambience — and rakes in low through the opening as
 * one directional key that climbs into the cells and gives the geometry
 * its shadows. A faint cool fill from the opposite quarter keeps shadow
 * from going dead. Elevation is measured against the horizontal through
 * the vault's middle: NEGATIVE elevation means the key sits below it,
 * shining upward — the signature of the whole language.
 *
 * Three states, no more:
 *   rake  — the signature. Low warm key, dim ambience; cells carve deep.
 *           Scene 8's state: nothing moves except this key's azimuth.
 *   court — diffuse midday bounce. Ambience carries; the key only breathes.
 *           The reading state for geometry (scenes 4–6).
 *   ember — late light. Cooler ambience, redder and lower key. The state
 *           of the return.
 *
 * Forbidden, permanently: emissive anything, metalness, bloom, a sky-down
 * key. Occlusion is baked per vertex (measured against depth; screen-space
 * AO rejected) and enters through the plaster material, not the lights.
 *
 * v2 (2026-08-23, user direction): the states warmed for the painted
 * vault — hotter key, honeyed ground bounce, skies a touch cooler so the
 * warmth and the glaze both carry. The instruments, the three states, and
 * everything forbidden are unchanged.
 */

export interface LightingState {
  readonly name: string;
  readonly exposure: number;
  readonly hemisphere: { readonly sky: number; readonly ground: number; readonly intensity: number };
  readonly sun: {
    readonly color: number;
    readonly intensity: number;
    /** degrees CCW from +x, around the vault axis */
    readonly azimuthDeg: number;
    /** degrees above (+) / below (−) the horizontal through the vault middle */
    readonly elevationDeg: number;
  };
  readonly fill: { readonly color: number; readonly intensity: number };
}

export const LIGHTING: Record<'rake' | 'court' | 'ember', LightingState> = {
  rake: {
    name: 'rake',
    exposure: 1.15,
    hemisphere: { sky: 0x1b2130, ground: 0xcfa267, intensity: 0.55 },
    sun: { color: 0xffc37e, intensity: 3.2, azimuthDeg: 35, elevationDeg: -15 },
    fill: { color: 0x7f93ad, intensity: 0.15 },
  },
  court: {
    name: 'court',
    exposure: 1.05,
    hemisphere: { sky: 0x333c4e, ground: 0xdec09a, intensity: 1.45 },
    sun: { color: 0xffe9c2, intensity: 0.9, azimuthDeg: 20, elevationDeg: -8 },
    fill: { color: 0x8fa3bd, intensity: 0.3 },
  },
  ember: {
    name: 'ember',
    exposure: 1.0,
    hemisphere: { sky: 0x222839, ground: 0xa67a52, intensity: 0.4 },
    sun: { color: 0xff7f42, intensity: 2.5, azimuthDeg: 62, elevationDeg: -18 },
    fill: { color: 0x5d6d85, intensity: 0.12 },
  },
};

/** Unit offset from the target toward the sun for a given azimuth/elevation. */
export function sunOffset(sun: LightingState['sun']): [number, number, number] {
  const az = (sun.azimuthDeg * Math.PI) / 180;
  const el = (sun.elevationDeg * Math.PI) / 180;
  return [Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)];
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpColor = (a: number, b: number, t: number) =>
  new Color(a).lerp(new Color(b), t).getHex();
const lerpAngle = (a: number, b: number, t: number) => {
  let d = ((b - a + 540) % 360) - 180;
  return a + d * t;
};

/** Interpolate two states (shortest-arc on azimuth) — the scenes' transition tool. */
export function lerpLighting(a: LightingState, b: LightingState, t: number): LightingState {
  return {
    name: t < 0.5 ? a.name : b.name,
    exposure: lerp(a.exposure, b.exposure, t),
    hemisphere: {
      sky: lerpColor(a.hemisphere.sky, b.hemisphere.sky, t),
      ground: lerpColor(a.hemisphere.ground, b.hemisphere.ground, t),
      intensity: lerp(a.hemisphere.intensity, b.hemisphere.intensity, t),
    },
    sun: {
      color: lerpColor(a.sun.color, b.sun.color, t),
      intensity: lerp(a.sun.intensity, b.sun.intensity, t),
      azimuthDeg: lerpAngle(a.sun.azimuthDeg, b.sun.azimuthDeg, t),
      elevationDeg: lerp(a.sun.elevationDeg, b.sun.elevationDeg, t),
    },
    fill: {
      color: lerpColor(a.fill.color, b.fill.color, t),
      intensity: lerp(a.fill.intensity, b.fill.intensity, t),
    },
  };
}
