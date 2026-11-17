#!/usr/bin/env bash
# Runs the suite on springrep with its shape files exported, and uploads the files the bucket lacks,
# immutable. It publishes nothing unless springrep passed every case at the suite's tolerance and
# drew every file, so each published shape is one the suite verified. With no
# BREP_CONFORMANCE_BUCKET it only writes them, into --out DIR or a temporary directory.
# Usage: publish-assets.sh --adapter <springrep's adapter binary> [--out DIR]
set -euo pipefail

root=$(cd "$(dirname "$0")" && pwd)
adapter=""
out=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --adapter)
            adapter=$2
            shift 2
            ;;
        --out)
            out=$2
            shift 2
            ;;
        *)
            echo "usage: $0 --adapter PATH [--out DIR]" >&2
            exit 2
            ;;
    esac
done
if [[ -z "$adapter" ]]; then
    echo "usage: $0 --adapter PATH [--out DIR]" >&2
    exit 2
fi
out=${out:-$(mktemp -d)}
mkdir -p "$out"
files="$out/files"

cargo build --release --manifest-path "$root/Cargo.toml" -p brep-conformance
"$root/target/release/brep-conformance" --adapter "$adapter" \
    --out "$out/results.json" --glb "$files" --step "$files" >"$out/summary.txt"

python3 -I - "$out/results.json" <<'EOF'
import json, sys

cases = json.load(open(sys.argv[1]))["cases"]
short = [c["id"] for c in cases if c.get("result") != "1e-7"]
broken = [(c["id"], e) for c in cases for e in c.get("exports", {}).get("errors", [])]
# The site links a case's expected STEP file wherever `asset_step` says it has one.
unwritten = [
    c["id"]
    for c in cases
    if c.get("asset_step")
    and f'{c["test"]}/{c["id"]}.{c["asset"]}.step' not in c.get("exports", {}).get("step", [])
]
for name, bad in [("not passed at 1e-7", short), ("export errors", broken),
                  ("expected STEP file not written", unwritten)]:
    if bad:
        print(f"{len(bad)} cases {name}, publishing nothing; first: {bad[0]}", file=sys.stderr)
        sys.exit(1)
print(f"{len(cases)} cases verified", file=sys.stderr)
EOF

# The bucket and its key prefix come from the upload role's stack; these defaults are placeholders
# until it exists.
bucket=${BREP_CONFORMANCE_BUCKET:-}
prefix=${BREP_CONFORMANCE_PREFIX:-brep-conformance}
if [[ -z "$bucket" ]]; then
    echo "no BREP_CONFORMANCE_BUCKET: wrote $files, uploaded nothing" >&2
    exit 0
fi

# A published file is never rewritten: drop every local file the bucket already holds.
aws s3api list-objects-v2 --bucket "$bucket" --prefix "$prefix/" \
    --query 'Contents[].Key' --output text |
    tr '\t' '\n' | sed -e '/^None$/d' -e "s|^$prefix/||" |
    while IFS= read -r key; do
        rm -f "$files/$key"
    done

immutable="public, max-age=31536000, immutable"
for kind in "glb model/gltf-binary" "step model/step"; do
    read -r ext type <<<"$kind"
    aws s3 cp "$files" "s3://$bucket/$prefix/" --recursive --exclude '*' --include "*.$ext" \
        --content-type "$type" --cache-control "$immutable" --no-progress
done
