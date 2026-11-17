//! Mass properties at unit density, as raw moments about the world origin: volume `∭ dV`, first
//! moments `∭ r dV` and second moments `∭ r rᵀ dV`. Raw moments add over disjoint pieces, so the
//! identities booleans obey for volume hold for them too. Each primitive's are exact: every kind is
//! an extrusion, revolution, screw or loft of a profile, whose moments reduce to the profile's area
//! moments (Green's theorem) and a one-dimensional integral along the sweep.

use std::f64::consts::{PI, TAU};

use crate::model::{Frame, Primitive, Rigid, Vec3};
use crate::profile::{Profile, Seg, circle, rounded};

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct Moments {
    pub v: f64,
    pub f: Vec3,
    pub s: [[f64; 3]; 3],
}

/// Five-point Gauss–Legendre nodes and weights on [−1, 1].
const GX: [f64; 5] = [
    -0.906_179_845_938_664,
    -0.538_469_310_105_683,
    0.0,
    0.538_469_310_105_683,
    0.906_179_845_938_664,
];
const GW: [f64; 5] = [
    0.236_926_885_056_189,
    0.478_628_670_499_366,
    0.568_888_888_888_889,
    0.478_628_670_499_366,
    0.236_926_885_056_189,
];

/// ∫ g over [a, b] in `n` pieces of five-point Gauss.
fn gauss(a: f64, b: f64, n: usize, mut g: impl FnMut(f64, f64)) {
    for piece in 0..n {
        let (lo, hi) = (
            a + (b - a) * piece as f64 / n as f64,
            a + (b - a) * (piece + 1) as f64 / n as f64,
        );
        for (x, w) in GX.iter().zip(GW) {
            g(0.5 * (lo + hi) + 0.5 * (hi - lo) * x, 0.5 * (hi - lo) * w);
        }
    }
}

impl Moments {
    pub fn plus(&self, o: &Moments, sign: f64) -> Moments {
        let mut m = *self;
        m.v += sign * o.v;
        for i in 0..3 {
            m.f[i] += sign * o.f[i];
            for j in 0..3 {
                m.s[i][j] += sign * o.s[i][j];
            }
        }
        m
    }

    /// From a kernel's volume, centroid and inertia about the centroid: `∭ d dᵀ` about the centroid
    /// is `tr(J)/2·I − J`, and moving it to the origin adds `V·c cᵀ`.
    pub fn from_mass(v: f64, c: Option<Vec3>, j: [[f64; 3]; 3]) -> Moments {
        let c = c.unwrap_or([0.0; 3]);
        let half = 0.5 * (j[0][0] + j[1][1] + j[2][2]);
        let mut m = Moments {
            v,
            f: [v * c[0], v * c[1], v * c[2]],
            s: [[0.0; 3]; 3],
        };
        for a in 0..3 {
            for b in 0..3 {
                let own = if a == b { half } else { 0.0 } - j[a][b];
                m.s[a][b] = own + v * c[a] * c[b];
            }
        }
        m
    }

    /// The moments after the rigid motion `r ↦ R·r + t`.
    pub fn moved(&self, m: &Rigid) -> Moments {
        let rf = m.rotate(self.f);
        let t = m.t;
        let mut out = Moments {
            v: self.v,
            f: [
                self.v * t[0] + rf[0],
                self.v * t[1] + rf[1],
                self.v * t[2] + rf[2],
            ],
            s: [[0.0; 3]; 3],
        };
        for a in 0..3 {
            for b in 0..3 {
                let mut rsr = 0.0;
                for k in 0..3 {
                    for l in 0..3 {
                        rsr += m.r[a][k] * self.s[k][l] * m.r[b][l];
                    }
                }
                out.s[a][b] = self.v * t[a] * t[b] + t[a] * rf[b] + rf[a] * t[b] + rsr;
            }
        }
        out
    }

    /// The moments after the affine map `r ↦ M·r + t`, rows `[M | t]`: every volume element grows
    /// by |det M|, so `∭ r' r'ᵀ` is |det M|·(M S Mᵀ + t (M f)ᵀ + (M f) tᵀ + V t tᵀ).
    pub fn mapped(&self, m: &[[f64; 4]; 3]) -> Moments {
        let det = m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
            - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
            + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
        let d = det.abs();
        let t = [m[0][3], m[1][3], m[2][3]];
        let mf = [0, 1, 2].map(|i| (0..3).map(|k| m[i][k] * self.f[k]).sum::<f64>());
        let mut out = Moments {
            v: d * self.v,
            f: [0, 1, 2].map(|i| d * (mf[i] + self.v * t[i])),
            s: [[0.0; 3]; 3],
        };
        for a in 0..3 {
            for b in 0..3 {
                let mut msm = 0.0;
                for k in 0..3 {
                    for l in 0..3 {
                        msm += m[a][k] * self.s[k][l] * m[b][l];
                    }
                }
                out.s[a][b] = d * (msm + t[a] * mf[b] + mf[a] * t[b] + self.v * t[a] * t[b]);
            }
        }
        out
    }

    /// The largest difference in the first moments, and in the second.
    pub fn gap(&self, o: &Moments) -> (f64, f64) {
        let first = (0..3)
            .map(|i| (self.f[i] - o.f[i]).abs())
            .fold(0.0, f64::max);
        let second = (0..3)
            .flat_map(|i| (0..3).map(move |j| (i, j)))
            .map(|(i, j)| (self.s[i][j] - o.s[i][j]).abs())
            .fold(0.0, f64::max);
        (first, second)
    }
}

/// The rotation and origin of a frame, as the motion from its local coordinates to the world.
fn placing(f: &Frame) -> Rigid {
    Rigid {
        r: [
            [f.x[0], f.y[0], f.z[0]],
            [f.x[1], f.y[1], f.z[1]],
            [f.x[2], f.y[2], f.z[2]],
        ],
        t: f.origin,
    }
}

/// The primitive's moments about the world origin.
pub fn of(p: &Primitive) -> Moments {
    if let Primitive::Sweep { .. } = p {
        // Its pieces meet only on the joints' planes, so their moments add.
        return p
            .pieces()
            .iter()
            .fold(Moments::default(), |m, q| m.plus(&of(q), 1.0));
    }
    local(p).moved(&placing(&p.frame()))
}

fn local(p: &Primitive) -> Moments {
    match p {
        Primitive::Sweep { .. } => unreachable!("a sweep's moments are its pieces'"),
        Primitive::SweepPath {
            profile,
            path,
            twist,
            ..
        } => {
            let (v, f, s) = brep_protocol::path::PathSweep::new(path, profile, *twist).moments();
            Moments { v, f, s }
        }
        Primitive::Slab { size, .. } => {
            // Each column from 0 to f contributes its integrals in z in closed form; the
            // footprint is integrated by Gauss over the knot spans.
            let f = p.height_field().expect("a slab");
            let (a, b) = (size[0], size[1]);
            let i = |g: &dyn Fn(f64, f64, f64) -> f64| {
                a * b * f.integrate(|z, _, _, u, v| g(z, a * u, b * v))
            };
            let m = Moments {
                v: i(&|z, _, _| z),
                f: [
                    i(&|z, x, _| x * z),
                    i(&|z, _, y| y * z),
                    i(&|z, _, _| z * z / 2.0),
                ],
                s: [
                    [
                        i(&|z, x, _| x * x * z),
                        i(&|z, x, y| x * y * z),
                        i(&|z, x, _| x * z * z / 2.0),
                    ],
                    [0.0, i(&|z, _, y| y * y * z), i(&|z, _, y| y * z * z / 2.0)],
                    [0.0, 0.0, i(&|z, _, _| z * z * z / 3.0)],
                ],
            };
            symmetric(m)
        }
        Primitive::Box { size, .. } => {
            let sq = [
                [0.0, 0.0],
                [size[0], 0.0],
                [size[0], size[1]],
                [0.0, size[1]],
            ];
            let profile = Profile {
                loops: vec![rounded(&sq, &[0.0; 4])],
            };
            extruded(&profile, size[2])
        }
        Primitive::Cylinder { radius, height, .. } => {
            let profile = Profile {
                loops: vec![circle([0.0; 2], *radius, true)],
            };
            extruded(&profile, *height)
        }
        Primitive::Sphere { radius, .. } => {
            let half = vec![
                Seg::Arc {
                    center: [0.0; 2],
                    radius: *radius,
                    start: -PI / 2.0,
                    sweep: PI,
                },
                Seg::Line {
                    a: [0.0, *radius],
                    b: [0.0, -radius],
                },
            ];
            screwed(&Profile { loops: vec![half] }, 0.0, TAU)
        }
        Primitive::Torus { major, minor, .. } => {
            let profile = Profile {
                loops: vec![circle([*major, 0.0], *minor, true)],
            };
            screwed(&profile, 0.0, TAU)
        }
        Primitive::Cone {
            bottom,
            top,
            height,
            ..
        } => {
            let pts = [[0.0, 0.0], [*bottom, 0.0], [*top, *height], [0.0, *height]];
            let segs = (0..4)
                .filter(|&i| pts[i] != pts[(i + 1) % 4])
                .map(|i| Seg::Line {
                    a: pts[i],
                    b: pts[(i + 1) % 4],
                })
                .collect();
            screwed(&Profile { loops: vec![segs] }, 0.0, TAU)
        }
        Primitive::Extrude {
            profile, height, ..
        } => extruded(profile, *height),
        Primitive::Revolve { profile, angle, .. } => screwed(profile, 0.0, *angle),
        Primitive::Screw {
            profile,
            rise,
            angle,
            ..
        } => screwed(profile, *rise, *angle),
        Primitive::Loft {
            profile,
            scale,
            height,
            ..
        } => lofted(profile, *scale, *height),
    }
}

fn extruded(p: &Profile, h: f64) -> Moments {
    let q = |k, m| p.area_moment(k, m);
    let (a, mu, mv) = (q(0, 0), q(1, 0), q(0, 1));
    let (iuu, iuv, ivv) = (q(2, 0), q(1, 1), q(0, 2));
    Moments {
        v: a * h,
        f: [mu * h, mv * h, a * h * h / 2.0],
        s: [
            [iuu * h, iuv * h, mu * h * h / 2.0],
            [iuv * h, ivv * h, mv * h * h / 2.0],
            [mu * h * h / 2.0, mv * h * h / 2.0, a * h * h * h / 3.0],
        ],
    }
}

/// A profile in the (ρ, w) half-plane turned about z through `angle` while rising `rise` per
/// radian: the section at turn φ is `(ρ cos φ, ρ sin φ, w + rise·φ)`, its volume element `ρ dA dφ`.
/// The section's moments are the profile's area moments; the turn is integrated by Gauss.
fn screwed(p: &Profile, rise: f64, angle: f64) -> Moments {
    let q = |k, m| p.area_moment(k, m);
    let (q10, q20, q11, q30, q21, q12) = (q(1, 0), q(2, 0), q(1, 1), q(3, 0), q(2, 1), q(1, 2));
    let mut m = Moments::default();
    let pieces = (angle / 0.25).ceil() as usize;
    gauss(0.0, angle, pieces, |phi, w| {
        let (s, c) = phi.sin_cos();
        let lift = rise * phi;
        m.v += w * q10;
        m.f[0] += w * c * q20;
        m.f[1] += w * s * q20;
        m.f[2] += w * (q11 + lift * q10);
        m.s[0][0] += w * c * c * q30;
        m.s[1][1] += w * s * s * q30;
        m.s[0][1] += w * s * c * q30;
        m.s[0][2] += w * c * (q21 + lift * q20);
        m.s[1][2] += w * s * (q21 + lift * q20);
        m.s[2][2] += w * (q12 + 2.0 * lift * q11 + lift * lift * q10);
    });
    symmetric(m)
}

/// A ruled loft from the profile to its copy scaled by `scale` about the origin, `h` up: the
/// section at height w is the profile scaled by σ = 1 + (scale − 1)·w/h, whose moments of order n
/// are the profile's times σⁿ⁺².
fn lofted(p: &Profile, scale: f64, h: f64) -> Moments {
    let q = |k, m| p.area_moment(k, m);
    let (a, mu, mv) = (q(0, 0), q(1, 0), q(0, 1));
    let (iuu, iuv, ivv) = (q(2, 0), q(1, 1), q(0, 2));
    let mut m = Moments::default();
    gauss(0.0, h, 4, |z, w| {
        let sg = 1.0 + (scale - 1.0) * z / h;
        let (s2, s3, s4) = (sg * sg, sg * sg * sg, sg * sg * sg * sg);
        m.v += w * s2 * a;
        m.f[0] += w * s3 * mu;
        m.f[1] += w * s3 * mv;
        m.f[2] += w * z * s2 * a;
        m.s[0][0] += w * s4 * iuu;
        m.s[0][1] += w * s4 * iuv;
        m.s[1][1] += w * s4 * ivv;
        m.s[0][2] += w * z * s3 * mu;
        m.s[1][2] += w * z * s3 * mv;
        m.s[2][2] += w * z * z * s2 * a;
    });
    symmetric(m)
}

fn symmetric(mut m: Moments) -> Moments {
    m.s[1][0] = m.s[0][1];
    m.s[2][0] = m.s[0][2];
    m.s[2][1] = m.s[1][2];
    m
}

/// The suite's estimate of a set's moments from points spread through a box of volume `bv`, and
/// the allowance per component: five standard errors of a random sample, and two points' share.
pub fn sampled(bv: f64, pts: &[Vec3], inside: &[bool]) -> (Moments, Moments) {
    let n = pts.len() as f64;
    let mut sum = Moments::default();
    let mut sq = Moments::default();
    // Two points' share is scaled by the farthest any sample reaches, not only those inside: a
    // sliver no sample lands in still has moments.
    let mut big = Moments::default();
    for (p, &inside) in pts.iter().zip(inside) {
        let one = Moments {
            v: 1.0,
            f: *p,
            s: [0, 1, 2].map(|a| [0, 1, 2].map(|b| p[a] * p[b])),
        };
        big.f = [0, 1, 2].map(|i| big.f[i].max(one.f[i].abs()));
        big.s = [0, 1, 2].map(|a| [0, 1, 2].map(|b| big.s[a][b].max(one.s[a][b].abs())));
        if !inside {
            continue;
        }
        sum = sum.plus(&one, 1.0);
        let squared = Moments {
            v: 1.0,
            f: one.f.map(|x| x * x),
            s: one.s.map(|r| r.map(|x| x * x)),
        };
        sq = sq.plus(&squared, 1.0);
    }
    let est = |s: f64| bv * s / n;
    let allow = |s: f64, s2: f64, top: f64| {
        let mean = s / n;
        let var = (s2 / n - mean * mean).max(0.0);
        5.0 * bv * (var / n).sqrt() + 2.0 * bv / n * top
    };
    let e = Moments {
        v: est(sum.v),
        f: sum.f.map(est),
        s: sum.s.map(|r| r.map(est)),
    };
    let a = Moments {
        v: allow(sum.v, sq.v, 1.0),
        f: [0, 1, 2].map(|i| allow(sum.f[i], sq.f[i], big.f[i])),
        s: [0, 1, 2].map(|i| [0, 1, 2].map(|j| allow(sum.s[i][j], sq.s[i][j], big.s[i][j]))),
    };
    (e, a)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_sample_that_misses_a_sliver_still_allows_for_it() {
        // No point lands in the solid: its moments may still be up to two points' share of the
        // box times how far out the box reaches, as its volume may be two points' share.
        let pts: Vec<Vec3> = (0..64)
            .map(|i| {
                [
                    5.0 + f64::from(i % 4),
                    2.0 + f64::from(i / 4 % 4),
                    f64::from(i / 16),
                ]
            })
            .collect();
        let (est, tol) = sampled(48.0, &pts, &vec![false; pts.len()]);
        assert_eq!(est.f, [0.0; 3]);
        for a in 0..3 {
            assert!(
                tol.f[a] > 0.0 && tol.s[a][a] > 0.0,
                "{:?} {:?}",
                tol.f,
                tol.s
            );
        }
    }

    #[test]
    fn a_unit_cube_at_the_origin_has_a_third_on_its_diagonal() {
        // ∭ x² over [0, 1]³ is 1/3, ∭ x y is 1/4, and the centroid is (½, ½, ½).
        let m = of(&Primitive::Box {
            frame: Frame::at([0.0; 3]),
            size: [1.0; 3],
        });
        assert!((m.v - 1.0).abs() < 1e-12 && (m.f[1] - 0.5).abs() < 1e-12);
        assert!((m.s[0][0] - 1.0 / 3.0).abs() < 1e-12 && (m.s[0][2] - 0.25).abs() < 1e-12);
    }

    #[test]
    fn a_unit_cube_stretched_and_sheared_is_the_box_it_maps_onto() {
        // x ↦ 2x + y/2 + 1, y ↦ 3y, z ↦ z: volume 6, and ∭ x' = 6·(2·½ + ½·½ + 1) = 13.5 over the
        // image, ∭ y'² = 6·9·⅓ = 18.
        let cube = of(&Primitive::Box {
            frame: Frame::at([0.0; 3]),
            size: [1.0; 3],
        });
        let m = cube.mapped(&[
            [2.0, 0.5, 0.0, 1.0],
            [0.0, 3.0, 0.0, 0.0],
            [0.0, 0.0, 1.0, 0.0],
        ]);
        assert!((m.v - 6.0).abs() < 1e-12, "{}", m.v);
        assert!((m.f[0] - 13.5).abs() < 1e-12, "{}", m.f[0]);
        assert!((m.s[1][1] - 18.0).abs() < 1e-12, "{}", m.s[1][1]);
    }

    #[test]
    fn a_ball_has_four_fifteenths_pi_r_to_the_fifth_on_each_axis() {
        // ∭ x² over a ball of radius r is 4πr⁵/15.
        let m = of(&Primitive::Sphere {
            frame: Frame::at([0.0; 3]),
            radius: 2.0,
        });
        let want = 4.0 * PI * 32.0 / 15.0;
        assert!((m.s[0][0] - want).abs() < 1e-9 * want, "{}", m.s[0][0]);
        assert!(m.s[0][1].abs() < 1e-9 && m.f[2].abs() < 1e-9);
    }

    #[test]
    fn moments_follow_a_rigid_motion_as_the_solid_does() {
        // A box moved by a motion has the moments of the box built in the moved frame.
        let b = Primitive::Box {
            frame: Frame::at([1.0, 2.0, 3.0]),
            size: [1.0, 2.0, 3.0],
        };
        let m = Rigid::uniform([0.2, 0.5, 0.8], [4.0, -1.0, 2.0]);
        let (d1, d2) = of(&b).moved(&m).gap(&of(&b.moved(&m)));
        assert!(d1 < 1e-9 && d2 < 1e-9, "{d1} {d2}");
    }

    #[test]
    fn mass_properties_round_trip_through_raw_moments() {
        // A kernel reports volume, centroid and inertia; raw moments rebuilt from them match.
        let m = of(&Primitive::Cone {
            frame: Frame::along([1.0, 0.0, 2.0], [0.0, 0.6, 0.8]),
            bottom: 2.0,
            top: 0.5,
            height: 3.0,
        });
        let c = m.f.map(|x| x / m.v);
        let mut sc = [[0.0; 3]; 3];
        for a in 0..3 {
            for b in 0..3 {
                sc[a][b] = m.s[a][b] - m.v * c[a] * c[b];
            }
        }
        let tr = sc[0][0] + sc[1][1] + sc[2][2];
        let j = [0, 1, 2].map(|a| [0, 1, 2].map(|b| if a == b { tr } else { 0.0 } - sc[a][b]));
        let (d1, d2) = Moments::from_mass(m.v, Some(c), j).gap(&m);
        assert!(d1 < 1e-9 && d2 < 1e-9, "{d1} {d2}");
    }
}
