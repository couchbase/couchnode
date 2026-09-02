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

"""Post-processing for generated binding files.

The generator renders unformatted output, so the committed files are whatever clang-format
and prettier turn that output into.  Formatting therefore has to run before we can answer
"did this file actually change?".

Mirrors the Python SDK's `core/post_process.py`.  The one structural difference is how the
files get formatted: pycbc delegates to `pre-commit`, which couchnode does not use, so the
formatters are invoked directly and configured per file suffix under `format.formatters`.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
from pathlib import Path
from typing import (Callable,
                    Dict,
                    Iterable,
                    List,
                    NamedTuple,
                    Optional,
                    Sequence,
                    Tuple)

# Generated-On changes every run and Content-Hash is derived from the body, so neither line
# says anything about whether the generated output actually changed.  Node's regions carry no
# such banner yet; stripping is wired in ahead of it so adding one cannot reintroduce churn.
RUN_METADATA_RE = re.compile(r'^[ \t]*(?://|#)[ \t]*(?:Generated-On|Content-Hash):.*$\n?',
                             re.MULTILINE)


class FormatterError(Exception):
    """A configured formatter is missing, or exited non-zero."""


def strip_run_metadata(content: str) -> str:
    return RUN_METADATA_RE.sub('', content)


class FormatterGroup(NamedTuple):
    """One formatter invocation covering every file it is configured for."""

    command: Tuple[str, ...]
    paths: Tuple[Path, ...]

    @property
    def tool(self) -> str:
        return self.command[0]


class FormatResult(NamedTuple):
    path: Path
    changed: bool


def group_by_formatter(formatters: Dict[str, Sequence[str]],
                       files: Iterable[Path]) -> List[FormatterGroup]:
    """Map files onto their formatter by suffix, one group per distinct command.

    Grouping matters for more than tidiness: `npx prettier` pays a Node start-up cost per
    invocation, so a single call over every TypeScript file is markedly faster than one
    call per file.
    """
    by_command: Dict[Tuple[str, ...], List[Path]] = {}
    unmatched: List[Path] = []
    for path in files:
        command = formatters.get(path.suffix)
        if not command:
            unmatched.append(path)
            continue
        by_command.setdefault(tuple(command), []).append(path)

    if unmatched:
        suffixes = sorted({p.suffix for p in unmatched})
        raise FormatterError(
            f'no formatter configured for {", ".join(suffixes)} '
            f'(add one under `format.formatters` in the bindings config): '
            f'{", ".join(str(p) for p in unmatched)}')

    # De-duplicate paths per group; a file could hold more than one generated region.
    return [FormatterGroup(command=command, paths=tuple(dict.fromkeys(paths)))
            for command, paths in by_command.items()]


def run_formatters(groups: Sequence[FormatterGroup],
                   repo_root: Path,
                   log: Optional[Callable[[str], None]] = None) -> List[FormatResult]:
    """Format every file in every group, reporting which ones the formatter rewrote.

    A file the formatter leaves byte-identical keeps its original mtime, so a no-op
    regeneration does not invalidate the node-gyp build.
    """
    results: List[FormatResult] = []
    for group in groups:
        if shutil.which(group.tool) is None:
            raise FormatterError(
                f'formatter not found on PATH: {group.tool}\n'
                f'It is needed to format {", ".join(p.name for p in group.paths)}.\n'
                'On MacOS clang-format comes from LLVM: '
                'export PATH="/opt/homebrew/opt/llvm/bin:$PATH"')

        # Relative paths keep the formatters' own output readable, and let them pick up
        # the .clang-format / .prettierrc at the repository root.
        relative = [str(p.relative_to(repo_root)) for p in group.paths]
        before = {p: (p.read_bytes(), p.stat()) for p in group.paths}

        command = list(group.command) + relative
        if log:
            log(f'  $ {" ".join(command)}')
        completed = subprocess.run(command, cwd=str(repo_root),
                                   capture_output=True, text=True)
        if completed.returncode != 0:
            detail = (completed.stderr or completed.stdout or '').strip()
            raise FormatterError(
                f'{" ".join(command)} exited {completed.returncode}'
                + (f'\n{detail}' if detail else ''))

        for path, (original, stat) in before.items():
            if path.read_bytes() == original:
                os.utime(path, ns=(stat.st_atime_ns, stat.st_mtime_ns))
                results.append(FormatResult(path=path, changed=False))
            else:
                results.append(FormatResult(path=path, changed=True))

    return results


def format_files(formatters: Dict[str, Sequence[str]],
                 files: Iterable[Path],
                 repo_root: Path,
                 log: Optional[Callable[[str], None]] = None) -> List[FormatResult]:
    """Group files by formatter and run each one.  The analogue of pycbc's run_pre_commit."""
    return run_formatters(group_by_formatter(formatters, files), repo_root, log)


def _git_head_content(path: Path, repo_root: Path) -> Optional[str]:
    rel_path = path.relative_to(repo_root)
    completed = subprocess.run(['git', 'show', f'HEAD:{rel_path}'],
                               cwd=str(repo_root),
                               capture_output=True,
                               text=True)
    if completed.returncode != 0:
        return None

    return completed.stdout


class RestoreReport(NamedTuple):
    """How each generated file ended up, relative to HEAD."""

    changed: List[Path]
    restored: List[Path]
    untouched: List[Path]


def restore_unchanged(paths: Sequence[Path], repo_root: Path) -> RestoreReport:
    """Restore generated files whose only delta against HEAD is the run metadata.

    This is safe by construction: a file is only restored when its content is byte-identical
    to HEAD once the metadata lines are removed, so genuine changes - including hand-edits -
    can never be discarded.

    Comparing against HEAD rather than against a snapshot taken before generation is what
    lets `tidy` run standalone, with no generation pass to take a snapshot during.

    Diverges from pycbc in reporting `untouched` as its own bucket rather than folding it
    into `restored`.  A file already byte-identical to HEAD needs no restoring, and checking
    it out anyway would rewrite it and bump its mtime, invalidating the node-gyp build on
    every no-op run.  pycbc never hits the case: its generated files always carry a
    Generated-On banner, so they always differ.
    """
    changed: List[Path] = []
    restored: List[Path] = []
    untouched: List[Path] = []

    for path in paths:
        head_content = _git_head_content(path, repo_root)
        if head_content is None:
            # Untracked or not in HEAD, so there is no baseline to compare against.
            changed.append(path)
            continue

        current = path.read_text()
        if current == head_content:
            untouched.append(path)
        elif strip_run_metadata(current) == strip_run_metadata(head_content):
            restored.append(path)
        else:
            changed.append(path)

    if restored:
        rel_paths = [str(p.relative_to(repo_root)) for p in restored]
        subprocess.run(['git', 'checkout', 'HEAD', '--', *rel_paths],
                       cwd=str(repo_root),
                       capture_output=True,
                       text=True,
                       check=True)

    return RestoreReport(changed=changed, restored=restored, untouched=untouched)


class Snapshot(NamedTuple):
    """One file as it was before generation touched it."""

    path: Path
    content: bytes
    atime_ns: int
    mtime_ns: int

    def matches_disk(self) -> bool:
        return self.path.read_bytes() == self.content

    def restore_times(self) -> None:
        os.utime(self.path, ns=(self.atime_ns, self.mtime_ns))

    def restore(self) -> None:
        self.path.write_bytes(self.content)
        self.restore_times()


def snapshot(files: Iterable[Path]) -> List[Snapshot]:
    """Capture the content and timestamps of every file about to be generated into.

    Node-specific, and used for one thing: `--dry-run` generates and formats for real and
    then puts every file back, which is the only way it can report the same answer a real
    run would.  Predicting instead would mean formatting a rendered region in isolation,
    away from the .clang-format its path resolves.
    """
    taken = []
    for path in files:
        stat = path.stat()
        taken.append(Snapshot(path=path,
                              content=path.read_bytes(),
                              atime_ns=stat.st_atime_ns,
                              mtime_ns=stat.st_mtime_ns))
    return taken


def preserve_times(snapshots: Iterable[Snapshot]) -> List[Path]:
    """Give back the mtime of every file that ended the run byte-identical to its snapshot.

    Generation rewrites a region before the formatters run, so a file can be modified
    mid-run and still come back to exactly where it started.  Handing back the mtime keeps
    a no-op regeneration from invalidating the node-gyp build.  Returns the files that
    genuinely moved.
    """
    moved = []
    for snap in snapshots:
        if snap.matches_disk():
            snap.restore_times()
        else:
            moved.append(snap.path)
    return moved


def revert(snapshots: Iterable[Snapshot]) -> List[Path]:
    """Put every file back as it was, returning the ones that had moved."""
    moved = []
    for snap in snapshots:
        if snap.matches_disk():
            snap.restore_times()
            continue
        moved.append(snap.path)
        snap.restore()
    return moved
