# The contract

What a conforming kernel promises for its booleans, constructions and queries, version 1.0.0. Each
clause has an id the runner's checks cite.

## Tolerance

A check's bound is written in terms of a linear tolerance ε, in mm: how far a kernel's geometry may
lie from exact. The suite's own tolerance is ε = 1e-7 mm, and a case passes when its checks hold
there. Each check is also read at looser tolerances, as [Tiers](#tiers) says, so a kernel built to a
looser one shows where it stands instead of only failing.

Every kernel is judged the same way, whatever tolerance it declares. An adapter sets each tolerance
its kernel offers to the suite's, 1e-7 mm, so that every kernel is asked for the same thing. A
tolerance that cannot be set that tight is set to the tightest the kernel supports.

In `hello` the adapter declares one tolerance: the loosest still governing the kernel's results. A
kernel that intersects at 1e-7 mm but builds its solids at 1e-5 declares 1e-5. It lists what it set
differently from the kernel's defaults in `configuration`. Both are reported beside the kernel's
results, as information, and no check reads them.

Geometry within ε of exact moves a volume by at most ε times the surface area, so a measured volume
meets its exact value within

    10 · ε · (area of both operands) + 1e-9 · (volume of both operands)

and a measured area within 1e-6 of its exact value, relative. The factor of 10 allows for the
kernel's own measuring error, so an adapter measures with the kernel's most accurate integration. A
default integration can be looser than these bounds: a fixed rule can measure 4e-4 of the volume off
on the spline faces of crossing cylinders, where an adaptive rule on the same faces meets them.

## Tiers

A tier is one of four tolerances: 1e-7, 1e-6, 1e-5 or 1e-3 mm. Results are counted at four levels:

| Level | What it is                                                 | Its result                                                |
| ----- | ---------------------------------------------------------- | --------------------------------------------------------- |
| Check | One comparison of the kernel's answer with what it must be | The tightest tolerance at which it holds                  |
| Case  | A few calls on one set of shapes, and the checks on them   | The loosest of its checks' tiers                          |
| Test  | A named group of cases, such as booleans of two boxes      | The count of its cases at each tier                       |
| Run   | Every case of the suite, on one kernel                     | The count of cases at each tier, and the share at 1e-7 mm |

A test's cases are drawn by one or more families: generators of cases of one kind, named in
[formats.md](formats.md#tests-and-case-ids). A failure spreads from a check to its own case and no
further. A case is one piece of geometry, and it is wrong if any check on it fails. A test and a run
only count their cases.

**A check** that weighs an error against a bound is judged at four tolerances: 1e-7, 1e-6, 1e-5 and
1e-3 mm. Its bound grows with the tolerance as the volume bound above does, and its tier is the
tightest of the four at which it holds. A check no tolerance decides, such as a result's validity,
its Betti numbers, a point placed on the wrong side or a refusal that was due, holds at every tier
or at none.

**A case** takes the loosest of its checks' tiers: one check that holds only at 1e-3 mm makes the
case 1e-3, however many of its others hold at 1e-7. A case with a check that holds at none fails. A
case that ends without an answer has no tier: it is unsupported, refused, timed out or crashed.

**A test** has no result of its own. Of a test's 60 cases, say, 59 at 1e-7 and one failed is
reported as that: one failed case does not fail the test.

**A run** counts its cases and never takes the loosest. It has one total over every case, of all
three kinds: exact, where the definition fixes one answer; sound, where it leaves the answer open
within limits; and rejection, where the input must be refused. In that total the headline is the
share of all cases whose tier is 1e-7. Of 20 cases with 19 at 1e-7 and one at 1e-3, the headline is
95%, and the one case shows in the count at 1e-3. A case of any other tier, a failed one and one
without an answer all count against the headline.

A failed check names what failed. One that weighed a measure against a bound is a failure of
measurement: the volume, area, moment or distance the kernel reported is off. One that weighed none
is a failure of geometry: the shape itself is wrong, by its points, its validity or its topology. A
case with any failure of geometry is reported as one.

## Outcomes

Each operation returns a valid result within the bounds, or refuses with a reason. A case's outcome
is the worst of its operations and checks:

| Outcome     | Meaning                                                                           |
| ----------- | --------------------------------------------------------------------------------- |
| pass        | Every operation completed and every check held at 1e-7 mm                         |
| unsupported | The kernel does not offer a function the case needs, or declined as unsupported   |
| refused     | An operation declined as invalid or failed; the checks that needed it are skipped |
| timeout     | An operation was still running at the time limit                                  |
| fail        | A check did not hold at 1e-7 mm: an invalid result, or a value outside its bound  |
| crash       | An operation panicked, or its worker died                                         |

A case that fails at 1e-7 mm may still hold at a looser tier. A results file records both: the
case's `outcome` is the verdict at 1e-7 mm. Its `result` names the tier it holds at, 1e-6, 1e-5 or
1e-3, and is fail only when a check holds at none of them. [formats.md](formats.md#results) gives
both fields.

They rank in that order, worst last: a refusal declines openly, a timeout never answers, a failed
check misleads, and a crash takes the operation down.

## Clauses

| Clause | Promise                                                                           |
| ------ | --------------------------------------------------------------------------------- |
| B0     | Each operand is the shape described: see below                                    |
| B1     | Every result is valid by the kernel's own checker, built operands among them      |
| B2     | Where a family knows them exactly, the intersection's volume and area meet them   |
| B3     | vol(A ∪ B) + vol(A ∩ B) = vol(A) + vol(B)                                         |
| B4     | vol(A ∖ B) + vol(A ∩ B) = vol(A), and the same for B                              |
| B5     | vol(A ∩ B) = vol(B ∩ A)                                                           |
| B6     | Moving both operands by one rigid motion leaves vol(A ∩ B) unchanged              |
| B7     | The operations leave their operands as they were                                  |
| B8     | vol(A ∩ B) meets the suite's own sampled estimate of it, within its bound         |
| B9     | The kernel's classifier places the suite's sample points as the exact operands do |
| B10    | Each primitive operand's centroid and inertia meet their closed forms             |
| B11    | Moments add up as volumes do in B3 and B4                                         |
| B12    | A ∩ B's moments meet the sampled estimate, and move with a rigid motion           |
| B13    | distance meets its exact value, agrees both ways round, and survives a motion     |
| B14    | A fillet or chamfer gives the blended solid: its volume, area and moments         |
| B15    | The kernel places sample points as the blended solid holds them                   |
| B16    | Blending the moved solid at the moved points gives the result moved               |
| B17    | A result written as STEP and read back is valid, with its volume, area, moments   |
| B18    | An input the functions do not allow is refused                                    |
| B19    | Betti numbers meet the ones the case knows                                        |
| B20    | The same intersection asked for twice is the same to the last bit                 |
| B21    | A plane section's area meets the suite's sampled estimate                         |
| B22    | A STEP file the suite writes reads as the solid it describes                      |
| B23    | A mesh is closed, faces outward, and bounds the volume within its tolerance       |
| B24    | A solid with itself: union and intersection give it back, difference nothing      |
| B25    | A similarity, mirrors included, moves the solid and scales its volume and area    |
| B26    | A ray's crossings meet the suite's own march along the ray                        |
| B27    | Interference finds exactly an assembly's clashing pairs, their volumes and gaps   |
| B28    | A boolean of many solids meets its closed form and the booleans one at a time     |
| B29    | A part joined to its mirror image meets its closed form                           |
| B30    | Normals at boundary points meet the exact normals, and are null at a crease       |
| B31    | A fillet meets its faces smoothly; a chamfer or an unblended corner is a crease   |
| B32    | A stretch or shear maps the solid: volume, moments and points exactly, area bound |
| B33    | A solid's bounding box is the least box round it                                  |
| B34    | A split's pieces are valid, hold its volume, and each its side's points           |
| B35    | A plane section's curves lie on the plane and boundary, and have their length     |
| B36    | Loose faces sew back into the solid they bound                                    |
| B37    | Principal curvatures meet their closed forms at the nearest boundary point        |
| B38    | A hidden-line drawing lies on the seen and hidden edges and covers them           |
| B39    | By its seams a curvature-continuous blend bends as what it meets does             |
| B40    | The solid's nearest point to a point is a point of it, as near as the closed form |
| B41    | A point of the boundary is on it; a point clear of it is in or out as it is held  |
| B42    | A display closes the solid with its normals exact, and draws exactly its creases  |

Sound cases ([process.md](process.md#two-kinds-of-test)) check limits instead of one answer, under
their own clauses. They count in the one total with every other case:

| Clause | Promise                                                                              |
| ------ | ------------------------------------------------------------------------------------ |
| Q1     | The kernel completes the act                                                         |
| Q2     | Its own checker finds the result valid                                               |
| Q3     | The result has the pieces, tunnels and voids it must                                 |
| Q4     | Outside the zone the definition leaves open, the result's volume is exact            |
| Q5     | The result's volume lies between the results at the act's largest and smallest sizes |
| Q6     | The blend meets its faces tangentially where it must touch them                      |
| Q7     | A loft passes through its sections: their outlines on its boundary, their areas cut  |
| Q8     | By its seams a curvature-continuous blend bends as what it meets does                |
| Q9     | The result holds none of the points the definition takes away                        |
| Q10    | Point for point, the result holds what every acceptable one holds and no more        |
| Q11    | Across the blend the boundary has no crease                                          |
| Q12    | Across a curvature-continuous blend the curvature carries on without a jump          |
| Q13    | The result is unchanged by the motions that leave the case unchanged                 |

Q10 to Q13 read the result itself, where Q5 bounds only its volume:

- **Q10, point for point.** The suite samples the case's open zone, or the base's box where it has
  none, at 8192 points of the shifted Halton sequence. It sets aside the points the limits leave
  open and asks the kernel to classify the rest. Each point every acceptable result holds must be
  held, and each that none holds must not. One point placed differently is allowed, as B9 allows
  one.
- **Q11, no crease.** The suite casts a round grid of parallel rays, 24 across, at the blend, and
  asks for the normal where each first meets the result. Where two neighbouring rays' normals differ
  by more than 0.1 rad it casts the ray between them, and so on. The surface is smooth there if the
  halves come to agree. It has a crease if two points closer than a thousandth of the blend's
  smallest radius still differ by that much, which no surface bending less than a hundred times as
  tightly as the blend does.
- **Q12, no jump in curvature.** The same scan with the principal curvatures. A jump is a change of
  more than a quarter of one over the radius within a hundredth of the radius.
- **Q13, symmetry.** Every ray of the grid is moved by each motion the case names and cast again. It
  must stop where it did, within a thousandth of the radius. A case names the motions that leave its
  solid and its named edges as they were within the grid: the swaps of a square corner's three edges
  blended alike, and the mirror in the plane between two faces, two arms or two sides that are alike
  there.

Three rules go with them:

- A point where the kernel gives no normal, as it gives none on an edge, is no crease by itself. It
  is halved round like any other.
- A kernel that gives no normal at more than a fiftieth of the grid's points fails Q11.
- Q11 to Q13 are skipped for a kernel that offers no `raycast` or no `normal`. Q12 fails a kernel
  with no `curvature`, as Q8 does.

Which tests carry them:

| Test                                         | Q10's limits                                                                                                                         | Q11                         | Q12 | Q13                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- | --- | ---------------------------------------------------------------- |
| `chamfers/three-distances-at-a-corner`       | Within the box chamfered at the smallest distance. Holds the box chamfered at the largest, except in the corner's cube of that side  | No                          | No  | No                                                               |
| `fillets/three-radii-at-a-corner`            | Between the box filleted at the largest radius and at the smallest, each closed by its ball                                          | Yes                         | No  | No                                                               |
| `fillets/concave-meets-convex-corner`        | Holds the prism less a `2r` box along each convex edge. Within the prism plus a `2r` box in the concave edge                         | Yes                         | No  | The mirror between its two arms                                  |
| `fillets/set-back-corner`                    | Between the fillets with the corner's cube removed and with it left sharp                                                            | Yes                         | No  | The five swaps of the corner's edges                             |
| `fillets/g2-set-back-corner`                 | The same, with the curvature-continuous section                                                                                      | Yes                         | Yes | The same                                                         |
| `fillets/top-loop-bigger-than-corner-rounds` | Holds the union of balls. Within the prism less the ordinary fillet along each straight run                                          | Yes, at each loop corner    | No  | Each corner's mirror, where its sides run straight past the scan |
| `fillets/variable-radius`                    | At each height, between the edge filleted at the least and the greatest radius the ball has within its largest radius of that height | Yes                         | No  | The mirror between the edge's two faces                          |
| `constructions/smooth-loft-through-sections` | None                                                                                                                                 | Yes, four scans of its side | No  | No                                                               |

A primitive operand meets B0 when its volume and area meet their closed forms, so B0 is also the
contract for the constructions that make primitives from a profile: an extrusion holds area times
height; a revolution and a screw hold the profile's first moment about the axis times the angle
(Pappus; a screw's rise moves the profile within its own plane, sweeping no volume); a ruled loft
between a profile and its copy scaled by s holds h·A·(1 + s + s²)/3. Areas of screwed and lofted
sides are integrals the suite evaluates by Gauss quadrature to well inside the bound.

A built operand, a boolean of other operands, meets B0 when its volume meets the suite's sampled
estimate within B8's bound; failing to build one makes the case refused.

B8 and B9 need no kernel to know the answer. The suite tests membership in each exact primitive
itself and samples the box both operands' boxes share at 4096 points of a Halton sequence shifted by
irrational amounts. B8 allows five standard errors of a random sample of that size, two points'
share of the box, and the volume bound. B9 allows one point placed differently. B8 catches a wrong
volume, whether from the geometry or from measuring it; B9 catches wrong geometry alone.

Every clause that asks the kernel where sample points lie treats its classifier the same way. A
kernel that offers no `classify`, or refuses the call as `unsupported`, is not asked, and the check
is left out. A kernel that offers one and gives no answer for a solid, by refusing as `failed` or
`invalid`, running out of time or crashing, fails the check: a result whose points the kernel cannot
place has not been shown to be the right solid.

Membership follows each definition in [api.md](api.md). A profile's region is tested by winding
number, exactly for lines and arcs and from a fine polygon for a spline. A revolved point is in when
its angle lies in `[0, angle]` and its `(ρ, w)` in the region; a screwed one when, at some turn
`φ ≤ angle` congruent to its angle, `(ρ, w − rise·φ)` is; a lofted one when `(u/σ, v/σ)` is, at its
height. Membership in a boolean follows from its operands'.

### Moments and distance

B10 to B12 judge `centroid` and `inertia` through the raw moments they give, `∭ r dV` and
`∭ r rᵀ dV` about the world origin, which add over pieces as volume does. Every primitive's are
exact: each kind is an extrusion, revolution, screw or loft of a profile, whose moments reduce to
the profile's area moments by Green's theorem and one integral along the sweep. Geometry within ε
moves a first moment by at most the volume bound times `R`, and a second by it times `R²`, where `R`
is the farthest any point of either operand lies from the origin; those are the bounds. B12's
sampled estimate allows five standard errors per component, as B8 does.

B13 allows `10·ε + 1e-9·R`. A family states the exact distance where it knows it: zero for operands
that overlap or touch, and the gap for the `separated` family. Wherever the sample finds a point in
both operands, the distance must be zero. Distance to an empty solid is undefined, so the suite does
not ask for it.

## Results that touch

A boolean's result is the regularized set operation: the closure of the interior of the set result.
Its separate pieces may touch at points or along curves, as the two halves of a cylinder cut by an
equal one crossing it square touch at two points, and such a result is valid (B1). Pieces sharing an
area of face are one solid, since that area is interior to the regularized result, and must be
returned merged. A piece may touch itself too, as a block with a bore flush to one face does along
that line. A piece passing into another, or into itself, is invalid. How the kernel holds the
contact, as an edge or vertex several faces share or as copies of it, is its own; the Betti numbers
are the point set's, so pieces that only touch are one piece. A kernel that refuses a touching
result scores refused, not pass.

STEP's solids are manifold, so a touching result is written as the manifold boundary of its
interior: each piece a solid of its own, each side of a contact with its own vertices and edges, as
exchange files are commonly written. A file's solids are one part's shape, so an adapter reads them
back as their union, which is the result again (B17).

### Blends and exchange

A fillet or chamfer case blends edges of a prism or of a cylinder's or cone's rims, and names the
solid it must give: the prism on the profile with those corners rounded or cut, or the revolution of
the meridian with them rounded or cut. B14 to B16 judge the result against that solid's closed forms
and membership, as B0, B9 and B6 do for primitives. B17 sends a ∪ b of every pair case, and every
blend's result, through the kernel's own STEP writer and reader.

### How the later clauses are tested

How each of these clauses is tested. A clause not listed here is checked as its row above says:

- **B18, refusals.** The kernel is handed an input [api.md](api.md#refusals) rules out, and passes
  only when it refuses. The faults are in the shape itself, as a profile that crosses itself, or in
  one number, as a radius of zero, or in a point that names no edge or face.
- **B19, Betti numbers.** Asked where the case knows them: from a primitive's kind, a drilled
  plate's holes, a solid inside a box, two solids apart, the union of two that touch (one piece), a
  bore flush to a face (a tunnel).
- **B20, repeatability.** `a ∩ b` is asked for twice in one worker, and the volumes and areas are
  compared bit for bit.
- **B21, section area.** `a ∩ b` is cut by the plane through the middle of its sample box, square to
  a direction drawn from the case. The area is compared with a sampled estimate over that plane,
  within five standard errors and two points' share.
- **B23, meshes.** `a ∩ b` is meshed within 0.01 mm, and its volume may differ by twice that times
  its area: twice what `mesh` promises, to allow for the kernel's own measuring.
- **B24, a solid with itself** (`self-booleans`). A primitive is combined with itself, the one
  handle as both operands. It has a family of its own, so that a kernel that refuses the pair does
  not lose every other boolean.
- **B25, similarities** (`transforms`). Half the cases are rigid motions and a quarter each scaled
  and mirrored. It has a family of its own, so that a kernel without one does not lose every other
  case.
- **B26, rays.** A ray is cast through `a ∪ b` from outside its box. The suite sorts the meetings
  the kernel lists, reads those within `10·ε` of each other as one crossing, and compares the
  crossings with its own march along the ray, bisected to 1e-12 of its length. Families whose
  features may be thinner than a step of the march, or touch, are left out.
- **B27, assemblies** (`assemblies`). The suite makes each part on its frame moved to where the part
  stands, and asks [`interference`](api.md#interference) about one pair at a time, leaving out the
  pairs whose bounding balls are farther apart than the clearance. A pair clashes where the kernel's
  answer has a volume above 0, or a gap below the clearance.
- **B32, stretches and shears** (`stretches`). [`affine`](api.md#affine) maps: a third stretched
  along axes by unequal factors, a third also sheared, a third also mirrored. The volume, moments
  and placed points have closed forms. The area has none, so it must lie between the singular-value
  bounds.
- **B33, bounding boxes** (`bounding-boxes`). The box round turned boxes, cylinders, frustums, balls
  and rings, alone or joined. A primitive's least box has a closed form, and a union's is the box
  round both.
- **B34, splits** (`splits`). Any primitive is cut through the middle of its box at a slant. The
  pieces' volumes must add up to the solid's, and every sample point must lie in the piece for its
  side.
- **B35, sections** (`sections`). A ball, a cylinder's side, a box, or a ring is cut level or
  through its axis. Each section is circles, an ellipse or a convex polygon. The suite joins the
  pieces the kernel returns end to end, ends within `10·ε` of each other one point, and an end that
  meets no other fails the case. Every point must lie within ten times the tolerance of the plane
  and the boundary. Chords may fall short of the curves' length by at most `s/(3ρ)` of it, where `s`
  is the chord tolerance and `ρ` the least radius of curvature.
- **B36, sewing** (`sewing`). A prism's faces are written as loose open shells, shifted along their
  normals by up to 1e-4 mm, a quarter of them inside out, and sewn within 2e-3 mm. The volume may
  move by at most the shift times the area.

- **B40, nearest points** (`nearest-points`, `nearest-in-holes`). [`closest`](api.md#closest) on a
  turned box, cylinder, frustum, ball or ring, from points all about it, inside and out, and on its
  axis beyond each end, where a ball has its poles and a cone its apex. Each answer must lie on the
  solid and be as far from its point as the closed form says. Where the nearest point is not the
  only one, any of them passes. In a block drilled through, from points in the hole, the nearest
  point is the one point of the hole's wall straight out from the axis, and the answer must be it.
- **B41, points on the boundary** (`boundary-points`). [`classify`](api.md#classify) on a turned
  primitive, at points of its faces, edges and rims, and a hundredth of a millimetre to either side
  of a face. The first are `"on"`; the others `"in"` and `"out"`.
- **B42, displays** (`displays`). [`display`](api.md#display) of a box, a cylinder, a ball or a
  drilled box, within 0.01 mm. The faces, joined, must close with every edge used once each way
  round, and bound the volume within twice the tolerance times the area. Every vertex must lie
  within 1e-5 of the solid's size of one of its surfaces, with that surface's outward normal there
  to within 1e-3, and every triangle must face the way its normals do. The edges are held as B38
  holds a drawing, in space: every vertex on a crease, every chord within the tolerance of one,
  every crease covered, and no more length than the creases have. A ball has no crease, and a
  cylinder's seam is none.

The face edits `delete_faces`, `move_faces` and `thicken` are features: B14 to B16 judge each result
as the primitive it must be. `sweep_path` is a constructor: B0 to B13 judge it, and its closed forms
are integrals along the path.

### STEP

B22 hands the kernel a STEP file the suite itself writes, a prism of planar faces in AP214, and
judges what it reads against the prism: valid, with its volume and area, placing the sample points
as the prism does. The file's meaning comes from the format, not from another kernel. B17 sends a
kernel's own output back through its own reader, which a kernel can pass while writing files no
other reader understands.

Run with `--peer`, a second kernel reads what the first writes. Whether it reads the solid the
suite's sample describes is reported as interop, apart from the score: a mismatch may be either
kernel's, so it judges neither.

### What an adapter may do

**An adapter answers each function with the kernel's one call for it, or the function is
unsupported.** It never composes one function from others, and never decides: a threshold, a vote
between answers, a retry with other settings and a repair of the result are decisions. A split made
from booleans with a half-space would score the booleans twice and credit a split the kernel does
not have.

**`unsupported` means one thing: the kernel has not built this.** Not the function, or not the
function for arguments of this sort, as a mirror in a kernel that only moves solids rigidly. An
input that has no answer is `invalid`. A call that should have worked and did not is `failed`.

A kernel may well reach the same answer another way: a section's area from a boolean with a
half-space, a ray's crossings by firing again from each one, a distance by classifying a point after
the solve. Kernels differ in how they are built, as browsers do, and that is no fault. But a suite
can only compare kernels on functions they have in the same shape. An adapter that builds the
missing function out of others is then a second, untested kernel standing in for the first, and its
results say nothing about either. So such a function is `unsupported`, each adapter says in a line
why, and the kernel is judged on what it offers directly.

Four things an adapter does are not the kernel's call, and are allowed. There are no others:

1. **Translating form.** A profile's segments as the kernel's curves, a frame as its placement, a
   path as its spine, a curve the kernel returns sampled into points, a split's solids sorted by
   side, a solid the kernel builds at the origin moved onto its frame.
2. **Addressing a point.** A point that names an edge or a face is turned into the kernel's own
   address for it, the nearest entity and its parameters there, through the kernel's distance query
   at the contract's `10·ε` and no number of the adapter's own. Where a kernel answers on one face
   and the point lies on several, as on an edge, the adapter does not choose: that is `unsupported`.
3. **The empty solid.** A kernel with no empty solid says a result is empty in its own way, and the
   adapter reads that statement, and no other refusal, as the empty solid. It answers queries on an
   empty solid itself: a volume of 0, no meetings of a ray, every point outside.
4. **What a handle means.** A handle is a solid that stays as it was. Where a kernel's call consumes
   its operand, the adapter keeps how the solid was made and makes it again.

Where a case asks for one thing by way of another, the suite does the other itself, with one recipe
that is public and the same for every kernel: the stand-ins below, the pairing of an assembly's
parts, the merging of a ray's meetings at an edge, the joining of a section's pieces, the welding of
a mesh's vertices. A test of a function itself never takes a recipe: a kernel without the function
is `unsupported` there, and only there.

A kernel's `hello` states, as `configuration`, every setting the adapter gives the kernel that is
not the kernel's default: a tolerance, a mode of integration, a mesh's angular deflection. An
adapter that sets nothing states nothing.

A function a kernel does not offer, which its `hello` leaves out, is not asked for: a case that
needs it is `unsupported`, and the checks it would feed are left out of the others.

### Stand-ins for the five primitives

A case about a boolean or a fillet starts from a box or a sphere, and should not turn on whether the
kernel has a constructor for it. So where a kernel lists `box`, `cylinder`, `sphere`, `torus` or
`cone` as unsupported, the suite sends the same solid as an extrusion or a revolution in its place:

| Primitive  | Sent instead                                                                        |
| ---------- | ----------------------------------------------------------------------------------- |
| `box`      | `extrude` of the rectangle from the origin to `size[0]`, `size[1]`, by `size[2]`    |
| `cylinder` | `extrude` of the circle of its radius about the origin, by its height               |
| `sphere`   | `revolve`, a whole turn, of the half disc right of the axis                         |
| `torus`    | `revolve`, a whole turn, of the tube's circle, its centre `major` out from the axis |
| `cone`     | `revolve`, a whole turn, of the meridian: the axis, the two radii and the side      |

The suite makes the stand-in, the same one for every kernel, and the adapter still only answers the
call it is sent. A kernel that lacks the stand-in's function too cannot make the solid, and the case
is `unsupported`.

The constructors' own tests are the exception: `constructions/box`, `cylinder`, `sphere`, `torus`
and `cone`, and a test that a constructor refuses a bad solid. They ask for the constructor and
nothing else, so a kernel without it is `unsupported` there. The results name each stand-in a run
used, as `stand_ins`.

### Stand-ins for a mirror image and a placed part

Two more cases ask for one thing by way of another, and the suite makes that other itself where the
kernel cannot:

- **A part joined to its mirror image** (`mirror-joins`, `chain-across-a-mirror-join`). The image is
  asked for with `transform`. Where the kernel refuses the mirror as `unsupported`, the suite makes
  the image as a primitive of the same kind: its frame mirrored with x turned back to keep it
  right-handed, and a box or a profile mirrored across that x to match. The union, or the fillet
  across the join, is then judged as it is for any kernel. `transforms` remains the test of a mirror
  itself.
- **The parts of an assembly** (`assemblies`). Each part is made on its frame moved to where the
  part stands, never moved after it is made, so interference does not turn on `transform`.

### Time

Each call has a limit, 120 s unless the run sets another; a call past it times out, and its worker
is replaced. A case's time is the sum of its calls' wall times, as the client measures them, and a
run is one pass. A test's time is the median of its cases', leaving out the cases that gave no
answer; a test with fewer than five timed cases is marked as low confidence. Two kernels' times are
comparable only on the cases both pass at the same tier, and only when both ran on the same machine.
The run also times a calibration workload on its kernel and machine (two crossing cylinders, their
intersection and its volume), recorded for comparing machines, never kernels.

## Known limits

- **Measuring.** B0 to B6 trust each kernel's own volume and area, and a kernel's integration can be
  off where its geometry is right. A fixed rule can measure 4e-4 of the volume off on crossing
  cylinders, and an adaptive rule can be 5% off on a periodic spline prism while reporting an error
  estimate of 1e-17. B8 and B9 now separate such errors from wrong geometry, but only to their
  sampling bound.
- **Time budgets.** A call has a time limit, but no budget relative to its work: a boolean of two
  boxes and one of two splines may take the same 120 s. Work counters reported by the kernel would
  let budgets scale with the case.
- **Tolerance scale.** ε is absolute, so the `scaled` family's parts from microns to tens of metres
  test whether a kernel holds one tolerance at every size or scales its own. Whether the contract
  should declare ε relative to a part's size is open.
