# A misfit of 5 − 3.5√2 in the Takht-i Sulaymān muqarnas plate

**Muhammad Jameel** · 26 August 2026
Repository: <https://github.com/Jameel7007/muqarnas> · Text: CC BY 4.0

## Summary

The muqarnas design incised on the thirteenth-century gypsum plate from
Takht-i Sulaymān is known to contain a few figures that are not built from the
regular element alphabet: Dold-Samplonius and Harmsen record "some semi-regular
quadrangles and isosceles triangles along the diagonal" (2005, 89). They do not
say how much irregularity those figures carry.

This note measures it. Taken as regular elements, the 157 elements of the
quarter design tile a region spanning exactly

$$7 + 3.5\sqrt{2} \;=\; \tfrac{7}{2}\,(2+\sqrt{2}) \;\approx\; 11.949747 \text{ modules,}$$

while the drawn field is an integer 12 modules square. The semi-regular figures
therefore absorb exactly

$$\Delta \;=\; 12 - \left(7 + 3.5\sqrt{2}\right) \;=\; 5 - 3.5\sqrt{2} \;\approx\; 0.0502525 \text{ modules,}$$

which at the published module of 3.5 cm is **about 1.8 mm** — 0.42% of the
field, roughly the width of the incised line itself. The semi-regularity is
not free-hand imprecision distributed over the drawing. It is a single
determinate quantity, absorbed in one band, and it is exactly the amount by
which this arrangement of √2-valued content fails to fill an integer field.

## 1. The plate

The plate is a stucco/gypsum slab about 50 cm across, found in the ruins of the
Il-Khanid palace at Takht-i Sulaymān and dated before ca. 1276. It carries the
plane projection of one quarter of a muqarnas vault: the earliest known
muqarnas design. The sides of its squares and rhombi, and the legs of the
isosceles right triangles along the frame, all measure 3.5 cm; that length is
the design's module. A 12-module field is therefore 42 cm, which sits inside
the 50 cm plate with a border.

The design is symmetric about a diagonal, and its angles are multiples of 45°
apart from the semi-regular figures noted above.

## 2. What is already published, and what is not

Already published, and not claimed here:

- the existence of semi-regular quadrangles and isosceles triangles along the
  diagonal (Dold-Samplonius & Harmsen 2005, 89; Harmsen 2006, §1.1.3);
- the module of 3.5 cm and the 45° angle system;
- the reading of the design used here, due to Harb (1978) and reproduced as
  Harmsen's fig. 5.17(a), with the inner lines of the diagonal hexagons
  normalized to standard elements.

Not found in those sources, and offered here: any quantification of the
irregularity — the span of the regular content, the size of the residual, or
the identification of the residual as a single exact quantity.

## 3. The measurement

Element geometry is generated, not traced: each element is constructed from the
two seeds (the unit square and the 45° rhombus) in exact arithmetic over ℚ(√2),
on the coordinate module (ℤ + ℤ·(√2/2))². The plate's *arrangement* — which
element sits where, at what orientation — is digitized from the vector line work
of Harmsen fig. 5.17(a), snapped to that lattice, and stored as a kind and an
isometry rather than as vertices.

Composing the 157 placements of the quarter and taking the extent of their
union gives, exactly and in both axes:

| quantity | exact | decimal (modules) | at 3.5 cm |
| --- | --- | --- | --- |
| regular content, quarter span | 7 + 3.5√2 | 11.949747468 | 41.82 cm |
| drawn field, quarter span | 12 | 12 | 42 cm |
| residual Δ | 5 − 3.5√2 | 0.050252532 | 1.76 mm |

The subtraction is trivial once the span is known; the content of the note is
the span. The factorization 7 + 3.5√2 = (7/2)(2 + √2) is offered as arithmetic,
not as a claim about the designer's method.

## 4. Why this is a misfit and not imprecision

Two independent observations argue that Δ is a structural residual rather than
drawing error.

**It is localized, not distributed.** Extracting the faces of the incised
subdivision and attempting to classify each as an alphabet element leaves
**29 of 156 faces unclassifiable**. Shortening a single band of vertices — the
bent band running seam → central star → wall, and its mirror — by exactly Δ
along each axis reduces the unclassifiable faces to **one**, and that one is the
separately documented hexagon whose drawn diagonal is missing. A free-hand
error would not concentrate in one band, and would not be removed by one rigid
translation of one exact amount.

**It is forced by the content.** The quantity 7 + 3.5√2 is irrational; 12 is
not. A design whose regular content spans the first and whose frame is drawn at
the second cannot close. The designer had three options — redraw the frame,
change the element count, or absorb the difference — and the plate shows the
third. The semi-regular quadrangles are where the absorption happens.

## 5. What this does and does not license

It licenses a modest methodological conclusion for reconstruction: a
reconstruction that takes the incised coordinates literally will inherit a
1.8 mm inconsistency and will not tile exactly, whereas one that regularizes —
collapsing the band by Δ — closes with zero tolerance. The reconstruction in
this repository takes the second course, and its tiling closure and projection
identity are consequently tested with equality rather than with an epsilon.

It does **not** license a conclusion about the built vault. Prefabricated
muqarnas elements excavated at the site are regular, and it is tempting to read
them as evidence that the executed plan was the regularized one. Harmsen is
explicit that the excavated elements need not correspond to this plate at all,
and whether the design was ever executed is unknown. The regularization argued
for here is a property of the drawing and of any reconstruction from it, not a
finding about a building.

Nor does it impute intent. That the design absorbs Δ in one band is a
measurement. Whether the designer knew the field could not close, and chose
where to hide the difference, is not something the plate can be made to say.

## 6. Reproducing this

The source scan is not part of the repository. The lattice-snapped segments the
digitizer read are published as `docs/data/takht-plate-segments.json` — exact
`a + b·(√2/2)` pairs — so the placements can be regenerated with no scan
present:

```bash
node tools/digitize-plate.mjs docs/data/takht-plate-segments.json \
  packages/plan/src/takht-plate-data.ts
```

Continuous integration runs exactly this on every push and fails if the result
differs by a byte. The span above is computed from `PLATE_FIELD_SPAN` in
`packages/plan/src/takht.ts` and is asserted in the plan test suite.

## 7. Limits

The element census of the quarter — 157 elements: 61 squares, 90 rhombi, 2 jugs,
4 half-rhombi — is *this* digitization's reading of Harmsen's figure, not a
count stated in the published literature. The reading of the design is Harb's,
and it reaches this work secondhand through Harmsen and Dold-Samplonius; Harb
(1978) has not been consulted directly. A different reading of the plate's
disputed centre could change the census, and in principle the span; the residual
reported here is therefore conditional on this reading, though the semi-regular
band it concerns lies away from the contested centre.

## References

- Y. Dold-Samplonius and S. Harmsen, "The Muqarnas Plate Found at Takht-i
  Sulaymān: A New Interpretation," *Muqarnas* 22 (2005), 85–94.
- S. Harmsen, *Algorithmic Computer Reconstructions of Stalactite Vaults —
  Muqarnas — in Islamic Architecture*, PhD thesis, Universität Heidelberg, 2006.
- U. Harb, *Ilkhanidische Stalaktitengewölbe: Beiträge zu Entwurf und
  Bautechnik*, Archäologische Mitteilungen aus Iran, Ergänzungsband 4 (Berlin:
  Dietrich Reimer, 1978). Not consulted directly.
- Y. Dold-Samplonius, "Practical Arabic Mathematics: Measuring the Muqarnas by
  al-Kāshī," *Centaurus* 35 (1992), 193–242.

## Cite as

> Muhammad Jameel, "A misfit of 5 − 3.5√2 in the Takht-i Sulaymān muqarnas
> plate," *Muqarnas: the vault from its plan* (2026).
> https://github.com/Jameel7007/muqarnas/blob/main/docs/notes/plate-misfit.md
