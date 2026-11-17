//! Where a case's shape files go: `<test>/<case>.<hash>.glb` for its views, and `.step` beside it
//! for its expected shape where the case has one.
//! The published set lies under a base URL compiled in from `BREP_CONFORMANCE_ASSET_BASE`, written
//! by a kernel that passed every case at the suite's tolerance; a published file never changes, so
//! it is cached immutably.

use serde_json::Value;

use crate::generate::{Case, fnv};
use crate::run::ASSET_GENERATOR;

pub const ASSET_BASE: &str = match option_env!("BREP_CONFORMANCE_ASSET_BASE") {
    Some(base) => base,
    None => "https://cdn.springcraft.ai/brep-conformance",
};

/// A case's published files: their hash and the URL of each; `step` is `None` for a case with no
/// one expected shape.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Assets {
    pub hash: String,
    pub glb: String,
    pub step: Option<String>,
}

/// The case id carries its definition; [`ASSET_GENERATOR`] changes when what draws the files does.
pub fn hash(c: &Case) -> String {
    hash_versioned(&c.id, ASSET_GENERATOR)
}

fn hash_versioned(id: &str, generator: &str) -> String {
    format!("{:016x}", fnv(&format!("{id}|{generator}")))
}

/// A file's path under the base URL, `format` being `glb` or `step`.
pub fn key(test: &str, id: &str, hash: &str, format: &str) -> String {
    format!("{test}/{id}.{hash}.{format}")
}

pub fn url(key: &str) -> String {
    format!("{}/{key}", ASSET_BASE.trim_end_matches('/'))
}

/// A case's file URLs; `step` only when the case has one expected shape.
pub fn assets(test: &str, id: &str, hash: &str, step: bool) -> Assets {
    Assets {
        hash: hash.to_string(),
        glb: url(&key(test, id, hash, "glb")),
        step: step.then(|| url(&key(test, id, hash, "step"))),
    }
}

pub fn of_case(c: &Case) -> Assets {
    assets(
        c.test,
        &c.id,
        &hash(c),
        has_step(c, &crate::views::views(c)),
    )
}

/// The files of a case in a results file, from its `test`, `id`, `asset` hash and `asset_step`.
pub fn of_result(c: &Value) -> Option<Assets> {
    Some(assets(
        c["test"].as_str()?,
        c["id"].as_str()?,
        c["asset"].as_str()?,
        c["asset_step"].as_bool() == Some(true),
    ))
}

/// Whether the case has one expected shape, which its `.step` file holds: the one subject of its
/// first view, ghosts aside. A case that must be refused, or whose result is left open, has none;
/// nor has a view of two subjects, such as a mirror join's part and its image.
pub fn has_step(c: &Case, views: &Value) -> bool {
    !c.refuse && c.exact.sound.is_none() && subject(views).is_some()
}

/// The index in the first view's solids of its one subject, ghosts aside.
pub fn subject(views: &Value) -> Option<usize> {
    let solids = views["views"][0]["solids"].as_array()?;
    let mut subjects = solids
        .iter()
        .enumerate()
        .filter(|(_, s)| !matches!(s["role"].as_str(), Some("ghost" | "ghost2")));
    let (i, _) = subjects.next()?;
    subjects.next().is_none().then_some(i)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::generate::cases;

    #[test]
    fn every_case_hashes_the_same_each_time_it_is_drawn() {
        let (a, b) = (cases(1), cases(1));
        for (x, y) in a.iter().zip(&b) {
            assert_eq!(hash(x), hash(y), "{}", x.id);
        }
    }

    #[test]
    fn a_changed_case_or_generator_changes_the_hash() {
        let c = cases(1).into_iter().next().unwrap();
        assert_ne!(hash_versioned(&c.id, "next"), hash(&c));
        assert_ne!(
            hash_versioned(&format!("{}0", c.id), ASSET_GENERATOR),
            hash(&c)
        );
    }

    #[test]
    fn a_result_names_its_files_under_the_base() {
        let mut r = serde_json::json!({"test": "booleans/overlap/boxes", "id": "box-box-00ff",
                                       "asset": "0123456789abcdef"});
        let a = of_result(&r).unwrap();
        assert_eq!(
            a.glb,
            format!("{ASSET_BASE}/booleans/overlap/boxes/box-box-00ff.0123456789abcdef.glb")
        );
        assert_eq!(a.step, None);
        r["asset_step"] = serde_json::json!(true);
        let step = of_result(&r).unwrap().step.unwrap();
        assert!(step.ends_with("/box-box-00ff.0123456789abcdef.step"));
        assert_eq!(of_result(&serde_json::json!({"id": "x"})), None);
    }

    #[test]
    fn one_expected_shape_comes_only_with_one_subject() {
        let all = cases(1);
        let step = |c: &Case| has_step(c, &crate::views::views(c));
        // A boolean's first view is its intersection; a mirror join's is the part and its image.
        assert!(
            all.iter()
                .filter(|c| c.test.starts_with("booleans/overlap/boxes"))
                .all(step)
        );
        let mirrored: Vec<_> = all.iter().filter(|c| c.exact.mirror.is_some()).collect();
        assert!(!mirrored.is_empty());
        assert!(mirrored.iter().all(|c| !step(c)));
        assert!(all.iter().filter(|c| c.refuse).all(|c| !step(c)));
        assert!(
            all.iter()
                .filter(|c| c.exact.sound.is_some())
                .all(|c| !step(c))
        );
    }
}
