#!/usr/bin/env python3
"""Downloads NIST's PMI STEP files and unpacks them beside this script, for `--nist`.

The archive is NIST's, unmodified, and is checked against its SHA-256 before anything is unpacked.
See NOTICE for its source and terms.
"""

import hashlib
import io
import json
import sys
import urllib.request
import zipfile
from pathlib import Path

SHA256 = "8fa78429e6d8d9b0d7681d223b6aa9ec98c3772185c55b1a0e3679b21c181911"
SOURCES = [
    f"https://cdn.springcraft.ai/brep-conformance/nist/NIST-PMI-STEP-Files-{SHA256[:12]}.zip",
    "https://www.nist.gov/system/files/documents/noindex/2024/06/19/NIST-PMI-STEP-Files.zip",
]
# The archive's folders, and the names `validation.json` lists their files under.
FOLDERS = {
    "AP203 geometry only": "ap203",
    "AP203 with PMI": "ap203-pmi",
    "": "ap242",
}
HERE = Path(__file__).resolve().parent


def download():
    """The archive's bytes from the first source that serves the expected file."""
    for url in SOURCES:
        request = urllib.request.Request(url, headers={"User-Agent": "brep-conformance"})
        try:
            with urllib.request.urlopen(request, timeout=120) as reply:
                data = reply.read()
        except OSError as e:
            print(f"{url}: {e}", file=sys.stderr)
            continue
        found = hashlib.sha256(data).hexdigest()
        if found == SHA256:
            return data
        print(f"{url}: SHA-256 {found}, not {SHA256}", file=sys.stderr)
    sys.exit("no source served NIST's archive")


def main():
    listed = set(json.loads((HERE / "validation.json").read_text()))
    if all((HERE / name).is_file() for name in listed):
        print(f"{len(listed)} files already in {HERE}")
        return
    written = set()
    with zipfile.ZipFile(io.BytesIO(download())) as archive:
        for entry in archive.infolist():
            parts = Path(entry.filename).parts
            if entry.is_dir() or not entry.filename.endswith(".stp"):
                continue
            folder = FOLDERS.get("/".join(parts[1:-1]))
            if folder is None:
                continue
            name = f"{folder}/{parts[-1]}"
            (HERE / folder).mkdir(exist_ok=True)
            (HERE / name).write_bytes(archive.read(entry))
            written.add(name)
    if written != listed:
        sys.exit(f"the archive's files differ from validation.json: {sorted(written ^ listed)}")
    print(f"{len(written)} files unpacked into {HERE}")


if __name__ == "__main__":
    main()
