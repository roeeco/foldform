# Foldform Studio

A focused prototype of a parametric packaging dieline editor. Project parameters are stored in integer micrometres and drive the semantic scene, sheet fit, and every export.

## Prototype capabilities

- Six working parametric recipes: tuck-end carton, crash-lock carton, auto-lock bottom, two-piece box with lid, match box / tray-and-sleeve, and cake-slice box
- Shared lock-bottom treatment with explicit fixed/collapse faces, diagonal folds, pre-glue regions, and optional hook cuts
- Reusable rectangular tray kernel with deterministic glue-corner tabs, corner relief, face topology, and fold graphs
- Generic convex-profile tray kernel with semantic walls and corner tabs, used by a uniformly offset triangular cake-slice lid
- Material- and clearance-compensated mating lid and sleeve geometry
- Controllable tuck-end carton with straight/reverse end assignment
- Separate closing panels, rounded tuck tongues, receiving edges, thumb notches, dust flaps, slit locks, and angled glue flaps
- Board-caliper-aware shoulders and flap clearances
- Exact metric, decimal-inch, and mixed-fraction measurement input
- Clickable and draggable on-dieline dimensions
- Constraint diagnostics with no silent correction of typed values
- Single-command undo/redo for dimension drags
- Deterministic 600 × 400 mm, 700 × 500 mm, and custom production-sheet fitting
- Semantic cut, crease, and glue layers
- SVG, vector PDF, DXF, PNG, and versioned project JSON exports
- Local autosave and responsive editor layout
- Analytic SVG/DXF arcs plus scene integrity and randomized geometry tests
- Face-and-fold template kernel with reusable topology families and component manifests

See [Template engine architecture](docs/template-engine.md) for the multi-template model and extension sequence.

## Development

```bash
npm install
npm run dev
```

Validate with:

```bash
npm test
npm run lint
npx tsc --noEmit
```
