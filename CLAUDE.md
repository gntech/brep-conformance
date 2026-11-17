# CLAUDE.md — brep-conformance

Read [`README.md`](README.md) and [`CONTRIBUTING.md`](.github/CONTRIBUTING.md) first. This file is
the rules an agent is most likely to break.

## Name no proprietary CAD product

Never write the name of a proprietary CAD kernel or CAD program, its vendor, or its API: not in
code, tests, comments, commit messages or documents. Describe the behaviour instead. Do not add a
list of such names, plain or hashed, to check against; the rule is enforced by review.

The rule is about CAD software only. Open-source kernels the suite scores are named where the suite
says what it ran, and the tools the project is built and hosted with are named as usual.

## No expected value from a kernel

An expected value is a closed form or the suite's own sample. Never run a kernel, ours included, to
find what a test should expect, and never copy a kernel's output into a test.

## Nothing from proprietary sources

Do not derive code, tests or documents from proprietary source code, from decompiled code, or from a
CAD vendor's documentation under a non-disclosure agreement or a restrictive licence. Do not quote
the text of a standard. Cite the paper or book an algorithm comes from where the code uses it.

## Adapters are pass-through

An adapter answers each function with one call of its kernel. Anything the kernel has no one call
for is listed as unsupported. Never build a function in an adapter out of several kernel calls, and
never work around a kernel bug there: that scores the adapter and not the kernel.

## Dependencies and files

Permissive licences only, from crates.io: [`deny.toml`](deny.toml) is the list. No GPL or LGPL
dependency, no compiled binary, no vendor SDK file, and no CAD file outside a fixture folder.
