# Foldform Studio

A focused prototype of a parametric packaging dieline editor. Project parameters are stored in integer micrometres and drive the semantic scene, sheet fit, and every export.

## Prototype capabilities

- Ten working parametric recipes: tuck-end carton, crash-lock carton, auto-lock bottom, two-piece box with lid, match box / tray-and-sleeve, cake-slice box, trapezoid box, gusseted bag, envelope, and pillow pack
- Shared lock-bottom treatment with explicit fixed/collapse faces, diagonal folds, pre-glue regions, and optional hook cuts
- Reusable rectangular tray kernel with deterministic glue-corner tabs, corner relief, face topology, and fold graphs
- Generic convex-profile tray kernel with semantic walls and corner tabs, used by a uniformly offset triangular cake-slice lid
- Selectable quick-fold, glued fold-over, or mechanically locked wall construction on rectangular and triangular trays
- Both reinforced modes include a material-compensated rim bridge and returned liner; the glue-wall mode bonds the liner over the corner join without a terminal tab, while the locking mode adds adaptive locks and closed caliper-matched base slots
- Angle-aware glue-tab safeguards cap reach against neighboring walls and taper the outer land from the selected glue angle
- Complete flat-folding bag recipe with optional top reinforcement return, depth-derived side gussets, face-width-derived diagonal bottom closure, and a continuous perimeter
- Rounded four-flap envelope wrap with controlled side overlap, bottom-flap glue regions, and one continuous analytic cut profile
- Rectangular-frustum development with independently controlled top/bottom profiles, true derived wall slants, glued corner joins, dust flaps, receiving notch, and tuck-top closure
- Material- and clearance-compensated mating lid and sleeve geometry
- Controllable tuck-end carton with straight/reverse end assignment
- Separate closing panels, rounded tuck tongues, receiving edges, thumb notches, dust flaps, slit locks, and angled glue flaps
- Board-caliper-aware shoulders and flap clearances
- Millimetre-native numeric input with inline 1 mm decrement/increment controls (0.1 mm for board caliper)
- Inspector measurements highlight their affected dieline geometry with a persistent face glow
- Constraint diagnostics with no silent correction of typed values
- Single-command undo/redo for parameter edits
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
