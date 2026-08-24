# The lighting language — LOCKED

Locked 2026-08-22, before any scene work, per the build order. Changes to
this language after this point are scene bugs, not taste.

## Principle

A muqarnas hangs over an opening. Light never falls on it from the sky; it
enters from below — bounced off the courtyard as a warm, ground-dominant
ambience, and raking in low through the opening as a single directional
key that climbs into the cells. Elevation is measured against the
horizontal through the vault's middle; the key's elevation is **negative**
in every state. That inversion is the signature of the whole language.

## Instruments (exactly three)

1. **Hemisphere** — ground warm and bright, sky cool and dim. The courtyard.
2. **Key** — one shadow-casting directional, low and warm, aimed at the
   vault middle. Soft PCF shadows (radius 4, 2048px). Its azimuth is the
   only animated light parameter in the piece: scene 8 is this azimuth
   moving and nothing else.
3. **Fill** — faint, cool, from the opposite quarter and above, so shadow
   never goes dead. It whispers; if you can point at it, it is too loud.

Tone mapping AgX; exposure belongs to the state, not the scene.

## States (exactly three) — `LIGHTING` in `packages/render/src/lighting.ts`

- **rake** — the signature. Dim ambience (0.55), strong low key (3.0 at
  −15°). One flank of the funnel blazes, the far side holds cool depth;
  the cells carve. Scene 8's state.
- **court** — diffuse midday bounce. Ambience carries (1.45), the key only
  breathes (0.85). Everything legible: the state for reading geometry
  (scenes 4–6 register).
- **ember** — late light. Ambience down to 0.4, key copper and lowest
  (−18°). The vault sinks to darkness with light on its outermost edges.
  The state of the return.

Transitions between states use `lerpLighting` (shortest-arc azimuth).

## Surface

One material: plaster (`plaster.ts`). Rough dielectric (0.92 ± noise),
zero metalness, double-sided. The baked per-vertex occlusion enters twice:
as the standard AO term and as a cavity tint in the albedo. Two scales of
MaterialX noise drift albedo (±5%) and roughness — hand-floated plaster,
not injection moulding.

## Occlusion

**Baked per-vertex AO is the answer**; screen-space AO is rejected (muddy
at cell depth, as the spec predicted). Cosine-hemisphere rays against a
BVH, distance-attenuated, deterministic by seed. Measured behaviour on the
crown-group fixture: open rim ≈ 0.73, funnel interior ≈ 0.46, deep pockets
≈ 0.25 — occlusion tracks concavity depth, and the tests assert it.
Geometry note: the lift's windings face the solid; `vaultToGeometry` flips
them so normals face the intrados. Every consumer of lift meshes must go
through that adapter.

## Forbidden, permanently

Emissive anything. Metalness. Bloom. A sky-down key. Museum-object orbit
as a default camera (the default stance is beneath, looking up).

## Left open, deliberately

- An environment/probe term, only if a scene proves the three instruments
  insufficient — it must not change the states' character.
- Crown treatment (the crown element does not exist yet).
- Per-scene exposure ramps ride on top of, never inside, the states.

---

## v2 — the painted vault (2026-08-23)

At the user's direction the piece gained its colour. Two changes, both
documented here so the lock stays honest:

1. **The states warmed.** Hotter key, honeyed ground bounce, skies a
   touch cooler so the warmth carries by contrast. Same three states,
   same instruments, same negative elevation, same list of forbidden
   things.
2. **The glaze.** Takht-i Sulaymān's cells wore fired colour. The curved
   canopy (the lift's `roof` triangles) now carries a turquoise wash
   that sinks to cobalt-teal in its cavities and sits glossier than the
   plaster around it, so the low key answers off the bowls with sheen.
   It is colour and roughness only — still a dielectric, no metalness,
   no emissive. Facets, bands, and walls stay bare plaster.

## v2.2 — the day moves the sun (2026-08-24)

Scene 8's rule, restated at the user's direction: nothing moves except
THE SUN. The azimuth still walks its full turn; the elevation now
climbs with it — low blades at morning and evening, higher at noon,
returning exactly to the rake's own elevation at both ends so the
handoffs stay seamless. The key never rises above the horizontal:
light still never falls on a muqarnas from the sky.
