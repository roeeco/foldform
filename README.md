# Foldform Studio

A focused prototype of a parametric packaging dieline editor. Project parameters are stored in integer micrometres and drive the semantic scene, sheet fit, and every export.

## Prototype capabilities

- Straight tuck box template with stable manufacturing path IDs
- Exact metric, decimal-inch, and mixed-fraction measurement input
- Clickable and draggable on-dieline dimensions
- Constraint diagnostics with no silent correction of typed values
- Single-command undo/redo for dimension drags
- Deterministic A4, A3, and Letter sheet orientation fitting
- Semantic cut, crease, and glue layers
- SVG, vector PDF, DXF, PNG, and versioned project JSON exports
- Local autosave and responsive editor layout
- Scene integrity and randomized geometry tests

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
