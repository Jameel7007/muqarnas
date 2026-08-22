# muqarnas

A scroll-driven 3D rendering of the stalactite vault, generated from its plan.
Successor to *From the Point*.

- Spec: [docs/SPEC.md](docs/SPEC.md)
- `packages/plan` — pure TS. The 2D element alphabet, tiling, and plan generation.
  Exact arithmetic over ℚ(√2): tiling closure and projection identity are tested
  with equality, not epsilons.
- `packages/lift` — pure TS. Plan + tier assignment → watertight 3D mesh.
- `site` — Vite app. Currently the inspection/debug page.

```
npm install
npm test
npm run dev
```

Primary sources are cited in [docs/SOURCES.md](docs/SOURCES.md). Scans of the
sources stay local and are never committed.
