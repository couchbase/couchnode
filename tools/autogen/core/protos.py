#  Copyright 2016-2026. Couchbase, Inc.
#  All Rights Reserved.
#
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""The couchbase2 protocol's schema and the type declarations generated from it.

Two trees are written, both checked in:

``lib/couchbase2/protos/``
    The pinned ``.proto`` files, byte for byte.  They ship with the package and are parsed at
    run time by ``@grpc/proto-loader`` on the first couchbase2 connect, so no user needs
    ``protoc`` and nothing here generates run time code.

``lib/couchbase2/generated/``
    What ``proto-loader-gen-types`` declares for those files, plus ``loaderoptions.ts``, which
    carries the file list and the loader options from ``protos.yaml`` so that the run time load
    uses exactly the options the declarations were generated with.

Each source is downloaded once into the cache, keyed by its commit, and checked against the
pinned digest on every use.  ``proto-loader-gen-types`` is the one in ``node_modules``, so the
declarations always match the installed ``@grpc/proto-loader``.

Mirrors the Python SDK's ``core/protos.py``.  The digest is computed the same way, so the
Protostellar digest here and the one in the Python SDK's config are the same value.
"""

from __future__ import annotations

import hashlib
import io
import json
import os
import shutil
import subprocess
import tarfile
import tempfile
import urllib.request
from dataclasses import dataclass
from pathlib import (Path,
                     PurePosixPath)
from typing import (Dict,
                    List,
                    Optional,
                    Tuple,
                    Union)

import yaml

CONFIG = Path('tools/autogen/config/protos.yaml')
PROTOS = Path('lib/couchbase2/protos')
GENERATED = Path('lib/couchbase2/generated')
LOADER_OPTIONS_FILE = PurePosixPath('loaderoptions.ts')

GEN_TYPES_PACKAGE = Path('node_modules/@grpc/proto-loader')
GEN_TYPES_BIN = 'proto-loader-gen-types'

# Options for proto-loader-gen-types only; they shape the declarations, not the loaded objects.
GEN_TYPES_FLAGS = ('--grpcLib=@grpc/grpc-js', '--includeComments')

# The loader option values that name a JavaScript constructor rather than a literal.
_CONSTRUCTORS = ('String', 'Number', 'Array')

Tree = Dict[PurePosixPath, bytes]


class ProtosError(Exception):
    """The config, a download, or the generator is not what was expected."""


@dataclass(frozen=True)
class Source:
    name: str
    repository: str
    commit: str
    digest: str
    tree: Optional[str]
    files: Tuple[str, ...]

    def paths(self, root: Path) -> List[PurePosixPath]:
        """The source's ``.proto`` files under ``root``, relative to it and sorted."""
        if self.tree is not None:
            return sorted(PurePosixPath(p.relative_to(root).as_posix())
                          for p in (root / self.tree).rglob('*.proto'))
        return sorted(PurePosixPath(f) for f in self.files)


@dataclass(frozen=True)
class Pin:
    sources: Tuple[Source, ...]
    loader: Dict[str, Union[bool, str]]


def load(root: Path) -> Pin:
    data = yaml.safe_load((root / CONFIG).read_text())
    sources = []
    for name, raw in data['sources'].items():
        tree, files = raw.get('tree'), tuple(raw.get('files') or ())
        if (tree is None) == (not files):
            raise ProtosError(f'{CONFIG}: source {name} needs exactly one of `tree` and `files`')
        sources.append(Source(name, raw['repository'], raw['commit'], raw['digest'], tree, files))
    loader = dict(data['loader'])
    for key, value in loader.items():
        if not isinstance(value, bool) and value not in _CONSTRUCTORS:
            raise ProtosError(f'{CONFIG}: loader option {key} is {value!r}; '
                              f'expected a boolean or one of {", ".join(_CONSTRUCTORS)}')
    return Pin(tuple(sources), loader)


def cache_dir() -> Path:
    return Path(os.environ.get('XDG_CACHE_HOME') or Path.home() / '.cache') / 'couchnode-autogen' / 'protos'


def digest(root: Path, paths: List[PurePosixPath]) -> str:
    """A hash of the paths and contents, so a tarball GitHub recompresses still matches."""
    h = hashlib.sha256()
    for path in sorted(paths):
        h.update(str(path).encode() + b'\0' + (root / path).read_bytes() + b'\0')
    return h.hexdigest()


def _verified(root: Path, source: Source) -> Path:
    paths = source.paths(root)
    missing = [p for p in paths if not (root / p).is_file()]
    if missing:
        raise ProtosError(f'{root}: {source.name} lacks {", ".join(map(str, missing))}')
    found = digest(root, paths)
    if found != source.digest:
        raise ProtosError(f'{root}: {source.name} digest {found} is not the pinned {source.digest}; '
                          f'is it {source.repository} at {source.commit}?')
    return root


def _download(url: str) -> bytes:
    with urllib.request.urlopen(url) as response:  # nosec B310: the URL is a pinned https repository
        return response.read()


def _github_raw(source: Source, path: str) -> str:
    prefix = 'https://github.com/'
    if not source.repository.startswith(prefix):
        raise ProtosError(f'{source.name}: only GitHub repositories can be fetched file by file')
    return f'https://raw.githubusercontent.com/{source.repository[len(prefix):]}/{source.commit}/{path}'


def _extract_tree(payload: bytes, source: Source, staging: Path) -> None:
    with tarfile.open(fileobj=io.BytesIO(payload), mode='r:gz') as archive:
        for member in archive.getmembers():
            # GitHub archives hold everything under one `<repo>-<commit>/` directory.
            path = PurePosixPath(member.name)
            if not member.isfile() or path.suffix != '.proto' or path.parts[1:2] != (source.tree,):
                continue
            dest = staging.joinpath(*path.parts[1:])
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(archive.extractfile(member).read())


def fetch(source: Source) -> Path:
    """The pinned source, downloaded into the cache the first time it is asked for."""
    target = cache_dir() / f'{source.name}-{source.commit}'
    if target.is_dir():
        return _verified(target, source)
    target.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(dir=target.parent))
    try:
        if source.tree is not None:
            _extract_tree(_download(f'{source.repository}/archive/{source.commit}.tar.gz'), source, staging)
        else:
            for path in source.files:
                dest = staging / path
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(_download(_github_raw(source, path)))
        _verified(staging, source)
        staging.rename(target)
    finally:
        shutil.rmtree(staging, ignore_errors=True)
    return target


def render_protos(pin: Pin) -> Tree:
    """Every pinned ``.proto`` file, by its import path."""
    files: Tree = {}
    for source in pin.sources:
        base = fetch(source)
        for path in source.paths(base):
            if path in files:
                raise ProtosError(f'{path}: supplied by more than one source')
            files[path] = (base / path).read_bytes()
    return files


def _gen_types_script(root: Path) -> Path:
    package = root / GEN_TYPES_PACKAGE
    manifest = package / 'package.json'
    if not manifest.is_file():
        raise ProtosError(f'{GEN_TYPES_PACKAGE} is not installed; run `npm install` first')
    script = json.loads(manifest.read_text()).get('bin', {}).get(GEN_TYPES_BIN)
    if not script:
        raise ProtosError(f'{manifest} declares no {GEN_TYPES_BIN} bin')
    return package / script


def _flag(key: str, value: Union[bool, str]) -> List[str]:
    if isinstance(value, bool):
        return [f'--{key}'] if value else []
    return [f'--{key}={value}']


def _read_tree(base: Path) -> Tree:
    if not base.is_dir():
        return {}
    return {PurePosixPath(p.relative_to(base).as_posix()): p.read_bytes()
            for p in base.rglob('*') if p.is_file()}


def run_gen_types(root: Path, pin: Pin, protos: Tree) -> Tree:
    """proto-loader-gen-types' output for every pinned file, by the path it was written to."""
    # Absolute, because the generator runs from inside the temporary protos directory.
    script = _gen_types_script(root).resolve()
    flags = [f for key, value in pin.loader.items() for f in _flag(key, value)]
    with tempfile.TemporaryDirectory() as work:
        source, out = Path(work) / 'protos', Path(work) / 'generated'
        for path, data in protos.items():
            dest = source / path
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
        # Each declaration's `Original file` header is the include directory joined to the proto's
        # path, so a relative include keeps the temporary directory out of the output.
        subprocess.run(['node', str(script), *flags, *GEN_TYPES_FLAGS, '--includeDirs=.',
                        f'--outDir={out}', *map(str, sorted(protos))],
                       cwd=source, check=True)
        files = _read_tree(out)
    if not files:
        raise ProtosError(f'{GEN_TYPES_BIN} wrote nothing')
    if LOADER_OPTIONS_FILE in files:
        raise ProtosError(f'{GEN_TYPES_BIN} wrote {LOADER_OPTIONS_FILE}, which is reserved for the loader options')
    return files


def _ts_value(value: Union[bool, str]) -> str:
    return ('true' if value else 'false') if isinstance(value, bool) else value


def loader_options(pin: Pin, protos: Tree) -> bytes:
    """``loaderoptions.ts``: the files to load and the options to load them with."""
    lines = [
        f'// Written by `npm run gen:protos` from {CONFIG.as_posix()}; edit that, not this file.',
        '',
        "import type { Options } from '@grpc/proto-loader'",
        '',
        '/**',
        ' * The schema files to load, relative to the protos directory.',
        ' */',
        'export const PROTO_FILES: readonly string[] = [',
        *(f"  '{path}'," for path in sorted(protos)),
        ']',
        '',
        '/**',
        ' * The options the declarations beside this file were generated with.',
        ' */',
        'export const LOADER_OPTIONS: Options = {',
        *(f'  {key}: {_ts_value(value)},' for key, value in pin.loader.items()),
        '}',
        '',
    ]
    return '\n'.join(lines).encode('utf-8')


def render(root: Path) -> Dict[Path, Tree]:
    """Both trees as they should be, by output directory."""
    pin = load(root)
    protos = render_protos(pin)
    generated = run_gen_types(root, pin, protos)
    generated[LOADER_OPTIONS_FILE] = loader_options(pin, protos)
    return {PROTOS: protos, GENERATED: generated}


def drift(root: Path, trees: Dict[Path, Tree]) -> List[str]:
    """What writing ``trees`` would change, one line per file."""
    changes: List[str] = []
    for output, files in trees.items():
        current = _read_tree(root / output)
        changes += ([f'  new        {output / p}' for p in sorted(files.keys() - current.keys())]
                    + [f'  changed    {output / p}' for p in sorted(files.keys() & current.keys())
                       if files[p] != current[p]]
                    + [f'  removed    {output / p}' for p in sorted(current.keys() - files.keys())])
    return changes


def write(root: Path, trees: Dict[Path, Tree]) -> List[str]:
    changes = drift(root, trees)
    for output, files in trees.items():
        shutil.rmtree(root / output, ignore_errors=True)
        for path, data in files.items():
            dest = root / output / path
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
    return changes
