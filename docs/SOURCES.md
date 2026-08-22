# Sources and provisional readings

Primary sources (scans stay local, never committed):

1. Ghiyāth al-Dīn al-Kāshī, *Miftāḥ al-Ḥisāb* (1427), Book IV ch. 9.
2. Y. Dold-Samplonius, "Practical Arabic Mathematics: Measuring the Muqarnas
   by al-Kāshī," *Centaurus* 35 (1992), 193–242.
3. Y. Dold-Samplonius & S. Harmsen, "The Muqarnas Plate Found at Takht-i
   Sulaymān: A New Interpretation," *Muqarnas* 22 (2005), 85–94.
4. G. Necipoğlu, *The Topkapı Scroll* (1995), with al-Asad's essay.
5. S. Harmsen, *Algorithmic Computer Reconstructions of Stalactite Vaults —
   Muqarnas — in Islamic Architecture*, diss. Heidelberg (2006). Open access.

## Pinned by the spec / construction

- Element alphabet derivations (square, half-square, rhombus, half-rhombus,
  jug, large biped, almond, small biped) — constructed in
  `packages/plan/src/elements.ts`; areas and angle signatures tested exactly.
- Cell vs intermediate roles per element (al-Kāshī's distinction).
- Profile construction: 30° oblique, five parts, two fifths rotated down;
  factor = 1 − 4√3/15 ≈ 0.538120 per module at tier height = module.

## Provisional, awaiting source extraction

| Item | Current reading | Needs |
| --- | --- | --- |
| Roof curve between facet top and crown corner | circular arc, horizontal tangent at the crown (a vertical start tangent provably overshoots the tier top) | the drawn curve per Dold-Samplonius 1992 |
| al-Kāshī's own factor value | — | sexagesimal value from Centaurus 1992, as an oracle fixture |
| Surface-area method (facets, roofs, per element, flat & curved) | facet = rib × factor implemented implicitly; roofs by mesh only | his coefficients + a worked example → the al-Kāshī oracle test |
| Tier heights of the four types | curved: 1 module; simple lift defaults tierHeight 1, facetHeight ½ | measured ratios |
| Half-rhombus bisection diagonal | short diagonal (45/67.5/67.5 triangle) | Harmsen's catalogue |
| Barley kernel | typed, not constructed | its measured definition |
| Which plan edges are drawn as arcs, and their circles | jug/large-biped flagged (unit circle at the corner works exactly); almond unit sides flagged; all rendered straight | the drawing convention per the plate and Harmsen |
| Takht-i Sulaymān quarter plan | not yet encoded — the demo grid vault stands in | element-by-element layout from source 3 / Harmsen ch. |
| Tier assignment validity rules (support, adjacency, closure) | grid demo hand-assigned | Harmsen's formal rules → `enumerateAssignments` |
