# Sources and readings

Primary sources (scans stay local in `~/Code/muqarnas-sources/`, never committed):

1. Ghiyāth al-Dīn al-Kāshī, *Miftāḥ al-Ḥisāb* (1427), Book IV ch. 9 — via [2].
2. Y. Dold-Samplonius, "Practical Arabic Mathematics: Measuring the Muqarnas
   by al-Kāshī," *Centaurus* 35 (1992), 193–242. **Read.** Full translation of
   al-Kāshī's text and his numeric table.
3. Y. Dold-Samplonius & S. Harmsen, "The Muqarnas Plate Found at Takht-i
   Sulaymān: A New Interpretation," *Muqarnas* 22 (2005), 85–94. **Read.**
4. S. Harmsen, *Algorithmic Computer Reconstructions of Stalactite Vaults*,
   diss. Heidelberg (2006). **Extracted** (element formalism ch. 2, validity
   rules ch. 3, Takht-i Sulaymān ch. 5).
5. G. Necipoğlu, *The Topkapı Scroll* (1995) — pattern-book context only so far.

Detailed extraction notes with page citations: `muqarnas-sources/extraction-notes.md`.

## Pinned by the sources (implemented and tested)

- **Element alphabet** — al-Kāshī's own catalog (2005 paper p. 86) confirms
  every construction in `elements.ts`: jug = quarter octagon with
  *circumradius* = module; half-rhombus cut along the *short* diagonal;
  almond as built. Plans are straight-edged; curvature is vertical.
- **Central nodes, curved sides, diameters** (Harmsen Table 2.1) — each
  element's apex corner and its two module-length profile-carrying sides;
  diameters exact in ℚ(√2) (jug 1, almond 4−2√2, bipeds 2−√2 / 3−2√2).
- **The profile** (`profile.ts`) — the method of the masons in the 1×2
  rectangle (cell height = 2 modules, confirmed by the excavated cells):
  30° oblique, five parts, two fifths rotated about E; factor
  = 2 − (3/5)√3 ≈ 0.9607695 (al-Kāshī 0;57,38,43,14); 60° arc of radius
  exactly 4/5, tangent-continuous into the 30° ramp; foot-adjustment
  mechanism for vault fitting.
- **The measurement** (`measure.ts`) — taʿdīl = factor + half the curve
  ≈ 1.7260586 (al-Kāshī 1;43,33,45,41 = 1.726045); curved cells =
  Σ facet bases × coefficient with the four base values 1, √2/2, √2−1,
  2·sin 22.5°; his four curved-intermediate constants (underivable, encoded
  as given); simple type = facet bases × height + plane roof areas. His
  worked values are test fixtures; his plane-roof table equals our exact
  areas — a two-way validation.
- **Roles** — jug/almond cell-only; bipeds intermediate-only; square/rhombus
  either; halves both (with corpus notes in `elements.ts`).
- **Tier heights** — curved type: 2 modules (the element height); simple:
  facet ≈ 1 module, roof rise a fitting parameter; clay-plastered: unequal
  tier heights, some rooms roof-only.
- **The Takht-i Sulaymān quarter plan** (`takht.ts` + generated
  `takht-plate-data.ts`) — 157 elements (61 squares, 90 rhombi, 2 jugs,
  4 half-rhombi), digitized from the vector line work of Harmsen fig.
  5.17(a) by `tools/digitize-plate.mjs`, exact cover verified, area exactly
  61 + 47√2, symmetric about the diagonal. Two documented departures:
  (1) regularization — the incised design hides a misfit of Δ = 5 − 3.5√2
  ≈ 0.0503 modules (≈ 1.8 mm on the plate) in a bent band of semi-regular
  quadrangles through the central star; the regular field is 7 + 3.5√2, not
  12, and the excavated unit-regular cells argue the vault used the regular
  plan; (2) one diagonal hexagon completed as two rhombi by restoring its
  missing drawn edge at the "six rhombi join" removable node.

## Still open

| Item | State | Next |
| --- | --- | --- |
| Takht-i Sulaymān tier assignment | plan done (see above); DS&H's preferred 12-tier reading known in outline (2005 fig. 9 right; two removed diagonal nodes) | encode tiers once the graph solver exists |
| Curved (qawsī) lift | cell anatomy understood: two facets on backside edges, roof panels meeting over the diameter, sides = the profile | implement after the plate plan |
| Tier-assignment solver | Harmsen ch. 3 rules extracted (graph, acyclic heights, R1–R4, orbits = the ambiguity) | implement `enumerateAssignments` |
| Barley kernel | defined (kite, two opposite equal obtuse angles, short sides = module, diameter free) | construct parametrically with the curved lift |
| Rectangle element | named by al-Kāshī among simple-type cell bases; outside the Il-Khanid plan set | decide with the simple-type rework |
| Al-Kāshī's four intermediate constants | encoded as given; Dold-Samplonius could not derive them | our curved meshes may explain them — worth testing |
| DS 1996 "A Second Look" / 2003 surface-area paper | not obtained (paywalled) | optional refinements |
