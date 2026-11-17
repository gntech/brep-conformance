# API

The functions a B-rep kernel offers the suite, and how a client calls them. Each function has a
signature, what it requires, and the solid or value it returns, defined as a set of points in our
own words. A kernel is judged against these definitions alone, never against another kernel or an
outside standard. [contract.md](contract.md) says how results are checked.

Each group of functions opens with a table of its commands. The definitions follow it.

## Calling a kernel

A kernel takes part by shipping an **adapter**: a program that answers these calls with the kernel's
own functions. The suite runs it as one or more **worker** processes, so the client never links the
kernel. This is version 1.0.0 of the protocol.

### Lifecycle

1. The client starts the worker from a command line, with stdin and stdout as pipes. The worker's
   stderr is its own, for logs; the client does not read it.
2. The client's first request is `hello`. It compares the reply's `protocol` with the version it
   speaks, and stops when the two do not agree as [Versions](#versions) defines.
3. The client sends one request, waits for its reply, then sends the next: one request in flight per
   worker, and replies in request order.
4. When stdin closes, the worker exits with status 0.

A client may run several workers at once, typically one per thread. Each holds its own solids, and a
handle means something only to the worker that issued it.

### Requests and replies

Every message is one JSON object on one line, UTF-8, ended by a newline.

A request calls one function: `{"cmd": name, …}`, with each of the function's parameters as a field
of the same name. A value is written as the Format column of [Types](#types) gives it: a `Point3` is
`[x, y, z]`, a `Frame` is `{"origin": …, "x": …, "y": …, "z": …}`, and a `Solid` is its handle.

A reply is exactly one of:

| Reply                        | Meaning                                                                 |
| ---------------------------- | ----------------------------------------------------------------------- |
| `{"ok": value}`              | The call completed; `value` is what the function returns                |
| `{"err": reason, "kind": k}` | A **refusal**: the kernel declines with a reason; the worker carries on |
| `{"crash": message}`         | A **crash**: the kernel failed unexpectedly, and the worker recovered   |

- **Refusals.** [Refusals](#refusals) says when a function must refuse and how a refusal is scored.
- **Crashes.** A worker that writes no reply, or exits, has crashed. The client starts a fresh
  worker for its next request, and every handle of the old worker is gone.
- **Time limit.** Every call has one: 120 s unless the run sets another with `--timeout`. A worker
  that has not replied within it has timed out. The client kills it and starts a fresh one.
- **Handles.** A `Solid` travels as a handle, a positive integer the worker issues when a function
  returns a solid. The solid stays in the worker.
- **Repeated handles.** A handle may appear more than once in one request: `union`, `intersection`
  and `difference` may take the same handle as `a` and `b`, and the adapter passes that solid to the
  kernel as both operands. It never copies one to get round a kernel that refuses the pair. Such a
  kernel refuses, and the case scores refused.
- **Numbers.** A writer gives each double in a form that reads back exactly. NaN and infinities are
  not JSON numbers and never appear in a request.
- **No answer.** In a reply, `null` where a value belongs means there is none: `normal` gives `null`
  at a crease, and `centroid` for an empty solid. A function the kernel lacks is refused as
  `unsupported`, never answered `null`.

### The session

Two commands are not functions of a kernel:

| Command | Fields | Returns                                                         |
| ------- | ------ | --------------------------------------------------------------- |
| `hello` |        | `{name, version, tolerance, configuration, protocol, supports}` |
| `reset` |        | `null`                                                          |

- `hello` gives the kernel's `name` and `version`; the linear `tolerance` it declares, in mm; its
  `configuration`, a sentence on anything the adapter set differently from the kernel's defaults,
  empty when nothing; the `protocol` version the adapter speaks; and `supports`, the names of the
  functions the kernel offers, out of the functions of that version. A case that needs a function
  the list leaves out is not run. A function added in a later version is in no older adapter's list,
  so an adapter is never taken to offer what it was written before.
  [contract.md](contract.md#tolerance) says what tolerance an adapter sets and declares.
- `reset` releases every solid. No handle issued before it is valid after it.

A session that makes a box and a cylinder, intersects them and measures the result. `>` marks a
request and `<` its reply.

```text
> {"cmd": "hello"}
< {"ok": {"name": "example-kernel", "version": "1.2.0", "tolerance": 1e-7,
   "configuration": "", "protocol": "1.0.0",
   "supports": ["box", "cylinder", "intersection", "volume", "check"]}}
> {"cmd": "box", "frame": {"origin": [0, 0, 0], "x": [1, 0, 0], "y": [0, 1, 0], "z": [0, 0, 1]},
   "size": [10, 10, 10]}
< {"ok": 1}
> {"cmd": "cylinder", "frame": {"origin": [5, 5, -1], "x": [1, 0, 0], "y": [0, 1, 0],
   "z": [0, 0, 1]}, "radius": 2, "height": 12}
< {"ok": 2}
> {"cmd": "intersection", "a": 1, "b": 2}
< {"ok": 3}
> {"cmd": "volume", "s": 3}
< {"ok": 125.66370614359172}
> {"cmd": "check", "s": 3}
< {"ok": []}
```

Requests are wrapped here to fit the page; on the wire each is one line.

### Versions

A version is three numbers, `major.minor.patch`. A function or field added without changing what
existing ones mean raises the minor; a correction to this text that changes no message raises the
patch; anything else raises the major.

A client and an adapter work together when their major versions agree. A client stops on an adapter
whose major version is not its own.

An adapter ignores fields it does not know, and refuses a command it does not know as `unsupported`.

### Implementations

The crate [`brep-protocol`](../protocol/) is the Rust binding: the values as types, a `Kernel` trait
with a method per function, `serve`, which answers the protocol with any implementation of the
trait, and `Remote`, an implementation that forwards to workers. An adapter need not use the crate:
the protocol is lines of JSON, which a program in any language can answer.

## Types

| Type        | Format                                                       | Meaning                                                     |
| ----------- | ------------------------------------------------------------ | ----------------------------------------------------------- |
| `Number`    | `double`                                                     | Unitless                                                    |
| `Length`    | `double`                                                     | mm                                                          |
| `Angle`     | `double`                                                     | rad                                                         |
| `Area`      | `double`                                                     | mm²                                                         |
| `Volume`    | `double`                                                     | mm³                                                         |
| `Count`     | `integer`                                                    | A number of things                                          |
| `Index`     | `integer`                                                    | A position in a list, from 0                                |
| `Point2`    | `double[2]`                                                  | `[x, y]`, mm                                                |
| `Point3`    | `double[3]`                                                  | `[x, y, z]`, mm                                             |
| `Vector3`   | `double[3]`                                                  | A direction `[x, y, z]`. Nonzero; any length unless stated  |
| `Frame`     | `{origin: Point3, x: Vector3, y: Vector3, z: Vector3}`       | Right-handed orthonormal axes at `origin`, `z = x × y`      |
| `Placement` | `double[3][4]`                                               | The rigid motion `p ↦ R·p + t`, rows `[R \| t]`, `t` in mm  |
| `Loop`      | `list<Segment>`                                              | Segments end to end, closed; or one `spline`                |
| `Profile`   | `list<Loop>`                                                 | The outer loop, counter-clockwise, then holes, clockwise    |
| `Path`      | `list<PathPiece>`                                            | Runs and bends end to end, each leaving as the last arrived |
| `Spline3`   | `{degree: integer, knots: list<Number>, ctrl: list<Point3>}` | A clamped B-spline curve in space                           |
| `Solid`     | `integer`                                                    | A handle, 1 or more, to a solid set the kernel holds        |

A `Segment` is one of:

| Segment  | Format                                                                  | Meaning                                              |
| -------- | ----------------------------------------------------------------------- | ---------------------------------------------------- |
| `line`   | `{line: Point2[2]}`                                                     | The straight line from the first point to the second |
| `arc`    | `{arc: {center: Point2, radius: Length, start: Angle, sweep: Angle}}`   | A circular arc from angle `start` through `sweep`    |
| `conic`  | `{conic: {a: Point2, apex: Point2, b: Point2, w: Number}}`              | A conic arc from `a` to `b`, defined below           |
| `gn`     | `{gn: {a: Point2, apex: Point2, b: Point2, order: integer, w: Number}}` | A blend section from `a` to `b`, defined below       |
| `spline` | `{spline: {degree: integer, knots: list<Number>, ctrl: list<Point2>}}`  | A periodic B-spline, the whole of its loop           |

A `PathPiece` is one of:

| Piece  | Format                                  | Meaning                       |
| ------ | --------------------------------------- | ----------------------------- |
| `line` | `{line: Length}`                        | A straight run of that length |
| `arc`  | `{arc: {radius: Length, angle: Angle}}` | A bend of `angle` at `radius` |

A `spline` segment's `ctrl` lists its `n` points in one period with the first `degree` repeated
last, and its `knots` hold `n + 2·degree + 1` values running `degree` past each end of the period.
One period is the parameter range `knots[degree] ..= knots[n + degree]`.

A `double` is a finite IEEE 754 binary64 value, and an `integer` a whole number from 0 to 2⁵³; `5`
and `5.0` are one value. A `string` is UTF-8 text. `T[n]` is exactly `n` values, `T[n][m]` is `n`
rows of `m`, and `list<T>` is any number. A value of the wrong format, such as a `Point3` of two
numbers, is a malformed request and not an input a kernel refuses.

A matrix is a list of its rows, each row a list of numbers, and it multiplies a point written as a
column: `p ↦ M·p + t`. A `Number[3][4]` holds `[M | t]`, each row three numbers of `M` and then that
row's part of `t`:

```text
[[m11, m12, m13, tx],        x' = m11·x + m12·y + m13·z + tx
 [m21, m22, m23, ty],        y' = m21·x + m22·y + m23·z + ty
 [m31, m32, m33, tz]]        z' = m31·x + m32·y + m33·z + tz
```

A **solid set** is a bounded set of points equal to the closure of its interior. It may be empty, or
several separate pieces; pieces may touch at points or along curves, but never share an area of
boundary, which would make them one.

A frame's **local coordinates** `(u, v, w)` name the point `o + u·x + v·y + w·z`. Every constructor
below defines its solid in local coordinates and places it by its frame.

A **conic arc** runs from `a` to `b`, tangent there to the lines to its corner `apex`: the rational
quadratic `(t̄²a + 2w·t·t̄·apex + t²b) / (t̄² + 2w·t·t̄ + t²)`, `t̄ = 1 − t`, over `t` from 0 to 1. Its
shoulder, the point at `t = ½`, lies `rho = w/(1 + w)` of the way from the chord's middle to the
corner: an ellipse for `w < 1`, a parabola at 1, a hyperbola above; a circular arc turning `θ` is
the one with `w = cos(θ/2)`.

A **blend section** of order `n` and thumbweight `w` runs from `a` to `b` between the legs from
`apex` to each: `apex + α(t)(a − apex) + β(t)(b − apex)`, with `α = f·(1 − p₁)`, `β = (1 − f)·p₂`,
`f = t̄ⁿ⁺¹/(t̄ⁿ⁺¹ + tⁿ⁺¹)`, `p₁ = t/(1 − w + wt)` and `p₂ = t(1 − w)/(1 − wt)`. It meets each leg with
contact of order `n`: at `n = 2` it starts as straight as the leg, so it is curvature-continuous
with it. Its **equal-area thumbweight** is the `w` at which it takes off, from the triangle on its
legs, what the circle tangent to both legs at `a` and `b` does. "Thumbweight" is the name this shape
parameter has in parametric Gⁿ blending (E. Hartmann, "Parametric Gⁿ blending of curves and
surfaces", The Visual Computer 17, 2001, pp. 1–13).

A profile's **region** `Ω` is the set of points about which its loops' winding numbers sum to
nonzero, with its boundary. No loop may cross another or itself. `A` is its area, `M` its first
moment `∫∫ u dA`, and `L` its boundary's length.

Every function may **refuse**: decline with a reason instead of a result, for input it does not
support or cannot build correctly. A function never returns a result it knows to be wrong.

## Constructors

| Function                        | Fields                                           | Returns |
| ------------------------------- | ------------------------------------------------ | ------- |
| [`box`](#box)                   | `frame`, `size`                                  | `Solid` |
| [`cylinder`](#cylinder)         | `frame`, `radius`, `height`                      | `Solid` |
| [`sphere`](#sphere)             | `frame`, `radius`                                | `Solid` |
| [`torus`](#torus)               | `frame`, `major`, `minor`                        | `Solid` |
| [`cone`](#cone)                 | `frame`, `bottom`, `top`, `height`               | `Solid` |
| [`extrude`](#extrude)           | `frame`, `profile`, `height`                     | `Solid` |
| [`revolve`](#revolve)           | `frame`, `profile`, `angle`                      | `Solid` |
| [`screw`](#screw)               | `frame`, `profile`, `rise`, `angle`              | `Solid` |
| [`loft`](#loft)                 | `frame`, `profile`, `scale`, `height`, `top`     | `Solid` |
| [`loft_through`](#loft_through) | `frame`, `profiles`, `heights`                   | `Solid` |
| [`sweep`](#sweep)               | `frame`, `profile`, `path`                       | `Solid` |
| [`sweep_path`](#sweep_path)     | `frame`, `profile`, `path`, `twist`              | `Solid` |
| [`slab`](#slab)                 | `frame`, `size`, `knots_u`, `knots_v`, `heights` | `Solid` |

### box

`box(frame: Frame, size: Length[3]) -> Solid`

Makes a rectangular block with one corner at the frame's origin and its edges along the frame's
axes, not centred on the origin.

Requires each of `size = (a, b, c)` positive. Returns `0 ≤ u ≤ a`, `0 ≤ v ≤ b`, `0 ≤ w ≤ c`.

**Example.**

```text
> {"cmd": "box", "frame": {"origin": [0, 0, 0], "x": [1, 0, 0], "y": [0, 1, 0], "z": [0, 0, 1]},
   "size": [10, 20, 30]}
< {"ok": 1}
```

### cylinder

`cylinder(frame: Frame, radius: Length, height: Length) -> Solid`

Makes a round bar standing on the frame's xy plane, its axis running up z from the origin.

Requires both positive. Returns `u² + v² ≤ radius²`, `0 ≤ w ≤ height`.

**Example.**

```text
> {"cmd": "cylinder", "frame": {"origin": [0, 0, 0], "x": [1, 0, 0], "y": [0, 1, 0],
   "z": [0, 0, 1]}, "radius": 5, "height": 20}
< {"ok": 1}
```

### sphere

`sphere(frame: Frame, radius: Length) -> Solid`

Makes a ball centred on the frame's origin.

Requires `radius` positive. Returns `u² + v² + w² ≤ radius²`.

**Example.**

```text
> {"cmd": "sphere", "frame": {"origin": [0, 0, 0], "x": [1, 0, 0], "y": [0, 1, 0], "z": [0, 0, 1]},
   "radius": 5}
< {"ok": 1}
```

### torus

`torus(frame: Frame, major: Length, minor: Length) -> Solid`

Makes a ring lying round the frame's z axis: a tube of radius `minor` whose centre runs round a
circle of radius `major` in the xy plane.

Requires `major > minor > 0`. Returns `(√(u² + v²) − major)² + w² ≤ minor²`.

**Example.**

```text
> {"cmd": "torus", "frame": {"origin": [0, 0, 0], "x": [1, 0, 0], "y": [0, 1, 0], "z": [0, 0, 1]},
   "major": 10, "minor": 2}
< {"ok": 1}
```

### cone

`cone(frame: Frame, bottom: Length, top: Length, height: Length) -> Solid`

Makes a cone or truncated cone standing on the frame's xy plane round its z axis, from radius
`bottom` at the origin to `top` at `height`.

Requires `height` positive and `bottom`, `top` at least zero, not both zero; a zero radius is an
apex. Returns `√(u² + v²) ≤ bottom + (top − bottom)·w/height`, `0 ≤ w ≤ height`.

**Example.**

```text
> {"cmd": "cone", "frame": {"origin": [0, 0, 0], "x": [1, 0, 0], "y": [0, 1, 0], "z": [0, 0, 1]},
   "bottom": 5, "top": 2, "height": 10}
< {"ok": 1}
```

### extrude

`extrude(frame: Frame, profile: Profile, height: Length) -> Solid`

Pushes a flat profile straight out of its plane, as a part cut from plate: the profile in the
frame's xy plane, swept `height` along z.

Requires `height` positive. Returns `(u, v) ∈ Ω`, `0 ≤ w ≤ height`: the profile drawn in the frame's
xy plane, moved along z. Its volume is `A·height` and its area `2A + L·height`.

**Example.**

```text
> {"cmd": "extrude", "frame": {"origin": [0, 0, 0], "x": [1, 0, 0], "y": [0, 1, 0], "z": [0, 0, 1]},
   "profile": [[{"line": [[0, 0], [10, 0]]}, {"line": [[10, 0], [10, 10]]}, {"line": [[10, 10],
   [0, 10]]}, {"line": [[0, 10], [0, 0]]}]], "height": 5}
< {"ok": 1}
```

### revolve

`revolve(frame: Frame, profile: Profile, angle: Angle) -> Solid`

Spins a profile about an axis, as on a lathe: the profile beside the frame's z axis, turned about it
by `angle`. A whole turn makes a closed body of revolution.

The profile is drawn in the plane of the frame's x and z, with its first coordinate out from the z
axis and its second along it. Requires `Ω` in the half-plane where the first coordinate is at least
zero, and `0 < angle ≤ 2π`. Returns the points `(ρ cos φ, ρ sin φ, w)` for `(ρ, w) ∈ Ω` and
`0 ≤ φ ≤ angle`: the profile turned right-handed about z. Its volume is `M·angle` (Pappus), and its
area `angle·∮ u ds`, plus `2A` for the end faces when `angle < 2π`.

**Example.**

```text
> {"cmd": "revolve", "frame": {"origin": [0, 0, 0], "x": [1, 0, 0], "y": [0, 1, 0], "z": [0, 0, 1]},
   "profile": [[{"line": [[5, 0], [8, 0]]}, {"line": [[8, 0], [8, 4]]}, {"line": [[8, 4], [5, 4]]},
   {"line": [[5, 4], [5, 0]]}]], "angle": 6.283185307}
< {"ok": 1}
```

### screw

`screw(frame: Frame, profile: Profile, rise: Length, angle: Angle) -> Solid`

Spins a profile about an axis while moving it along the axis, as a thread is formed: each whole turn
rises `2π·rise`.

The profile is drawn as for `revolve`. Requires `Ω` where the first coordinate is at least zero,
`angle` positive, and the turns apart: `2π·|rise|` at least the profile's extent along z. Returns
`(ρ cos φ, ρ sin φ, w + rise·φ)` for `(ρ, w) ∈ Ω` and `0 ≤ φ ≤ angle`: the profile turned about z
while rising `rise` per radian, as a thread. Its volume is `M·angle`, since the rise moves each
section within its own plane; its area is `angle·∮ √(u² + rise²·(du/ds)²) ds + 2A`.

**Example.**

```text
> {"cmd": "screw", "frame": {"origin": [0, 0, 0], "x": [1, 0, 0], "y": [0, 1, 0], "z": [0, 0, 1]},
   "profile": [[{"line": [[5, 0], [6, 0]]}, {"line": [[6, 0], [6, 1]]}, {"line": [[6, 1], [5, 1]]},
   {"line": [[5, 1], [5, 0]]}]], "rise": 0.5, "angle": 12.566370614}
< {"ok": 1}
```

### loft

`loft(frame: Frame, profile: Profile, scale: Number, height: Length, top: Profile) -> Solid`

Joins a profile to a scaled copy of itself above it by straight lines, as a tapered post; a scale of
1 is an extrusion, and a smaller scale narrows toward the top.

`top` is `profile` scaled by `scale` about the origin. The client sends it, so that an adapter whose
kernel lofts between two sections passes both on and scales nothing itself.

Requires a profile of one loop, `scale` and `height` positive. Returns `(σu, σv, w)` for
`(u, v) ∈ Ω` and `0 ≤ w ≤ height`, with `σ = 1 + (scale − 1)·w/height`: ruled from the profile in
the xy plane to its copy scaled about the origin, `height` up z. Its volume is
`A·height·(1 + s + s²)/3` with `s = scale`, and its area
`A·(1 + s²) + (1 + s)/2 · ∮ ‖(height·q′, (s − 1)·q × q′)‖` round the profile `q`.

**Example.**

```text
> {"cmd": "loft", "frame": {"origin": [0, 0, 0], "x": [1, 0, 0], "y": [0, 1, 0], "z": [0, 0, 1]},
   "profile": [[{"line": [[-5, -5], [5, -5]]}, {"line": [[5, -5], [5, 5]]}, {"line": [[5, 5],
   [-5, 5]]}, {"line": [[-5, 5], [-5, -5]]}]], "scale": 0.5, "height": 10, "top": [[{"line": [[-2.5,
   -2.5], [2.5, -2.5]]}, {"line": [[2.5, -2.5], [2.5, 2.5]]}, {"line": [[2.5, 2.5], [-2.5, 2.5]]},
   {"line": [[-2.5, 2.5], [-2.5, -2.5]]}]]}
< {"ok": 1}
```

### loft_through

`loft_through(frame: Frame, profiles: list<Profile>, heights: list<Length>) -> Solid`

Makes the smooth solid through two or more sections: profile `k` drawn in the frame's xy plane,
moved `heights[k]` up its z, the heights rising. Its section at each of those heights is that
profile, its ends are the first and last, and its side passes smoothly from one section to the next.
How it runs between sections is open: tools interpolate differently, and none is the answer.

Requires two or more profiles and one height for each, every height above the one before. Each
profile is one loop; sections with holes are not yet specified.

A section is its region, not the way its loop is written. The result does not depend on which
segment a loop starts with, nor on how a curve is cut into segments, so the side has no twist that
the regions do not ask for. Sections that are one profile at every height give that profile's
extrusion from the first height to the last, wherever each loop starts.

Smoothly means the side has a tangent plane at every point between the first section and the last,
the heights of the inner sections included: it has no crease along a section and none across it.

**Example.**

```text
> {"cmd": "loft_through", "frame": {"origin": [0, 0, 0], "x": [1, 0, 0], "y": [0, 1, 0],
   "z": [0, 0, 1]}, "profiles": [[[{"line": [[-5, -5], [5, -5]]}, {"line": [[5, -5], [5, 5]]},
   {"line": [[5, 5], [-5, 5]]}, {"line": [[-5, 5], [-5, -5]]}]], [[{"line": [[-3, -3], [3, -3]]},
   {"line": [[3, -3], [3, 3]]}, {"line": [[3, 3], [-3, 3]]}, {"line": [[-3, 3], [-3, -3]]}]]],
   "heights": [0, 10]}
< {"ok": 1}
```

### sweep

`sweep(frame: Frame, profile: Profile, path: Path) -> Solid`

Carries a profile along a path of straight runs and bends, as a pipe or a bent bar.

The path starts at the frame's origin heading along z, with the profile in the xy plane square to
it. A line runs straight on by `length`; an arc bends toward the current x by `angle` about an axis
along the current y, `radius` from the path, and turns the frame with it. Returns the union of the
pieces: each line the extrusion of the profile along it, each arc the revolution of the profile
about its axis. Requires every profile point closer to the path than any bend's radius, and lengths,
radii and angles positive. Its volume, area and moments are its pieces', less the end caps that meet
inside it.

**Example.**

```text
> {"cmd": "sweep", "frame": {"origin": [0, 0, 0], "x": [1, 0, 0], "y": [0, 1, 0], "z": [0, 0, 1]},
   "profile": [[{"line": [[-1, -1], [1, -1]]}, {"line": [[1, -1], [1, 1]]}, {"line": [[1, 1],
   [-1, 1]]}, {"line": [[-1, 1], [-1, -1]]}]], "path": [{"line": 10},
   {"arc": {"radius": 5, "angle": 1.570796327}}, {"line": 10}]}
< {"ok": 1}
```

### sweep_path

`sweep_path(frame: Frame, profile: Profile, path: Spline3, twist: Angle) -> Solid`

Carries a profile along a smooth space curve, as a bent pipe or a twisted rib.

`path` is a clamped B-spline in the frame's coordinates (its `degree`, `knots` and control points)
that starts at the origin heading along z, with the profile in the xy plane square to it. `twist`
may be any angle, either way round. The profile's plane stays square to the path. Its axes follow
the path's rotation-minimizing frame, which never turns about the tangent, and turn by `twist` more,
evenly in arc length, by the end. Requires every profile point closer to the path than its least
radius of curvature, and the sweep never to meet itself.

With `T` the tangent and `K₁`, `K₂` the curvature along the profile's turned axes, a profile point
`(X, Y)` sweeps a volume element `(1 − K₁X − K₂Y) dA ds`. The volume and moments are therefore
integrals along the path of the profile's moments up to the third. The side's element is
`√(a²|b′|² + φ′²(b·b′)²)` along the boundary `b`, with `a = 1 − K₁X − K₂Y` and `φ′` the twist per
length. A profile centred on the path has volume `A·ℓ` (Pappus), with `ℓ` the path's length, and
untwisted it has side `L·ℓ`.

**Example.**

```text
> {"cmd": "sweep_path", "frame": {"origin": [0, 0, 0], "x": [1, 0, 0], "y": [0, 1, 0],
   "z": [0, 0, 1]}, "profile": [[{"line": [[-1, -1], [1, -1]]}, {"line": [[1, -1], [1, 1]]},
   {"line": [[1, 1], [-1, 1]]}, {"line": [[-1, 1], [-1, -1]]}]],
   "path": {"degree": 3, "knots": [0, 0, 0, 0, 1, 1, 1, 1], "ctrl": [[0, 0, 0], [0, 0, 5],
   [3, 0, 10], [8, 0, 12]]}, "twist": 0}
< {"ok": 1}
```

### slab

`slab(frame: Frame, size: Length[2], knots_u, knots_v: list<Number>, heights: list<list<Length>>) -> Solid`

Makes a block with a freeform top: flat underneath and on its four sides, its top a smooth surface.

Returns the points over the rectangle `0 ≤ u ≤ size[0]`, `0 ≤ v ≤ size[1]` from `w = 0` up to the
height field `w = f(u/size[0], v/size[1])`. `f` is the bicubic B-spline over `[0, 1]²` with clamped
knots `knots_u`, `knots_v` (each running four times 0 first and four times 1 last) and coefficients
`heights[i][j]`. Requires every height positive, which keeps `f` positive. As a surface, the top is
the B-spline whose control points sit at the knots' Greville abscissae times the size, so its x and
y run linearly with its parameters. Its volume and moments are integrals of polynomials in `f`, and
its area that of `√(1 + (f_u/size[0])² + (f_v/size[1])²)`.

**Example.**

```text
> {"cmd": "slab", "frame": {"origin": [0, 0, 0], "x": [1, 0, 0], "y": [0, 1, 0], "z": [0, 0, 1]},
   "size": [10, 10], "knots_u": [0, 0, 0, 1, 1, 1], "knots_v": [0, 0, 0, 1, 1, 1],
   "heights": [[5, 5, 5], [5, 7, 5], [5, 5, 5]]}
< {"ok": 1}
```

## Booleans

Every boolean returns the regularized set operation: the closure of the interior of the set result.
The result may be empty, or several pieces touching as [Types](#types) allows; pieces sharing an
area of boundary are returned as one. The operands are left as they were.

| Function                            | Fields            | Returns |
| ----------------------------------- | ----------------- | ------- |
| [`union`](#union)                   | `a`, `b`          | `Solid` |
| [`intersection`](#intersection)     | `a`, `b`          | `Solid` |
| [`difference`](#difference)         | `a`, `b`          | `Solid` |
| [`union_all`](#union_all)           | `solids`          | `Solid` |
| [`difference_all`](#difference_all) | `target`, `tools` | `Solid` |

### union

`union(a: Solid, b: Solid) -> Solid`

Joins two solids. Returns the regularized `a ∪ b`: what either holds.

**Example.** Solid 1 is a 10 × 20 × 30 mm box with one corner at the origin. Solid 2 is a cylinder
of radius 5 and height 20 on the z axis.

```text
> {"cmd": "union", "a": 1, "b": 2}
< {"ok": 3}
```

### intersection

`intersection(a: Solid, b: Solid) -> Solid`

Keeps what two solids share. Returns the regularized `a ∩ b`: what both hold.

**Example.** Solid 1 is a 10 × 20 × 30 mm box with one corner at the origin. Solid 2 is a cylinder
of radius 5 and height 20 on the z axis.

```text
> {"cmd": "intersection", "a": 1, "b": 2}
< {"ok": 3}
```

### difference

`difference(a: Solid, b: Solid) -> Solid`

Cuts one solid from another. Returns the regularized `a ∖ b`: what `a` holds and `b` does not.

**Example.** Solid 1 is a 10 × 20 × 30 mm box with one corner at the origin. Solid 2 is a cylinder
of radius 5 and height 20 on the z axis.

```text
> {"cmd": "difference", "a": 1, "b": 2}
< {"ok": 3}
```

### union_all

`union_all(solids: list<Solid>) -> Solid`

Joins two or more solids in one call. Requires at least two. Returns their regularized union, the
same as `union` taken one at a time in any order. A pattern is one of these over copies of a solid
moved by [`transform`](#transform).

**Example.** Solid 1 is a 10 × 20 × 30 mm box with one corner at the origin. Solid 2 is a cylinder
of radius 5 and height 20 on the z axis. Solid 3 is a ball 30 mm away.

```text
> {"cmd": "union_all", "solids": [1, 2, 3]}
< {"ok": 4}
```

### difference_all

`difference_all(target: Solid, tools: list<Solid>) -> Solid`

Cuts one or more tools from `target` in one call. Requires at least one tool. Returns the
regularized difference, the same as `difference` taken one tool at a time in any order.

**Example.** Solid 1 is a 10 × 20 × 30 mm box with one corner at the origin. Solid 2 is a cylinder
of radius 5 and height 20 on the z axis. Solid 3 is a ball 30 mm away.

```text
> {"cmd": "difference_all", "target": 1, "tools": [2, 3]}
< {"ok": 4}
```

## Blends

An edge is named by a point on it: each point names the edge of `s` that passes within `10·ε` of it,
with ε the suite's tolerance of 1e-7 mm, and a point that names no edge refuses. A point names an
edge without depending on how any kernel numbers or labels its topology, and a test can compute one
from the solid's definition.

A blend runs on along its edge's whole tangent chain: the edge named, and every edge reached from it
through vertices where the next edge leaves in the direction the last one arrived. The top loop of a
prism on a rounded rectangle is one chain, so a point on any of its edges blends all of it.
Following the chain is the function's work, and the kernel's: an adapter passes on the edge the
point names and no other.

| Function                                  | Fields                                | Returns |
| ----------------------------------------- | ------------------------------------- | ------- |
| [`fillet`](#fillet)                       | `s`, `edges`, `radius`                | `Solid` |
| [`fillet_radii`](#fillet_radii)           | `s`, `edges`, `radii`                 | `Solid` |
| [`fillet_variable`](#fillet_variable)     | `s`, `edge`, `from`, `r_from`, `r_to` | `Solid` |
| [`fillet_conic`](#fillet_conic)           | `s`, `edges`, `setback`, `rho`        | `Solid` |
| [`fillet_g2`](#fillet_g2)                 | `s`, `edges`, `offset`, `center`      | `Solid` |
| [`fillet_setback`](#fillet_setback)       | `s`, `edges`, `radius`, `setback`     | `Solid` |
| [`fillet_setback_g2`](#fillet_setback_g2) | `s`, `edges`, `radius`, `setback`     | `Solid` |
| [`fillet_faces`](#fillet_faces)           | `s`, `face_a`, `face_b`, `radius`     | `Solid` |
| [`full_round`](#full_round)               | `s`, `side_a`, `middle`, `side_b`     | `Solid` |
| [`chamfer`](#chamfer)                     | `s`, `edges`, `distance`              | `Solid` |
| [`chamfer_two`](#chamfer_two)             | `s`, `edge`, `face`, `d1`, `d2`       | `Solid` |
| [`chamfer_distances`](#chamfer_distances) | `s`, `edges`, `distances`             | `Solid` |

### fillet

`fillet(s: Solid, edges: list<Point3>, radius: Length) -> Solid`

Rounds edges: each named edge gives way to the surface a ball of `radius` sweeps as it rolls along
the edge touching both faces that meet there.

Requires one edge or more, `radius` positive, and the ball to fit: its contact with each face stays
on that face, except where it swallows a face as below. At a convex edge the result is `s` less the
material between the ball's sweep and the edge; at a concave edge, `s` with the space between them
filled. Where the two faces are planes, or surfaces of revolution meeting round a circle, the
section across the edge is the circle of `radius` tangent to both faces' traces. `s` is left as it
was.

A fillet swallows a face too narrow for its ball. Take a narrow face `N` between two faces `A` and
`B`, with both of `N`'s edges named: the edge it shares with `A` and the edge it shares with `B`. A
ball small enough rolls along each edge in turn, touching `A` and `N`, then `N` and `B`, and leaves
a strip of `N` between two fillets. A ball too big for that cannot touch `N` at all: resting against
`A` and `B` at once, it bridges over `N`. The ball then rolls touching `A` and `B` alone, each
continued past its edge with `N` as if `N` were not there, and makes one fillet from `A` to `B`. `N`
lies wholly in the material the ball's sweep removes, so none of it is left. The result is the one
`fillet` gives on the solid whose `A` and `B` run on to meet in a single edge, with that edge named:
a corner chamfered by a hair, with both edges of the chamfer filleted, is the corner filleted.

Where named convex edges meet at a corner, the corner is what the balls touching their faces leave:
filleting every edge of a convex solid, or every convex edge of a prism whose concave edges all run
along its axis, gives the union of the balls of `radius` inside `s`. A box with all twelve edges
filleted by `r` is the box `r` smaller on every side, swelled by `r`. Other corners are not yet
specified. Whatever closes one, a fillet leaves no crease: where the result's boundary is not `s`'s
own it has a tangent plane, which it shares with each face it meets. It changes nothing farther than
twice the radius from the named edges. And where a motion leaves `s` and the named edges as they
were round a blend, it leaves the result so too, within a thousandth of the radius.

**Example.** Solid 1 is a 10 × 20 × 30 mm box with one corner at the origin. The point names its
vertical edge at the origin.

```text
> {"cmd": "fillet", "s": 1, "edges": [[0, 0, 15]], "radius": 2}
< {"ok": 2}
```

### fillet_radii

`fillet_radii(s: Solid, edges: list<Point3>, radii: list<Length>) -> Solid`

Rounds edges as `fillet` does, in one operation with each point's chain at its own radius, so that
fillets of unequal radii meet at shared corners. Requires one radius for each point, each as
`fillet` requires. Away from those corners each edge is as `fillet` makes it at its radius. The
corner itself is open within limits. The result lies between the solid filleted at the largest of
the corner's radii and at the smallest, point for point: it holds every point of the first and none
outside the second. Its surface is closed and has no crease: the corner joins every fillet and face
it meets with their tangent planes. And its pieces, tunnels and voids are those of `s`.

**Example.** Solid 1 is a 10 × 20 × 30 mm box with one corner at the origin.

```text
> {"cmd": "fillet_radii", "s": 1, "edges": [[0, 0, 15], [10, 0, 15]], "radii": [1, 2]}
< {"ok": 2}
```

### fillet_variable

`fillet_variable(s: Solid, edge: Point3, from: Point3, r_from: Length, r_to: Length) -> Solid`

Rounds one edge as `fillet` does, by a ball whose radius runs evenly with length along the edge,
from `r_from` at the end nearest `from` to `r_to` at the other. Requires both radii positive, the
ball to fit all along the edge, and `from` nearer one end of the edge than the other. The ball
touches each face along the line where its centre's foot falls, and the blend meets each face there
tangentially. Its surface between those lines is open within limits. It has no crease. A ball
reaches no farther along the edge than its radius, so at each point along the edge the result lies
between the edge filleted at the least and at the greatest radius the ball has within the larger of
`r_from` and `r_to` of that point.

**Example.** Solid 1 is a 10 × 20 × 30 mm box with one corner at the origin.

```text
> {"cmd": "fillet_variable", "s": 1, "edge": [0, 0, 15], "from": [0, 0, 0], "r_from": 1, "r_to": 2}
< {"ok": 2}
```

### fillet_conic

`fillet_conic(s: Solid, edges: list<Point3>, setback: Length, rho: Number) -> Solid`

Rounds edges by a conic instead of a circle: each named edge gives way to a blend meeting both faces
`setback` back from the edge, tangent to them. Between planes its section across the edge is the
conic arc from one contact to the other with its corner on the edge and shoulder `rho`. `rho = 0.5`
is a parabola; a quarter circle is `rho = √2 − 1` at a square edge.

Requires `setback` positive and both contacts on their faces, and `0 < rho < 1`.

**Example.** Solid 1 is a 10 × 20 × 30 mm box with one corner at the origin.

```text
> {"cmd": "fillet_conic", "s": 1, "edges": [[0, 0, 15]], "setback": 2, "rho": 0.5}
< {"ok": 2}
```

### fillet_g2

`fillet_g2(s: Solid, edges: list<Point3>, offset: Length, center: Length) -> Solid`

Rounds edges by a curvature-continuous blend sized by two lengths: its **tangent offset**, the
radius of the ball whose contacts it shares, so that it meets each face where a ball of `offset`
rolling along the edge touches it; and its **center radius**, its radius of curvature at its middle.
Between planes its section across the edge is the blend section of order 2 between the two contacts,
its apex on the edge, at the thumbweight that gives its middle that radius. It shares each face's
tangent plane and its curvature too, so it starts as straight as the face: a circular fillet bends
at once by `1/offset`, and fails. The section at the equal-area thumbweight, which takes off what
the ball's round does, is the one whose center radius at a square edge is about 1.389 times the
offset.

Requires both lengths positive, a ball of `offset` to fit as `fillet` requires, and `center` a
radius the section takes at some thumbweight between 0 and 1.

**Example.** Solid 1 is a 10 × 20 × 30 mm box with one corner at the origin.

```text
> {"cmd": "fillet_g2", "s": 1, "edges": [[0, 0, 15]], "offset": 2, "center": 1.5}
< {"ok": 2}
```

### fillet_setback

`fillet_setback(s: Solid, edges: list<Point3>, radius: Length, setback: Length) -> Solid`

Rounds edges as `fillet` of `radius` does, stopping each fillet `setback` short of every corner
where three named edges meet and closing the corner with one smooth patch that meets the three
fillets and the three faces tangentially. Requires `setback` greater than `radius`. Farther than
`setback` from such a corner each edge is as `fillet` makes it.

The patch is open within limits: the result lies between `s` filleted with the corner's cube of side
`setback` taken away and with it left sharp, point for point. Neither of those is itself a result:
the patch leaves no crease. On each face, the flat stops short of the point where its two fillets'
contact lines would cross, which the rolling-ball corner reaches. A square corner whose three edges
are filleted and set back alike is closed alike on all three: the result is unchanged by any swap of
them, within a thousandth of the radius.

**Example.** Solid 1 is a 10 × 20 × 30 mm box with one corner at the origin. The three edges meet at
the origin.

```text
> {"cmd": "fillet_setback", "s": 1, "edges": [[5, 0, 0], [0, 10, 0], [0, 0, 15]],
   "radius": 1, "setback": 2}
< {"ok": 2}
```

### fillet_setback_g2

`fillet_setback_g2(s: Solid, edges: list<Point3>, radius: Length, setback: Length) -> Solid`

Rounds edges as `fillet_setback` does, and requires what it requires, with fillets and patch
curvature-continuous throughout. Each fillet is the `fillet_g2` blend of tangent offset `radius` at
the equal-area thumbweight, so it meets its faces with their curvature and takes off what the round
of `radius` does; each holds that section until `setback` from the corner. The patch meets the three
fillets and the three faces with their curvature as well as their tangent planes. Where fillet i
ends, on its section square to its edge `setback` from the corner, the boundary bends by the
section's center radius round the edge and not along it, on both sides of the seam. Across the whole
corner, faces, fillets and patch, the boundary's curvature changes without a jump. Circular fillets
cannot be closed this way: they meet their faces with a jump in curvature, and no patch matches both
where a fillet's end section meets a face.

**Example.** Solid 1 is a 10 × 20 × 30 mm box with one corner at the origin.

```text
> {"cmd": "fillet_setback_g2", "s": 1, "edges": [[5, 0, 0], [0, 10, 0], [0, 0, 15]],
   "radius": 1, "setback": 2}
< {"ok": 2}
```

### fillet_faces

`fillet_faces(s: Solid, face_a: Point3, face_b: Point3, radius: Length) -> Solid`

Rounds between two faces that need not share an edge: a ball of `radius` rolls touching the face
each point names, and what lies outside its path between the two contacts goes, faces between them
included. A chamfer narrower than the round is consumed: two planes meeting at a chamfered edge give
the sharp edge filleted by `radius`. Requires `radius` positive, two different faces, and the ball
to fit between them.

**Example.** Solid 1 is a 10 × 20 × 30 mm box with one corner at the origin.

```text
> {"cmd": "fillet_faces", "s": 1, "face_a": [5, 10, 0], "face_b": [0, 10, 15], "radius": 2}
< {"ok": 2}
```

### full_round

`full_round(s: Solid, side_a: Point3, middle: Point3, side_b: Point3) -> Solid`

Replaces the face `middle` names by a round tangent to it and to the faces `side_a` and `side_b`
name, which stay where they are. A rib between parallel sides `w` apart gets a half cylinder of
radius `w/2`; between sides that close toward the middle face, the arc of the circle touching all
three.

Requires three different faces, with `middle` sharing an edge with each of the other two.

**Example.** Solid 1 is a 10 × 20 × 30 mm box with one corner at the origin.

```text
> {"cmd": "full_round", "s": 1, "side_a": [0, 10, 15], "middle": [5, 0, 15], "side_b": [10, 10, 15]}
< {"ok": 2}
```

### chamfer

`chamfer(s: Solid, edges: list<Point3>, distance: Length) -> Solid`

Bevels edges: each named edge is cut by the surface through the lines `distance` back from it along
each face.

Requires one edge or more, `distance` positive, and each cut to stay on its faces. Where the faces
are planes the cut is the plane through those two lines; about a circular edge of a solid of
revolution it is the cone through the two circles. Corners where chamfered edges meet are not yet
specified. `s` is left as it was.

**Example.** Solid 1 is a 10 × 20 × 30 mm box with one corner at the origin.

```text
> {"cmd": "chamfer", "s": 1, "edges": [[0, 0, 15]], "distance": 2}
< {"ok": 2}
```

### chamfer_two

`chamfer_two(s: Solid, edge: Point3, face: Point3, d1: Length, d2: Length) -> Solid`

Bevels one edge unevenly: the cut runs through the line `d1` back from the edge along the face
`face` names and the line `d2` back along the other face there. Between planes the section it takes
is the triangle on those two lines. A chamfer given by a distance and an angle from the named face
is this one with `d2 = d1·tan(angle)`.

Requires both distances positive, each cut on its face, and `face` one of the two faces that meet at
the edge.

**Example.** Solid 1 is a 10 × 20 × 30 mm box with one corner at the origin.

```text
> {"cmd": "chamfer_two", "s": 1, "edge": [0, 0, 15], "face": [0, 10, 15], "d1": 1, "d2": 2}
< {"ok": 2}
```

### chamfer_distances

`chamfer_distances(s: Solid, edges: list<Point3>, distances: list<Length>) -> Solid`

Bevels edges as `chamfer` does, in one operation with each point's chain at its own distance, so
that chamfers of unequal distances meet at shared corners. Requires one distance for each point,
each as `chamfer` requires. Away from those corners each edge is as `chamfer` cuts it at its
distance; the corner is open within limits. The result lies within the solid chamfered at the
smallest of the corner's distances, point for point, and its volume is no less than that of the
solid chamfered at the largest. It holds every point of that second solid farther than the largest
distance from the corner along any edge; nearer, the three chamfers' planes meet at a point, and a
result may run out to it or be cut flat across short of it.

**Example.** Solid 1 is a 10 × 20 × 30 mm box with one corner at the origin.

```text
> {"cmd": "chamfer_distances", "s": 1, "edges": [[0, 0, 15], [10, 0, 15]], "distances": [1, 2]}
< {"ok": 2}
```

## Changing a solid

A face is named as an edge is: each point names the face of `s` it lies on, within `10·ε`.

| Function                        | Fields                                  | Returns |
| ------------------------------- | --------------------------------------- | ------- |
| [`offset`](#offset)             | `s`, `distance`                         | `Solid` |
| [`offset_faces`](#offset_faces) | `s`, `faces`, `distance`                | `Solid` |
| [`delete_faces`](#delete_faces) | `s`, `faces`                            | `Solid` |
| [`move_faces`](#move_faces)     | `s`, `faces`, `matrix`                  | `Solid` |
| [`thicken`](#thicken)           | `s`, `faces`, `thickness`               | `Solid` |
| [`shell`](#shell)               | `s`, `open`, `thickness`                | `Solid` |
| [`draft`](#draft)               | `s`, `faces`, `origin`, `pull`, `angle` | `Solid` |

### offset

`offset(s: Solid, distance: Length) -> Solid`

Grows the solid by a constant distance all round, rounding its convex edges and corners.

Requires `distance` positive. Returns the points within `distance` of `s`. For a convex solid its
volume is Steiner's `V + S·d + M·d² + (4π/3)·d³`, with `M` the integral of mean curvature over its
boundary.

**Example.** Solid 1 is a 10 × 20 × 30 mm box with one corner at the origin.

```text
> {"cmd": "offset", "s": 1, "distance": 1}
< {"ok": 2}
```

### offset_faces

`offset_faces(s: Solid, faces: list<Point3>, distance: Length) -> Solid`

Pushes or pulls faces, as a direct edit: each named face moves `distance` along its outward normal
onto its offset surface (a plane moved, a cylinder's radius changed), and the faces round it are
extended or trimmed to meet it. A negative distance pulls the face in.

Where a moved face comes to lie on another face's plane, the two merge into one face, and a face
between them that shrinks to nothing is gone: a step pushed level becomes one top, and a slot's wall
pushed across to the other wall closes the slot. Requires one face or more, `distance` not zero, and
no face to pass beyond the face it meets.

**Example.** Solid 1 is a 10 × 20 × 30 mm box with one corner at the origin. The point names its top
face.

```text
> {"cmd": "offset_faces", "s": 1, "faces": [[5, 10, 30]], "distance": 2}
< {"ok": 2}
```

### delete_faces

`delete_faces(s: Solid, faces: list<Point3>) -> Solid`

Takes the faces the points lie on out of the solid and closes the gap by extending or trimming the
faces round them, as defeaturing does. A hole's face taken out leaves the plate whole. A notch's or
groove's faces taken out leave the block or shaft it was cut from. A chamfer taken out restores the
corner. Requires the faces round the gap to close it.

**Example.** Solid 2 is the box with one edge chamfered. The point names the chamfer's face.

```text
> {"cmd": "delete_faces", "s": 2, "faces": [[1, 1, 15]]}
< {"ok": 3}
```

### move_faces

`move_faces(s: Solid, faces: list<Point3>, matrix: Placement) -> Solid`

Moves the faces the points lie on rigidly by `p ↦ R·p + t`, the rows of `matrix` being `[R | t]`
with `R` a rotation. The faces round them are extended or trimmed to meet them, as a direct edit. A
hole's face moved across a plate moves the hole. A notch's faces moved along a side move the notch.
A side turned about its bottom edge leans the side. A plane moved along itself is the same plane.

Requires one face or more, `R` a rotation, and the faces round the moved ones to reach them.

**Example.** Solid 1 is a 10 × 20 × 30 mm box with one corner at the origin.

```text
> {"cmd": "move_faces", "s": 1, "faces": [[5, 10, 30]], "matrix": [[1, 0, 0, 0], [0, 1, 0, 0],
   [0, 0, 1, 3]]}
< {"ok": 2}
```

### thicken

`thicken(s: Solid, faces: list<Point3>, thickness: Length) -> Solid`

Makes the solid each face the points lie on sweeps as it moves from where it is to `thickness` along
its outward normal: inward where `thickness` is negative. Its walls are swept along the normals from
the face's edges. The input is not part of it. A box's face gives a slab. A cylinder's side gives a
tube. A ball's face gives a spherical shell, and a ring's face a hollow ring.

Requires one face or more and `thickness` not zero. Inward, it requires the thickness less than the
face's least radius of curvature on that side, so the swept face does not fold.

**Example.** Solid 1 is a 10 × 20 × 30 mm box with one corner at the origin.

```text
> {"cmd": "thicken", "s": 1, "faces": [[5, 10, 30]], "thickness": 2}
< {"ok": 2}
```

### shell

`shell(s: Solid, open: list<Point3>, thickness: Length) -> Solid`

Hollows the solid to walls of one thickness, open through the named faces.

Returns the points of `s` within `thickness` of its boundary, the named faces left out of that
boundary: with no faces named, the walls close round a void. Requires `thickness` positive and the
walls not to meet.

**Example.** Solid 1 is a 10 × 20 × 30 mm box with one corner at the origin.

```text
> {"cmd": "shell", "s": 1, "open": [[5, 10, 30]], "thickness": 1}
< {"ok": 2}
```

### draft

`draft(s: Solid, faces: list<Point3>, origin: Point3, pull: Vector3, angle: Angle) -> Solid`

Tilts faces so a part draws out of a mould: each named face turns by `angle` about the line where it
meets the neutral plane through `origin` square to `pull`, narrowing the part along `pull`.

Requires one face or more, each a plane meeting the neutral plane, and `angle` between 0 and π/2,
neither included. The result is `s` with those faces moved onto their tilted planes, the faces round
them extended or trimmed to meet them. Where tilted faces meet each other or another face before the
part ends, the part closes there, along a ridge or at an apex, and what lay beyond is gone: the
result is still the part cut by the tilted planes.

**Example.** Solid 1 is a 10 × 20 × 30 mm box with one corner at the origin.

```text
> {"cmd": "draft", "s": 1, "faces": [[0, 10, 15]], "origin": [0, 0, 0], "pull": [0, 0, 1],
   "angle": 0.05}
< {"ok": 2}
```

## Refusals

A function **refuses** when it declines an input instead of returning a result. Any function may
refuse an input it cannot build correctly. Every function must refuse the inputs in the table at the
end of this section. The suite sends no other input outside what a definition requires, and a kernel
may give such an input a meaning of its own, as a height below zero that extrudes the other way.

How a refusal is made:

- The adapter passes each call to the kernel as it is. It does not check the input itself.
- When the kernel declines, by an error, an exception or no result at all, the adapter replies
  `{"err": reason, "kind": kind}` with the kernel's own reason, and goes on to the next request. In
  a Rust adapter, the `Kernel` method returns `Err(Refusal)`.
  [Requests and replies](#requests-and-replies) gives the reply.
- `kind` says why, as the kernel's own error tells it:

  | `kind`          | Meaning                                                                                   |
  | --------------- | ----------------------------------------------------------------------------------------- |
  | `"unsupported"` | The kernel has no way to do what is asked: not this function, or not with these arguments |
  | `"invalid"`     | The request is at fault: it describes no solid, or names an edge or a face not there      |
  | `"failed"`      | The kernel took the request as a fair one and could not carry it out                      |

  A reply with no `kind`, or one a client does not know, is read as `"failed"`. A kernel whose
  errors carry no such distinction answers `"failed"` throughout.

- A refusal is not a crash. A panic, or a process that dies, is a crash. Nor is an empty solid a
  refusal: two solids that do not overlap intersect in the empty solid, which is a result.

How a refusal is scored, under clause B18 of [contract.md](contract.md):

| The input       | The kernel                       | The case's outcome                |
| --------------- | -------------------------------- | --------------------------------- |
| Must be refused | Refuses as `invalid` or `failed` | Pass                              |
| Must be refused | Returns a solid                  | Fail, however plausible the solid |
| Is allowed      | Refuses as `invalid` or `failed` | Refused                           |
| Either          | Refuses as `unsupported`         | Unsupported: no judgement         |
| Either          | Crashes or hangs                 | Crash or timeout                  |

`unsupported` means the kernel has not built this: the function, or the function for arguments of
this sort. It is scored as a function the kernel's `hello` leaves out of `supports` is: the case is
left out of what the kernel is judged on. So a kernel is not marked down for saying plainly what it
cannot do, and is not given a pass for an input it never judged. An input that has no answer, such
as a fillet too big for its faces, is `invalid`, not `unsupported`.

The inputs every kernel must refuse:

| Input                                                                             | Functions                                              | Tested |
| --------------------------------------------------------------------------------- | ------------------------------------------------------ | ------ |
| A profile whose loops cross themselves or each other                              | Every constructor that takes a profile                 | Yes    |
| A profile whose hole lies outside it                                              | Every constructor that takes a profile                 | Yes    |
| A profile that crosses the axis                                                   | `revolve`, `screw`                                     | Yes    |
| Turns that meet                                                                   | `screw`                                                | Yes    |
| A tube wider than its ring                                                        | `torus`                                                | Yes    |
| Heights that do not rise                                                          | `loft_through`                                         | Yes    |
| A radius or distance too large for the faces it must fit on                       | Every fillet and chamfer                               | Yes    |
| One radius or distance of several, or a variable fillet's ball, that is too large | `fillet_radii`, `chamfer_distances`, `fillet_variable` | Yes    |
| A shell as thick as the part                                                      | `shell`                                                | Yes    |
| A face pushed through the part, or past the face it meets                         | `offset_faces`                                         | Yes    |
| A side, radius or height of zero, or a side or radius below it                    | `box`, `cylinder`, `sphere`, `extrude`                 | Yes    |
| A radius or distance of zero or less                                              | `fillet`, `chamfer`                                    | Yes    |
| A cone with no radius at either end                                               | `cone`                                                 | Yes    |
| A point that names no edge or face                                                | `fillet`, `chamfer`, `offset_faces`                    | Yes    |

A point names nothing when no edge, or no face, of the solid passes within `10·ε` of it. Where a
kernel takes its edges and faces by its own handles, its adapter finds the handle a point names, and
it is the adapter that refuses a point naming none.

## Exchange

A STEP file travels as a `string` holding the file's contents: all of its text, from `ISO-10303-21;`
to `END-ISO-10303-21;`, in the clear-text encoding of ISO 10303-21. It is never a path or a file
name: the kernel and the suite need not share a disk. The adapter hands the kernel that text as
UTF-8 bytes. The files the suite writes use only the standard's basic alphabet, which is plain
ASCII.

| Function                    | Fields              | Returns  |
| --------------------------- | ------------------- | -------- |
| [`write_step`](#write_step) | `s`                 | `string` |
| [`sew`](#sew)               | `text`, `tolerance` | `Solid`  |
| [`read_step`](#read_step)   | `text`              | `Solid`  |

### write_step

`write_step(s: Solid) -> string`

Writes the solid as a STEP file. Returns the file's contents, as a string.

The kernel chooses the schema, and the file's header names it: AP203, AP214 or AP242. The file must
be one another reader can read, not only the kernel that wrote it. Run with a second kernel as
`--peer`, the suite has that kernel read the file, and reports whether it reads the same solid.

**Example.** Solid 1 is a 10 × 20 × 30 mm box with one corner at the origin.

```text
> {"cmd": "write_step", "s": 1}
< {"ok": "ISO-10303-21;\nHEADER;\n
   FILE_DESCRIPTION(('springrep solid'),'2;1');… (10,474 characters)"}
```

### sew

`sew(text: string, tolerance: Length) -> Solid`

Sews the faces of a STEP file into one closed solid. `text` is the contents of a STEP file that
holds loose faces and no solid.

In a solid, two faces that meet share one edge, and that sharing is what makes its boundary closed.
A file of loose faces has lost it: each face is written as a surface of its own, with its own copy
of every edge and corner, so nothing in the file says which faces are neighbours. Files like this
come from tools that export surfaces, or that drop a solid's connections on the way out. Their faces
may not quite meet, and some may be written inside out.

Sewing joins the faces wherever their edges lie within `tolerance` of each other, and turns any
written inside out to face outward. Requires `tolerance` positive, and the faces to close into a
solid once joined. A prism whose faces are written loose and shifted apart by less than the
tolerance sews back into the prism, to within the shifts.

**Example.** The file holds the six faces of a 10 × 20 × 30 mm box, each written as its own surface
with its own edges and corners. Three are shifted off the box by less than 0.0001 mm, and one is
written inside out. Sewn, they close into the box: `volume` of the result gives 6000.04 mm³, the
box's 6000 to within the shifts.

```text
> {"cmd": "sew", "text": "ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION((''),'2;1');\n
   FILE_NAME('case','',(''),(''),'','','');\n
   FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214… (15,069 characters)", "tolerance": 0.002}
< {"ok": 1}
```

### read_step

`read_step(text: string) -> Solid`

Reads the solids a STEP file holds, together as one solid set. `text` is the contents of a STEP
file, in AP203, AP214 or AP242. A file written by `write_step` reads back as the same solid: the
same set of points within the tolerance.

**Example.** The text is the file `write_step` returned for the box.

```text
> {"cmd": "read_step", "text": "ISO-10303-21;\nHEADER;\n
   FILE_DESCRIPTION(('springrep solid'),'2;1');\n
   FILE_NAME('conformance','',(''),(''),'','springrep','');\nFILE_SCHEMA(('AU… (10,474 characters)"}
< {"ok": 1}
```

## Queries

| Function                        | Fields                                     | Returns                                                     |
| ------------------------------- | ------------------------------------------ | ----------------------------------------------------------- |
| [`volume`](#volume)             | `s`                                        | `Volume`                                                    |
| [`area`](#area)                 | `s`                                        | `Area`                                                      |
| [`classify`](#classify)         | `s`, `points`                              | `list<"in" or "on" or "out">`                               |
| [`closest`](#closest)           | `s`, `points`                              | `list<Point3>`                                              |
| [`normal`](#normal)             | `s`, `points`                              | `list<Vector3 or null>`                                     |
| [`curvature`](#curvature)       | `s`, `points`                              | `list<Number[2] or null>`                                   |
| [`check`](#check)               | `s`                                        | `list<string>`                                              |
| [`centroid`](#centroid)         | `s`                                        | `Point3 or null`                                            |
| [`inertia`](#inertia)           | `s`                                        | `Number[3][3]`                                              |
| [`distance`](#distance)         | `a`, `b`                                   | `Length`                                                    |
| [`interference`](#interference) | `a`, `b`                                   | `{volume: Volume, gap: Length}`                             |
| [`betti`](#betti)               | `s`                                        | `Count[3]`                                                  |
| [`section_area`](#section_area) | `s`, `origin`, `normal`                    | `Area`                                                      |
| [`section`](#section)           | `s`, `origin`, `normal`, `tolerance`       | `list<list<Point3>>`                                        |
| [`project`](#project)           | `s`, `direction`, `tolerance`              | `{visible: list<list<Point2>>, hidden: list<list<Point2>>}` |
| [`bounding_box`](#bounding_box) | `s`                                        | `Point3[2]`                                                 |
| [`split`](#split)               | `s`, `origin`, `normal`                    | `Solid[2]`                                                  |
| [`mesh`](#mesh)                 | `s`, `tolerance`                           | `{positions: list<Point3>, triangles: list<Index[3]>}`      |
| [`display`](#display)           | `s`, `tolerance`                           | `{faces: list<Face>, edges: list<list<Point3>>}`            |
| [`raycast`](#raycast)           | `s`, `origin`, `direction`; or `s`, `rays` | `list<Length>`; or `list<list<Length>>`                     |

### volume

`volume(s: Solid) -> Volume`

Measures how much space the solid fills.

The measure of `s`, mm³. Zero for an empty solid. A kernel that cannot measure the solid answers
`err`, never a number that is not one.

**Example.** Solid 1 is a 10 × 20 × 30 mm box with one corner at the origin.

```text
> {"cmd": "volume", "s": 1}
< {"ok": 6000.0}
```

### area

`area(s: Solid) -> Area`

Measures the total area of the solid's surface.

The measure of the boundary of `s`, mm². Zero for an empty solid. A kernel that cannot measure it
answers `err`.

**Example.** Solid 1 is a 10 × 20 × 30 mm box with one corner at the origin.

```text
> {"cmd": "area", "s": 1}
< {"ok": 2200.0}
```

### classify

`classify(s: Solid, points: list<Point3>) -> list<"in" or "on" or "out">`

Asks where each of many points lies against the solid.

For each point, in order: `"in"` where `s` holds it clear of its boundary, `"on"` where it lies on
the boundary, and `"out"` otherwise. The boundary is every point within `ε` of a face, an edge or a
vertex. A point further than `10·ε` from the boundary is `"in"` or `"out"`; one between may be given
as either or as `"on"`. A kernel that cannot place one of the points refuses the call: it gives no
answer for the others alone.

**Example.** Solid 1 is a 10 × 20 × 30 mm box with one corner at the origin. The second point lies
on its top face.

```text
> {"cmd": "classify", "s": 1, "points": [[5, 10, 15], [5, 10, 30], [20, 0, 0]]}
< {"ok": ["in", "on", "out"]}
```

### closest

`closest(s: Solid, points: list<Point3>) -> list<Point3>`

Finds the point of the solid nearest each point.

For each point, in order, a point of `s` no other point of `s` is nearer to. `s` is the solid, its
inside counted in, as for [`distance`](#distance): a point `s` holds is its own nearest point.
Outside `s` the nearest point lies on its boundary, on a face, an edge or a vertex. Where several
points are equally near, as round a ring from a point on a torus's axis, any one of them answers.

**Example.** Solid 1 is a 10 × 20 × 30 mm box with one corner at the origin. The first point is
inside it.

```text
> {"cmd": "closest", "s": 1, "points": [[5, 10, 15], [20, 10, 15]]}
< {"ok": [[5.0, 10.0, 15.0], [10.0, 10.0, 15.0]]}
```

### normal

`normal(s: Solid, points: list<Point3>) -> list<Vector3 or null>`

Gives the outward unit normal at each point of the solid's boundary. Where faces meet smoothly, as a
fillet meets the faces it rounds, the boundary still has a tangent plane, and its normal is both
faces' normal there; at a crease, where faces meet at an angle, there is none, and the answer is
null. A point off the boundary by more than `10·ε` is null too.

**Example.** Solid 1 is a 10 × 20 × 30 mm box with one corner at the origin. The second point lies
on an edge, a crease.

```text
> {"cmd": "normal", "s": 1, "points": [[5, 10, 30], [0, 0, 15]]}
< {"ok": [[0.0, 0.0, 1.0], null]}
```

### curvature

`curvature(s: Solid, points: list<Point3>) -> list<Number[2] or null>`

Gives the principal curvatures `[k1, k2]`, `k1 ≥ k2`, 1/mm, of the boundary at the point of it
nearest each point, which need not lie on it. A curvature is positive where the boundary bends away
from its outward normal, as on a ball, and negative where it bends toward it, as round a hole. Where
the nearest point lies on a crease the answer is null.

A plane has `[0, 0]`, a cylinder of radius `r` `[1/r, 0]`, a ball `[1/R, 1/R]`, a hole `[0, −1/r]`,
a cone `[cos α/ρ, 0]` where its side leans `α` from its axis at radius `ρ`, and a ring of radii `R`
and `r` at angle `φ` round its tube `1/r` and `cos φ/(R + r cos φ)`.

**Example.** Solid 1 is a cylinder of radius 5 on the z axis.

```text
> {"cmd": "curvature", "s": 1, "points": [[5, 0, 10]]}
< {"ok": [[0.2, 0.0]]}
```

### check

`check(s: Solid) -> list<string>`

Asks the kernel whether the solid is well formed.

The problems the kernel's own validity checker finds in `s`: empty when it finds `s` a valid solid
set as [Types](#types) defines it.

A checker that declines the solid refuses, as any function does, and has not found it valid: a
client reads a refusal as a problem found. A kernel with no checker leaves `check` out of its
`supports`, and its results are then not judged on validity.

**Example.** Solid 1 is a 10 × 20 × 30 mm box with one corner at the origin.

```text
> {"cmd": "check", "s": 1}
< {"ok": []}
```

### centroid

`centroid(s: Solid) -> Point3 or null`

Finds the solid's balance point, as if it were of uniform density.

`∭ r dV / volume(s)` over `s`; `null` when `s` is empty.

**Example.** Solid 1 is a 10 × 20 × 30 mm box with one corner at the origin.

```text
> {"cmd": "centroid", "s": 1}
< {"ok": [5.0, 10.0, 15.0]}
```

### inertia

`inertia(s: Solid) -> Number[3][3]`

Measures how the solid's material is spread about its centroid, as if it were of uniform density 1.

`∭ (|d|²·I − d dᵀ) dV` over `s`, with `d` the offset of each point from the centroid, in mm⁵: the
diagonal holds the moments about axes through the centroid, the rest the negated products. The
matrix is symmetric, so its rows and its columns are the same. All zero when `s` is empty.

**Example.** Solid 1 is a 10 × 20 × 30 mm box with one corner at the origin.

```text
> {"cmd": "inertia", "s": 1}
< {"ok": [[650000.0, -0.0, 0.0], [-0.0, 500000.0, 0.0], [0.0, 0.0, 250000.0]]}
```

### distance

`distance(a: Solid, b: Solid) -> Length`

Measures how far apart two solids are: the clearance between them.

The least `|p − q|` over points `p` of `a` and `q` of `b`, insides included: zero when they touch or
overlap, or one holds the other. Requires both non-empty.

**Example.** Solid 1 is a 10 × 20 × 30 mm box with one corner at the origin. Solid 2 is a ball of
radius 5 at x = 30.

```text
> {"cmd": "distance", "a": 1, "b": 2}
< {"ok": 15.0}
```

### interference

`interference(a: Solid, b: Solid) -> {volume: Volume, gap: Length}`

Says how two solids meet, as they stand: the volume they share, and the gap between them, the least
distance from a point of one to a point of the other. Two that overlap have a `volume` above 0 and a
`gap` of 0; two that only touch have 0 for both; two that are apart have a `volume` of 0 and their
`gap`. One held whole inside the other shares its own volume.

The function answers one pair. A client checking an assembly makes or moves each part to where it
stands and asks for the pairs it cannot rule out itself.

**Example.** Solid 1 is a 10 × 20 × 30 mm box with one corner at the origin. Solid 2 is a cylinder
of radius 5 and height 20 on the z axis.

```text
> {"cmd": "interference", "a": 1, "b": 2}
< {"ok": {"gap": 0.0, "volume": 392.699081699}}
```

### betti

`betti(s: Solid) -> Count[3]`

Counts the solid's separate pieces, the tunnels that run through it and the voids it encloses.

The solid set's Betti numbers `b0`, `b1`, `b2`. A box is `[1, 0, 0]`, a ring `[1, 1, 0]`, a plate
with `n` holes `[1, n, 0]`, a box with a ball removed from inside it `[1, 0, 1]`. Pieces that only
touch are one piece here, as the point set is connected.

**Example.** Solid 1 is a 10 × 20 × 30 mm box with one corner at the origin.

```text
> {"cmd": "betti", "s": 1}
< {"ok": [1, 0, 0]}
```

### section_area

`section_area(s: Solid, origin: Point3, normal: Vector3) -> Area`

Measures the area of the cut the plane through `origin` square to `normal` makes through the solid,
mm². Zero where the plane misses the solid.

**Example.** Solid 1 is a 10 × 20 × 30 mm box with one corner at the origin.

```text
> {"cmd": "section_area", "s": 1, "origin": [0, 0, 15], "normal": [0, 0, 1]}
< {"ok": 200.0}
```

### section

`section(s: Solid, origin: Point3, normal: Vector3, tolerance: Length) -> list<list<Point3>>`

Gives the curves the plane through `origin` square to `normal` cuts from the solid's boundary, in
pieces in any order. Each piece is a stretch of one curve as points along it from one end to the
other, two points or more. Every point lies on the plane and the boundary, and every chord between
consecutive points lies within `tolerance` of the curve. Requires `tolerance` positive.

The pieces join end to end into closed curves: each end of a piece lies within `10·ε` of an end of
another, and a piece that is a whole closed curve ends on its first point. A kernel returns the
pieces as it has them, one for each edge of the section or one for each curve. Joining them is the
client's part.

**Example.** Solid 1 is a 10 × 20 × 30 mm box with one corner at the origin.

```text
> {"cmd": "section", "s": 1, "origin": [0, 0, 15], "normal": [0, 0, 1], "tolerance": 0.01}
< {"ok": [[[10.0, -0.0, 15.0], [9.375, -0.0, 15.0], [8.75, -0.0, 15.0], [8.125, -0.0, 15.0],
   [7.5, -0.0, 15.0], [6.875, -0.0, 15.0], … 59 more]]}
```

### project

`project(s: Solid, direction: Vector3, tolerance: Length) -> {visible: list<list<Point2>>, hidden: list<list<Point2>>}`

Makes a hidden-line drawing of the solid seen looking along `direction`: its edges, and its outlines
where the line of sight grazes a curved face, each cut into the stretches the viewer sees and those
the solid hides. A point is hidden when the ray from it toward the viewer passes through the solid.
An edge between faces that meet smoothly, and a face's seam, are not drawn.

Each stretch is a polyline in the view plane, every vertex on it and every chord within `tolerance`
of it. Requires `tolerance` positive. The plane's axes are `u = d × z`, made unit, across (`d × x`
when `d` runs along z), and `v = −d × u`, up; a point `p` draws at `(p·u, p·v)`.

**Example.** Solid 1 is a 10 × 20 × 30 mm box with one corner at the origin.

```text
> {"cmd": "project", "s": 1, "direction": [0, 0, -1], "tolerance": 0.01}
< {"ok": {"hidden": [], "visible": [[[0.0, 0.0], [0.0, 0.625], [0.0, 1.25], [0.0, 1.875],
   [0.0, 2.5], [0.0, 3.125], … 11 more], [[0.0, 0.0], [0.0, 0.625], [0.0, 1.25], [0.0, 1.875],
   [0.0, 2.5], [0.0, 3.125], … 11 more], [[0.0, 10.0], [-1.25, 10.0], [-2.5, 10.0], [-3.75, 10.0],
   [-5.0, 10.0], [-6.25, 10.0], … 11 more], [[0.0, 10.0], [-1.25, 10.0], [-2.5, 10.0],
   [-3.75, 10.0], [-5.0, 10.0], [-6.25, 10.0], … 11 more], [[-20.0, 10.0], [-20.0, 9.375],
   [-20.0, 8.75], [-20.0, 8.125], [-20.0, 7.5], [-20.0, 6.875], … 11 more], [[-20.0, 10.0],
   [-20.0, 9.375], [-20.0, 8.75], [-20.0, 8.125], [-20.0, 7.5], [-20.0, 6.875], … 11 more],
   … 6 more]}}
```

### bounding_box

`bounding_box(s: Solid) -> Point3[2]`

Finds the least box with sides square to the axes that holds the solid, as its low and high corners:
not a box padded by the tolerance, nor one round the control points.

**Example.** Solid 1 is a 10 × 20 × 30 mm box with one corner at the origin.

```text
> {"cmd": "bounding_box", "s": 1}
< {"ok": [[0.0, 0.0, 0.0], [10.0, 20.0, 30.0]]}
```

### split

`split(s: Solid, origin: Point3, normal: Vector3) -> Solid[2]`

Cuts the solid by the plane through `origin` square to `normal`, giving the regularized part on the
normal's side, then the part on the other. Either may be empty, and either may be several pieces.

**Example.** Solid 1 is a 10 × 20 × 30 mm box with one corner at the origin.

```text
> {"cmd": "split", "s": 1, "origin": [0, 0, 15], "normal": [0, 0, 1]}
< {"ok": [2, 3]}
```

### mesh

`mesh(s: Solid, tolerance: Length) -> {positions: list<Point3>, triangles: list<Index[3]>}`

Covers the solid's boundary with triangles, none farther than `tolerance` from it. Requires
`tolerance` positive.

The mesh is closed: with positions within `10·ε` of each other read as one vertex, every edge
between two triangles is used once each way round, so the triangles, counter-clockwise seen from
outside, face outward. A kernel that meshes each face on its own may so repeat the vertices along an
edge, one for each face. The volume the mesh bounds is within `tolerance` times the area of the
solid's.

**Example.** Solid 1 is a 10 × 20 × 30 mm box with one corner at the origin.

```text
> {"cmd": "mesh", "s": 1, "tolerance": 0.5}
< {"ok": {"positions": [[0.0, 0.0, 0.0], [10.0, 0.0, 0.0], [10.0, 20.0, 0.0], [0.0, 20.0, 0.0],
   [0.0, 0.0, 30.0], [10.0, 0.0, 30.0], [10.0, 20.0, 30.0], [0.0, 20.0, 30.0]],
   "triangles": [[2, 1, 0], [3, 2, 0], [6, 4, 5], [4, 6, 7], [5, 0, 1], [0, 5, 4], … 6 more]}}
```

### display

`display(s: Solid, tolerance: Length) -> {faces: list<{positions: list<Point3>, normals: list<Vector3>, triangles: list<Index[3]>}>, edges: list<list<Point3>>}`

Draws the solid as a viewer shows it: each face meshed on its own, and its creases as polylines.

Each face has its own vertices, so shading is smooth within a face and sharp where two faces meet.
Every vertex lies on the face's surface, and `normals` gives the surface's outward unit normal at
each. The triangles are counter-clockwise seen from outside, and none lies farther than `tolerance`
from the face. Together the faces close the solid, as [`mesh`](#mesh) does.

`edges` holds each edge where two faces meet at an angle, as a polyline whose every vertex lies on
the edge and every chord within `tolerance` of it. A seam, where a face meets itself, and an edge
between two faces on one surface are not drawn.

The suite's runner draws the files it exports with `display` ([formats.md](formats.md#assets)).

**Example.** Solid 1 is a 10 × 20 × 30 mm box with one corner at the origin. One face and one edge
of each are shown.

```text
> {"cmd": "display", "s": 1, "tolerance": 0.1}
< {"ok": {"faces": [{"positions": [[10.0, 20.0, 0.0], [10.0, 0.0, 0.0], [0.0, 0.0, 0.0],
   [0.0, 20.0, 0.0]], "normals": [[-0.0, -0.0, -1.0], [-0.0, -0.0, -1.0], [-0.0, -0.0, -1.0],
   [-0.0, -0.0, -1.0]], "triangles": [[0, 1, 2], [3, 0, 2]]}, … 5 more], "edges": [[[0.0, 0.0, 0.0],
   [10.0, 0.0, 0.0]], … 11 more]}}
```

### raycast

`raycast(s: Solid, origin: Point3, direction: Vector3) -> list<Length>`

`raycast(s: Solid, rays: list<[Point3, Vector3]>) -> list<list<Length>>`

Finds where a ray meets the solid's faces: the distance from `origin` to each meeting, mm, in any
order. `direction` need not be a unit. A ray through an edge or a vertex meets every face there, and
a kernel may list that point once for each: a client reads meetings within `10·ε` of each other as
one crossing. A request may carry many rays at once: `rays`, a list of `[origin, direction]` pairs,
in place of `origin` and `direction`. The reply is then one list of distances for each ray, in the
rays' order. An adapter that reads only one ray per request refuses the many-ray form, and the
client falls back to one request per ray.

**Example.** Solid 1 is a 10 × 20 × 30 mm box with one corner at the origin.

```text
> {"cmd": "raycast", "s": 1, "origin": [-5, 10, 15], "direction": [1, 0, 0]}
< {"ok": [5.0, 15.0]}
```

## Moving a solid

| Function                  | Fields        | Returns |
| ------------------------- | ------------- | ------- |
| [`transform`](#transform) | `s`, `matrix` | `Solid` |
| [`affine`](#affine)       | `s`, `matrix` | `Solid` |

### transform

`transform(s: Solid, matrix: Number[3][4]) -> Solid`

Moves the solid by `p ↦ M·p + t`, the rows of `matrix` being `[M | t]`.

Requires `M` a similarity: an orthogonal matrix, a rotation or a mirror, times a nonzero scale `c`.
The result's volume is `|c|³` times the solid's and its area `c²` times; a mirror keeps it a valid
solid, its faces still facing outward. A part joined to its own mirror image is a `transform` and a
[`union`](#booleans): where the part has a face on the mirror plane, the two meet face to face.

**Example.** Solid 1 is a 10 × 20 × 30 mm box with one corner at the origin.

```text
> {"cmd": "transform", "s": 1, "matrix": [[1, 0, 0, 5], [0, 1, 0, 0], [0, 0, 1, 0]]}
< {"ok": 2}
```

### affine

`affine(s: Solid, matrix: Number[3][4]) -> Solid`

Maps the solid by `p ↦ M·p + t`, the rows of `matrix` being `[M | t]`, for any `M` with a nonzero
determinant: a stretch along any axes, a shear, a mirror, or a similarity.

The result's volume is `|det M|` times the solid's, and its centroid is `M·c + t`. A point lies
inside the result exactly when its preimage lies inside the solid. A surface element grows by
`|det M|·|M⁻ᵀ n|`, which lies between σ₂σ₃ and σ₁σ₂ for singular values σ₁ ≥ σ₂ ≥ σ₃, so the area
lies between those multiples of the solid's. A cylinder, sphere or torus stretched unevenly is no
longer one, and a kernel may carry such a face as a spline.

**Example.** Solid 1 is a 10 × 20 × 30 mm box with one corner at the origin.

```text
> {"cmd": "affine", "s": 1, "matrix": [[2, 0, 0, 0], [0, 1, 0, 0], [0, 0, 0.5, 0]]}
< {"ok": 2}
```
