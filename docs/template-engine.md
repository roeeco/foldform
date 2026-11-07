# Foldform template engine architecture

This note translates the configuration patterns observed across [TemplateMaker](https://www.templatemaker.nl/) into a reusable Foldform geometry architecture. The reference site is used to understand product families and parameters; its generated geometry and source code are not copied.

## The common ground

Every template can be described as four layers:

1. **Finished form** — a profile or surface plus its height/depth.
2. **Net topology** — named faces connected by hinges, possibly across several parts.
3. **Edge treatments** — glue seams, tucks, dust flaps, locks, gussets, overlaps, notches, and corner joins attached to named edges.
4. **Manufacturing policy** — material compensation, clearance, score allowance, kerf, sheet packing, and export roles.

This keeps finished dimensions independent from the layout of the net. A template recipe chooses a topology generator and edge treatments; it does not hand-author one monolithic SVG path.

## Reusable tray wall strategies

Every convex-profile tray can select one of three wall strategies without changing its finished profile:

- **Single wall / quick fold** — one wall face per profile edge with a glued corner tab. This uses less board and minimizes assembly steps.
- **Fold-over glue / simple reinforced** — the same material-compensated outer wall, rim bridge, and returned inner wall as the locking construction. The returned liner glues over the corner flap and first wall, so it has no terminal tuck tab, locking tab, or receiving-slot cut.
- **Fold-over lock / reinforced** — an outer wall, a rim bridge derived from two board calipers plus score allowance, a compensated returned inner wall, adaptive tapered locks, and closed receiving apertures sized to board caliper plus slot clearance. Wider edges use two locks; narrow compatible edges use one centered lock.

The strategies are shared by rectangular trays, match-box trays, and triangular cake-slice base/lid parts. Future convex tray profiles inherit the same options automatically. Returned-liner glue zones remain semantic geometry; locking tabs are named faces with explicit fold connections; lock slots are closed internal-cut apertures whose short dimension follows board caliper plus clearance.

Corner glue tabs are bounded before they are emitted. Their root reach is capped by the wall height and the adjacent profile edge, while the outer reach is shortened from the selected glue-flap angle. This prevents a nominal tab depth from crossing the neighboring wall and gives acute tabs more relief than steep tabs. Validation reports the same computed safe maximum used by the generator, so warnings and geometry cannot disagree.

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

### Bag, envelope, and pillow-pack recipes

The bag is a four-panel `gusseted-band`: side, face, side, face, plus one square glue seam. The user-facing **Fold** parameter is an optional top reinforcement return and may be zero. Side gusset depth is derived from half the finished bag depth; it is not an independent construction input. The bottom depth is half the face width and carries paired face diagonals, side-panel center folds, and a seam relief fold. These relationships let the erected bag open square and collapse flat without asking the user to coordinate redundant dimensions.

The envelope is a `planar-wrap`: one finished-size central face with independent side, bottom, and cover flaps attached to named edges. The two side flaps cross by the configured overlap after folding. The bottom and cover reaches divide the finished height plus overlap, the bottom flap owns the two glue regions that capture the side flaps, and four analytic tip fillets form one continuous outer-cut profile.

The pillow pack is a two-panel `curved-band`. Its end scores use exact circular arcs derived from the panel-width chord and crown sagitta:

```text
arc radius = chord² / (8 × sagitta) + sagitta / 2
```

The arcs remain analytic through fitting, rendering, SVG, and DXF export; they are not sampled polylines.

## Centered rectangular-frustum development

The trapezoid-box recipe is the first `tapered-shell` implementation. It treats the top and bottom as independently sized, centered rectangles and derives the net rather than skewing rectangular panels:

```text
length offset = (bottom length - top length) / 2
width offset  = (bottom width - top width) / 2

front/rear wall slant = hypot(vertical height, width offset)
left/right wall slant = hypot(vertical height, length offset)
lateral corner edge   = hypot(vertical height, length offset, width offset)
```

The bottom face and four trapezoidal walls are explicit topology faces. Four corner glue tabs attach to developed lateral edges. A full closing panel and tuck tongue attach to the rear top edge, a notched receiving edge remains on the front, and tapered dust flaps attach to the side walls. Every hinge is represented in the fold graph, and closure, corner-tab, slope, and top-opening constraints remain separate named diagnostics.

The “coming soon” names should therefore not become separate engines:

- **Two-piece box** is a rectangular `tray-cover` recipe.
- **Tray and sleeve** is the same `tray-sleeve` implementation as a match box.
- **Crash-lock** and **auto-lock bottom** are bottom edge treatments on the existing rectangular `panel-band` shell.

## Observed configuration model

The useful pattern in the reference configurations is the split between a small set of primary finished dimensions and optional construction parameters.

| Template | Primary dimensions | Construction parameters that belong in components |
|---|---|---|
| Box with lid | length, width, base height, lid height | clearance, glue-flap size/angle |
| Bag | face length, side width, height | optional top reinforcement fold, glue flap; side gusset and bottom depth are derived |
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
4a. **Shipped:** selectable glued fold-over and fold-over locking walls as shared tray construction strategies for rectangular and triangular profiles.
5a. **Shipped:** centered rectangular-frustum development for trapezoid boxes, with derived slant geometry, explicit corner joins, dust flaps, and a tuck-top closure.
5b. **Shipped:** gusseted bag bands, planar envelope wraps, and pillow packs with analytic circular closure scores.
5c. Add conical/developable surface modules and specialized gift/shallow-box closure variants.

This order maximizes reuse while keeping every shipped template physically testable.
