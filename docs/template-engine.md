# Foldform template engine architecture

This note translates the configuration patterns observed across [TemplateMaker](https://www.templatemaker.nl/) into a reusable Foldform geometry architecture. The reference site is used to understand product families and parameters; its generated geometry and source code are not copied.

## The common ground

Every template can be described as four layers:

1. **Finished form** — a profile or surface plus its height/depth.
2. **Net topology** — named faces connected by hinges, possibly across several parts.
3. **Edge treatments** — glue seams, tucks, dust flaps, locks, gussets, overlaps, notches, and corner joins attached to named edges.
4. **Manufacturing policy** — material compensation, clearance, score allowance, kerf, sheet packing, and export roles.

This keeps finished dimensions independent from the layout of the net. A template recipe chooses a topology generator and edge treatments; it does not hand-author one monolithic SVG path.

## Topology families

| Kernel family | Templates | Shared generator |
|---|---|---|
| Panel band | Tuck-end, gift box, shallow box, crash-lock, auto-lock | Unroll a profile perimeter into wall panels; attach top/bottom closure components and one seam |
| Tray + cover | Box with lid, two-piece box, cake-slice box | Start with an arbitrary base profile; offset/scale for lid clearance; attach walls and corner joins |
| Tray + sleeve | Match box, tray and sleeve | Reuse a tray and wrap its compensated outer profile with an open-ended panel band |
| Gusseted band | Bag | Extend a panel band with paired mountain/valley folds and a bottom-fold treatment |
| Planar wrap | Envelope | Attach overlapping flaps to the edges of one central profile |
| Curved band | Pillow pack | Build a two-panel band and attach paired analytic arc-score closures |
| Developable shell | Cone/frustum | Analytically develop a ruled surface into an annular sector and attach a seam |
| Tapered shell | Trapezoid box | Develop trapezoidal wall faces between distinct top and bottom profiles |

The “coming soon” names should therefore not become separate engines:

- **Two-piece box** is a rectangular `tray-cover` recipe.
- **Tray and sleeve** is the same `tray-sleeve` implementation as a match box.
- **Crash-lock** and **auto-lock bottom** are bottom edge treatments on the existing rectangular `panel-band` shell.

## Observed configuration model

The useful pattern in the reference configurations is the split between a small set of primary finished dimensions and optional construction parameters.

| Template | Primary dimensions | Construction parameters that belong in components |
|---|---|---|
| Box with lid | length, width, base height, lid height | clearance, glue-flap size/angle |
| Bag | length, width, height | gusset fold, glue flap |
| Cone | top diameter, bottom diameter, height | seam size/angle |
| Envelope | width, height | overlap, corner radius |
| Gift box | length, width, height | thumb hole, tuck, glue seam, material, radius |
| Match box | length, width, height | material, clearance, glue seam |
| Pillow pack | length, width, crown height | seam, thumb hole, curved score closures |
| Shallow box | length, width, height | dust flap, tuck, glue seam, material |
| Trapezoid box | top/bottom length and width, height | tuck, dust flap, glue seam, radius, material |
| Cake slice | radial length, angle, height | clearance, thumb hole, glue seam |

Document settings such as sheet size, margins, perforation style, resolution, and output format are not template parameters. They remain project/export concerns shared by every recipe.

## Generation algorithm

```text
validate project parameters
        ↓
resolve manufacturing context
  (caliper, score allowance, kerf, clearance)
        ↓
build finished-form profile/surface
        ↓
generate named faces for the selected topology family
        ↓
connect faces with a fold graph
        ↓
attach edge-treatment components to named edges
        ↓
apply material and mating-part compensation
        ↓
emit semantic cut/crease/glue paths and editable anchors
        ↓
run topology + geometry + closure constraints
        ↓
pack one or more parts on the selected sheet
        ↓
render/export views from the same scene
```

## Integrity rules

- Every part, face, fold, edge treatment, path, anchor, and dimension has a deterministic semantic ID.
- A fold must connect two existing faces and have a non-zero shared edge.
- Each face must be a non-degenerate polygon before offsetting or export.
- Edge treatments reference semantic edges, never anonymous coordinates.
- Multi-part mating geometry is derived from one nominal profile plus material/clearance rules.
- Mountain and valley folds remain semantically distinct for gussets even if a specific export profile renders both as crease lines.
- Analytic arcs remain analytic for pillow closures, notches, and frustum developments.
- Net overlap, closure feasibility, minimum flap size, and sheet fit are separate validation stages with named diagnostics.

## Extension sequence

1. **Shipped:** generic panel-band and closure-component contracts using the tuck carton.
2. **Shipped:** reusable rectangular glue-corner trays composed into box-with-lid and match-box/tray-sleeve recipes.
3. **Shipped:** alternative crash-lock and hooked auto-lock bottom treatments on the existing carton band, including diagonal collapse faces and pre-glue semantics.
4. **Shipped:** convex profile trays generalized from rectangles to triangular cake-slice base/lid parts with a uniform material-and-clearance offset.
5. Add tapered profiles, gusset folds, and curved/developable surface modules as independent topology strategies.

This order maximizes reuse while keeping every shipped template physically testable.
