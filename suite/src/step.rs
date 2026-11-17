//! STEP files the suite writes itself, so a kernel's reader can be judged against solids whose
//! every point is known, in AP214: prisms on straight-sided profiles as planar faces, and
//! cylinders and frustums as a cylindrical or conical face closed by a seam, between two discs.

use std::collections::HashMap;
use std::fmt::Write;

use crate::model::{Frame, Primitive, Vec3};
use crate::profile::Seg;

/// A STEP number: Part 21 wants a decimal point in every real.
fn real(x: f64) -> String {
    let s = format!("{x:.17E}");
    let (m, e) = s.split_once('E').unwrap_or((&s, "0"));
    format!("{m}E{e}")
}

struct Writer {
    lines: Vec<String>,
}

impl Writer {
    fn add(&mut self, entity: String) -> usize {
        self.lines.push(entity);
        self.lines.len()
    }

    fn point(&mut self, p: Vec3) -> usize {
        self.add(format!(
            "CARTESIAN_POINT('',({},{},{}))",
            real(p[0]),
            real(p[1]),
            real(p[2])
        ))
    }

    fn direction(&mut self, d: Vec3) -> usize {
        self.add(format!(
            "DIRECTION('',({},{},{}))",
            real(d[0]),
            real(d[1]),
            real(d[2])
        ))
    }

    fn placement(&mut self, origin: Vec3, z: Vec3, x: Vec3) -> usize {
        let (o, z, x) = (self.point(origin), self.direction(z), self.direction(x));
        self.add(format!("AXIS2_PLACEMENT_3D('',#{o},#{z},#{x})"))
    }
}

fn sub(a: Vec3, b: Vec3) -> Vec3 {
    [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

fn cross(a: Vec3, b: Vec3) -> Vec3 {
    [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]
}

fn unit(v: Vec3) -> Vec3 {
    let n = (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]).sqrt();
    [v[0] / n, v[1] / n, v[2] / n]
}

/// The polygon a straight-sided profile's one loop runs through, or `None` for any other.
fn polygon(p: &Primitive) -> Option<(Frame, Vec<[f64; 2]>, f64)> {
    let Primitive::Extrude {
        frame,
        profile,
        height,
    } = p
    else {
        return None;
    };
    let [lp] = profile.loops.as_slice() else {
        return None;
    };
    let pts = lp
        .iter()
        .map(|s| match s {
            Seg::Line { a, .. } => Some(*a),
            _ => None,
        })
        .collect::<Option<Vec<_>>>()?;
    Some((*frame, pts, *height))
}

/// A writer holding the file's product, units and representation context: entities #1–#14.
fn begin() -> Writer {
    let mut w = Writer { lines: Vec::new() };
    let ctx = [
        "APPLICATION_CONTEXT('automotive design')".to_string(),
        "APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000,#1)"
            .to_string(),
        "PRODUCT_CONTEXT('',#1,'mechanical')".to_string(),
        "PRODUCT('case','case','',(#3))".to_string(),
        "PRODUCT_DEFINITION_FORMATION('','',#4)".to_string(),
        "PRODUCT_DEFINITION_CONTEXT('part definition',#1,'design')".to_string(),
        "PRODUCT_DEFINITION('design','',#5,#6)".to_string(),
        "PRODUCT_DEFINITION_SHAPE('','',#7)".to_string(),
        "SHAPE_DEFINITION_REPRESENTATION(#8,#REP)".to_string(),
        "(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.))".to_string(),
        "(NAMED_UNIT(*)PLANE_ANGLE_UNIT()SI_UNIT($,.RADIAN.))".to_string(),
        "(NAMED_UNIT(*)SI_UNIT($,.STERADIAN.)SOLID_ANGLE_UNIT())".to_string(),
        "UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-07),#10,'distance_accuracy_value','')"
            .to_string(),
        "(GEOMETRIC_REPRESENTATION_CONTEXT(3)GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#13))\
         GLOBAL_UNIT_ASSIGNED_CONTEXT((#10,#11,#12))REPRESENTATION_CONTEXT('',''))"
            .to_string(),
    ];
    for c in ctx {
        w.add(c);
    }
    w
}

/// The file: the faces as one closed shell of one solid, after the header.
fn finish(mut w: Writer, faces: &[usize]) -> String {
    let list: Vec<String> = faces.iter().map(|f| format!("#{f}")).collect();
    let shell = w.add(format!("CLOSED_SHELL('',({}))", list.join(",")));
    let solid = w.add(format!("MANIFOLD_SOLID_BREP('',#{shell})"));
    let origin = w.placement([0.0; 3], [0.0, 0.0, 1.0], [1.0, 0.0, 0.0]);
    let rep = w.add(format!(
        "ADVANCED_BREP_SHAPE_REPRESENTATION('',(#{origin},#{solid}),#14)"
    ));
    document(&w, rep)
}

/// The Part 21 text of the writer's entities, `#REP` naming the representation `rep`.
fn document(w: &Writer, rep: usize) -> String {
    let mut out = String::from(
        "ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION((''),'2;1');\n\
         FILE_NAME('case','',(''),(''),'','','');\n\
         FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));\nENDSEC;\nDATA;\n",
    );
    for (i, l) in w.lines.iter().enumerate() {
        let l = l.replace("#REP", &format!("#{rep}"));
        let _ = writeln!(out, "#{}={};", i + 1, l);
    }
    out.push_str("ENDSEC;\nEND-ISO-10303-21;\n");
    out
}

/// The prism as a STEP file: a product with one manifold solid of planar faces, each face's loop
/// counter-clockwise seen from outside, each edge written once and used once each way round.
pub fn prism(p: &Primitive) -> Option<String> {
    let (f, pts, h) = polygon(p)?;
    let world = |u: f64, v: f64, w: f64| {
        [0, 1, 2].map(|k| f.origin[k] + f.x[k] * u + f.y[k] * v + f.z[k] * w)
    };
    let n = pts.len();
    let mut w = begin();
    // Vertices: the bottom polygon, then the top.
    let mut verts = Vec::new();
    for layer in [0.0, h] {
        for q in &pts {
            let p = w.point(world(q[0], q[1], layer));
            verts.push(w.add(format!("VERTEX_POINT('',#{p})")));
        }
    }
    let at = |i: usize, top: bool| world(pts[i % n][0], pts[i % n][1], if top { h } else { 0.0 });
    let vid = |i: usize, top: bool| (i % n) + if top { n } else { 0 };
    // Each edge once, by its vertex pair in index order.
    let mut edges: HashMap<(usize, usize), usize> = HashMap::new();
    let mut edge = |w: &mut Writer, a: usize, b: usize, pa: Vec3, pb: Vec3| -> String {
        let key = (a.min(b), a.max(b));
        let forward = a < b;
        let id = *edges.entry(key).or_insert_with(|| {
            let (from, to) = if forward { (pa, pb) } else { (pb, pa) };
            let d = sub(to, from);
            let len = (d[0] * d[0] + d[1] * d[1] + d[2] * d[2]).sqrt();
            let start = w.point(from);
            let dir = w.direction(unit(d));
            let vec = w.add(format!("VECTOR('',#{dir},{})", real(len)));
            let line = w.add(format!("LINE('',#{start},#{vec})"));
            let (v0, v1) = (verts[key.0], verts[key.1]);
            w.add(format!("EDGE_CURVE('',#{v0},#{v1},#{line},.T.)"))
        });
        let sense = if forward { ".T." } else { ".F." };
        let oe = w.add(format!("ORIENTED_EDGE('',*,*,#{id},{sense})"));
        format!("#{oe}")
    };
    let mut faces = Vec::new();
    let mut face = |w: &mut Writer, ring: &[(usize, Vec3)]| {
        let oes: Vec<String> = (0..ring.len())
            .map(|k| {
                let (a, pa) = ring[k];
                let (b, pb) = ring[(k + 1) % ring.len()];
                edge(w, a, b, pa, pb)
            })
            .collect();
        // The plane through the ring, its normal outward by the ring's turn (Newell).
        let mut nrm = [0.0; 3];
        for k in 0..ring.len() {
            let (p, q) = (ring[k].1, ring[(k + 1) % ring.len()].1);
            nrm[0] += (p[1] - q[1]) * (p[2] + q[2]);
            nrm[1] += (p[2] - q[2]) * (p[0] + q[0]);
            nrm[2] += (p[0] - q[0]) * (p[1] + q[1]);
        }
        let nrm = unit(nrm);
        let x = unit(sub(ring[1].1, ring[0].1));
        let x = unit(cross(cross(nrm, x), nrm));
        let place = w.placement(ring[0].1, nrm, x);
        let plane = w.add(format!("PLANE('',#{place})"));
        let lp = w.add(format!("EDGE_LOOP('',({}))", oes.join(",")));
        let bound = w.add(format!("FACE_OUTER_BOUND('',#{lp},.T.)"));
        faces.push(w.add(format!("ADVANCED_FACE('',(#{bound}),#{plane},.T.)")));
    };
    let bottom: Vec<(usize, Vec3)> = (0..n)
        .rev()
        .map(|i| (vid(i, false), at(i, false)))
        .collect();
    face(&mut w, &bottom);
    let top: Vec<(usize, Vec3)> = (0..n).map(|i| (vid(i, true), at(i, true))).collect();
    face(&mut w, &top);
    for i in 0..n {
        let ring = [
            (vid(i, false), at(i, false)),
            (vid(i + 1, false), at(i + 1, false)),
            (vid(i + 1, true), at(i + 1, true)),
            (vid(i, true), at(i, true)),
        ];
        face(&mut w, &ring);
    }
    Some(finish(w, &faces))
}

/// The prism as loose planar faces: each face with its own vertices and edges, shifted
/// `gaps[f]` along its outward normal, and written inside out where `flipped[f]`, as a surface
/// model of one open shell per face. Faces run bottom, top, then the sides in profile order.
pub fn loose(p: &Primitive, gaps: &[f64], flipped: &[bool]) -> Option<String> {
    let (f, pts, h) = polygon(p)?;
    let world = |u: f64, v: f64, w: f64| {
        [0, 1, 2].map(|k| f.origin[k] + f.x[k] * u + f.y[k] * v + f.z[k] * w)
    };
    let n = pts.len();
    let at = |i: usize, top: bool| world(pts[i % n][0], pts[i % n][1], if top { h } else { 0.0 });
    let mut rings: Vec<Vec<Vec3>> = vec![
        (0..n).rev().map(|i| at(i, false)).collect(),
        (0..n).map(|i| at(i, true)).collect(),
    ];
    for i in 0..n {
        rings.push(vec![
            at(i, false),
            at(i + 1, false),
            at(i + 1, true),
            at(i, true),
        ]);
    }
    let mut w = begin();
    let mut shells = Vec::new();
    for (k, ring) in rings.iter().enumerate() {
        let mut nrm = [0.0; 3];
        for j in 0..ring.len() {
            let (p, q) = (ring[j], ring[(j + 1) % ring.len()]);
            nrm[0] += (p[1] - q[1]) * (p[2] + q[2]);
            nrm[1] += (p[2] - q[2]) * (p[0] + q[0]);
            nrm[2] += (p[0] - q[0]) * (p[1] + q[1]);
        }
        let nrm = unit(nrm);
        let g = gaps.get(k).copied().unwrap_or(0.0);
        let mut ring: Vec<Vec3> = ring
            .iter()
            .map(|q| [0, 1, 2].map(|i| q[i] + g * nrm[i]))
            .collect();
        let nrm = if flipped.get(k).copied().unwrap_or(false) {
            ring.reverse();
            nrm.map(|x| -x)
        } else {
            nrm
        };
        let verts: Vec<usize> = ring
            .iter()
            .map(|&q| {
                let p = w.point(q);
                w.add(format!("VERTEX_POINT('',#{p})"))
            })
            .collect();
        let oes: Vec<String> = (0..ring.len())
            .map(|j| {
                let (a, b) = (ring[j], ring[(j + 1) % ring.len()]);
                let d = sub(b, a);
                let len = (d[0] * d[0] + d[1] * d[1] + d[2] * d[2]).sqrt();
                let start = w.point(a);
                let dir = w.direction(unit(d));
                let vec = w.add(format!("VECTOR('',#{dir},{})", real(len)));
                let line = w.add(format!("LINE('',#{start},#{vec})"));
                let (v0, v1) = (verts[j], verts[(j + 1) % ring.len()]);
                let e = w.add(format!("EDGE_CURVE('',#{v0},#{v1},#{line},.T.)"));
                let oe = w.add(format!("ORIENTED_EDGE('',*,*,#{e},.T.)"));
                format!("#{oe}")
            })
            .collect();
        let x = unit(sub(ring[1], ring[0]));
        let x = unit(cross(cross(nrm, x), nrm));
        let place = w.placement(ring[0], nrm, x);
        let plane = w.add(format!("PLANE('',#{place})"));
        let lp = w.add(format!("EDGE_LOOP('',({}))", oes.join(",")));
        let bound = w.add(format!("FACE_OUTER_BOUND('',#{lp},.T.)"));
        let face = w.add(format!("ADVANCED_FACE('',(#{bound}),#{plane},.T.)"));
        shells.push(w.add(format!("OPEN_SHELL('',(#{face}))")));
    }
    let list: Vec<String> = shells.iter().map(|s| format!("#{s}")).collect();
    let model = w.add(format!(
        "SHELL_BASED_SURFACE_MODEL('',({}))",
        list.join(",")
    ));
    let origin = w.placement([0.0; 3], [0.0, 0.0, 1.0], [1.0, 0.0, 0.0]);
    let rep = w.add(format!(
        "MANIFOLD_SURFACE_SHAPE_REPRESENTATION('',(#{origin},#{model}),#14)"
    ));
    Some(document(&w, rep))
}

/// The solid as a STEP file, where the suite can write it: a prism on a straight-sided profile, a
/// cylinder or a frustum.
pub fn write(p: &Primitive) -> Option<String> {
    prism(p).or_else(|| revolved(p))
}

/// A cylinder or a frustum with both ends open as a STEP file. Its side is one face whose loop runs
/// the bottom circle, up the seam, back round the top circle and down the seam: the seam is one edge
/// used both ways in one face, as CAD tools write a closed surface of revolution.
fn revolved(p: &Primitive) -> Option<String> {
    let (f, bottom, top, h) = match *p {
        Primitive::Cylinder {
            frame,
            radius,
            height,
        } => (frame, radius, radius, height),
        Primitive::Cone {
            frame,
            bottom,
            top,
            height,
        } if bottom > 0.0 && top > 0.0 => (frame, bottom, top, height),
        _ => return None,
    };
    let at = |u: f64, w: f64| [0, 1, 2].map(|k| f.origin[k] + f.x[k] * u + f.z[k] * w);
    let up = f.z;
    let down = up.map(|x| -x);
    let mut w = begin();
    let (pb, pt) = (w.point(at(bottom, 0.0)), w.point(at(top, h)));
    let (vb, vt) = (
        w.add(format!("VERTEX_POINT('',#{pb})")),
        w.add(format!("VERTEX_POINT('',#{pt})")),
    );
    let ring = |w: &mut Writer, z: f64, r: f64, v: usize| {
        let place = w.placement(at(0.0, z), up, f.x);
        let c = w.add(format!("CIRCLE('',#{place},{})", real(r)));
        w.add(format!("EDGE_CURVE('',#{v},#{v},#{c},.T.)"))
    };
    let (cb, ct) = (ring(&mut w, 0.0, bottom, vb), ring(&mut w, h, top, vt));
    let d = sub(at(top, h), at(bottom, 0.0));
    let len = (d[0] * d[0] + d[1] * d[1] + d[2] * d[2]).sqrt();
    let (start, dir) = (w.point(at(bottom, 0.0)), w.direction(unit(d)));
    let vec = w.add(format!("VECTOR('',#{dir},{})", real(len)));
    let line = w.add(format!("LINE('',#{start},#{vec})"));
    let seam = w.add(format!("EDGE_CURVE('',#{vb},#{vt},#{line},.T.)"));
    let mut faces = Vec::new();
    let mut face = |w: &mut Writer, surface: usize, edges: &[(usize, bool)]| {
        let oes: Vec<String> = edges
            .iter()
            .map(|&(e, sense)| {
                let s = if sense { ".T." } else { ".F." };
                format!("#{}", w.add(format!("ORIENTED_EDGE('',*,*,#{e},{s})")))
            })
            .collect();
        let lp = w.add(format!("EDGE_LOOP('',({}))", oes.join(",")));
        let bound = w.add(format!("FACE_OUTER_BOUND('',#{lp},.T.)"));
        faces.push(w.add(format!("ADVANCED_FACE('',(#{bound}),#{surface},.T.)")));
    };
    let place = w.placement(at(0.0, 0.0), down, f.x);
    let plane = w.add(format!("PLANE('',#{place})"));
    face(&mut w, plane, &[(cb, false)]);
    let place = w.placement(at(0.0, h), up, f.x);
    let plane = w.add(format!("PLANE('',#{place})"));
    face(&mut w, plane, &[(ct, true)]);
    // A cone's radius grows along its placement's axis, so it is placed at its narrower end.
    let side = if bottom == top {
        let place = w.placement(at(0.0, 0.0), up, f.x);
        w.add(format!("CYLINDRICAL_SURFACE('',#{place},{})", real(bottom)))
    } else {
        let (z, axis, r) = if bottom < top {
            (0.0, up, bottom)
        } else {
            (h, down, top)
        };
        let place = w.placement(at(0.0, z), axis, f.x);
        let semi = ((top - bottom).abs() / h).atan();
        w.add(format!(
            "CONICAL_SURFACE('',#{place},{},{})",
            real(r),
            real(semi)
        ))
    };
    face(
        &mut w,
        side,
        &[(cb, true), (seam, true), (ct, false), (seam, false)],
    );
    Some(finish(w, &faces))
}

/// An application protocol a file can name: the B-rep entities are the same in each, and only the
/// file's schema and its application context differ.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Schema {
    /// Configuration-controlled design.
    Ap203,
    /// Managed model-based 3D engineering.
    Ap242,
}

impl Schema {
    /// An AP214 file from this module, as the same file under this protocol.
    pub fn apply(self, text: &str) -> String {
        let (schema, context, protocol) = match self {
            Schema::Ap203 => (
                "CONFIG_CONTROL_DESIGN",
                "configuration controlled 3d designs of mechanical parts and assemblies",
                "'config_control_design',1994",
            ),
            Schema::Ap242 => (
                "AP242_MANAGED_MODEL_BASED_3D_ENGINEERING_MIM_LF { 1 0 10303 442 1 1 4 }",
                "managed model based 3d engineering",
                "'ap242_managed_model_based_3d_engineering',2011",
            ),
        };
        text.replace("AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }", schema)
            .replace("'automotive design'", &format!("'{context}'"))
            .replace("'automotive_design',2000", protocol)
    }
}

/// A prism on a convex straight-sided profile as an AP242 tessellated solid: its faces as one set
/// of triangles over one list of points, with no surfaces.
pub fn tessellated(p: &Primitive) -> Option<String> {
    let (f, pts, h) = polygon(p)?;
    let n = pts.len();
    let world = |u: f64, v: f64, w: f64| {
        [0, 1, 2].map(|k| f.origin[k] + f.x[k] * u + f.y[k] * v + f.z[k] * w)
    };
    let coords: Vec<String> = [0.0, h]
        .iter()
        .flat_map(|&z| pts.iter().map(move |q| (q, z)))
        .map(|(q, z)| {
            let c = world(q[0], q[1], z);
            format!("({},{},{})", real(c[0]), real(c[1]), real(c[2]))
        })
        .collect();
    // 1-based: bottom 1..=n, top n+1..=2n; each triangle counter-clockwise seen from outside.
    let mut tris = Vec::new();
    for i in 1..n - 1 {
        tris.push((1, i + 2, i + 1));
        tris.push((n + 1, n + i + 1, n + i + 2));
    }
    for i in 0..n {
        let j = (i + 1) % n;
        tris.push((i + 1, j + 1, n + j + 1));
        tris.push((i + 1, n + j + 1, n + i + 1));
    }
    let tri: Vec<String> = tris
        .iter()
        .map(|(a, b, c)| format!("({a},{b},{c})"))
        .collect();
    let mut w = begin();
    let list = w.add(format!(
        "COORDINATES_LIST('',{},({}))",
        coords.len(),
        coords.join(",")
    ));
    let face = w.add(format!(
        "TRIANGULATED_FACE('',#{list},0,(),$,(),({}))",
        tri.join(",")
    ));
    let solid = w.add(format!("TESSELLATED_SOLID('',(#{face}),$)"));
    let rep = w.add(format!(
        "TESSELLATED_SHAPE_REPRESENTATION('',(#{solid}),#14)"
    ));
    let mut out = String::from(
        "ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION((''),'2;1');\n\
         FILE_NAME('case','',(''),(''),'','','');\n\
         FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));\nENDSEC;\nDATA;\n",
    );
    for (i, l) in w.lines.iter().enumerate() {
        let l = l.replace("#REP", &format!("#{rep}"));
        let _ = writeln!(out, "#{}={};", i + 1, l);
    }
    out.push_str("ENDSEC;\nEND-ISO-10303-21;\n");
    Some(Schema::Ap242.apply(&out))
}
