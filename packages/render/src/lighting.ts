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
    hemisphere: { sky: 0x1e222c, ground: 0xc4a87e, intensity: 0.55 },
    sun: { color: 0xffd9a0, intensity: 3.0, azimuthDeg: 35, elevationDeg: -15 },
    fill: { color: 0x7f93ad, intensity: 0.15 },
  },
  court: {
    name: 'court',
    exposure: 1.05,
    hemisphere: { sky: 0x353b47, ground: 0xd6c2a0, intensity: 1.45 },
    sun: { color: 0xfff1d8, intensity: 0.85, azimuthDeg: 20, elevationDeg: -8 },
    fill: { color: 0x8fa3bd, intensity: 0.3 },
  },
  ember: {
    name: 'ember',
    exposure: 1.0,
    hemisphere: { sky: 0x232733, ground: 0x9a7a5c, intensity: 0.4 },
    sun: { color: 0xff8e52, intensity: 2.4, azimuthDeg: 62, elevationDeg: -18 },
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
