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

"""Locating LLVM/clang and assembling the include paths libclang parses with."""

from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path
from typing import (Dict,
                    List,
                    Optional,
                    Tuple)

# Homebrew's LLVM install root.  Only consulted on macOS, and only to find the
# bundled clang resource headers; every other path comes from llvm-config.
HOMEBREW_LLVM_CELLAR = '/opt/homebrew/Cellar/llvm'
HOMEBREW_LLVM_OPT = '/opt/homebrew/opt/llvm'


def sh(command: str) -> Tuple[str, int]:
    """Run ``command`` in a shell, returning (output, error_flag)."""
    try:
        proc = subprocess.Popen(command,
                                stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE,
                                shell=True)
        stdout, stderr = proc.communicate()
        stderr = stderr.decode('utf-8')
        if stderr != '':
            return stderr, 1
        return stdout.decode('utf-8'), 0
    except FileNotFoundError:
        return 'Error: Command not found.', 1


def _llvm_config(field: str) -> str:
    output, err = sh(f'llvm-config --{field}')
    if err:
        raise RuntimeError(f'Unable to determine LLVM {field}. Error: {output}')
    return output.strip()


def find_llvm() -> None:
    """Ensure Homebrew's LLVM clang precedes Apple clang on PATH (macOS only)."""
    if sys.platform == 'darwin':
        output, err = sh('which clang')
        if err:
            raise RuntimeError(f'Unable to determine clang binary. Error: {output}')
        if 'llvm' not in output.strip():
            os_path = os.environ.get('PATH', '').split(':')
            os.environ['PATH'] = ':'.join([f'{HOMEBREW_LLVM_OPT}/bin'] + os_path)
        output, err = sh('which clang')
        if err:
            raise RuntimeError(f'Unable to determine clang binary. Error: {output}')
        if 'llvm' not in output.strip():
            raise RuntimeError('Unable to set LLVM as default.')
    elif sys.platform == 'linux':
        # llvm-config is expected to already be on PATH.
        pass
    else:
        raise ValueError(f'Unsupported platform: {sys.platform}')


def get_system_headers() -> str:
    if sys.platform == 'darwin':
        output, err = sh('xcrun --show-sdk-path')
        if err:
            raise RuntimeError(f'Unable to determine system header path. Error: {output}')
        return output.strip()
    elif sys.platform == 'linux':
        return ''
    raise ValueError(f'Unsupported platform: {sys.platform}')


def _find_llvm_root_dir(version: str) -> str:
    """Resolve the Homebrew Cellar directory holding clang's resource headers."""
    llvm_root_dir = os.path.join(HOMEBREW_LLVM_CELLAR, version)
    if os.path.exists(llvm_root_dir):
        return llvm_root_dir

    if not os.path.isdir(HOMEBREW_LLVM_CELLAR):
        raise RuntimeError(f'LLVM root directory ({llvm_root_dir}) does not exist and '
                           f'{HOMEBREW_LLVM_CELLAR} is not a directory. '
                           'Use --llvm-version to override.')

    for d in sorted(os.listdir(HOMEBREW_LLVM_CELLAR)):
        if d.startswith(version):
            return os.path.join(HOMEBREW_LLVM_CELLAR, d)

    raise RuntimeError(f'Unable to find LLVM root directory for version {version}. '
                       'Use --llvm-version to override.')


def find_cpm_dep_include_paths(cache_dir: Path, dep: str, includes: List[str]) -> List[str]:
    """Expand one dependency's include templates against its CPM hash directory."""
    cpm_path = cache_dir / dep
    if not cpm_path.is_dir():
        raise RuntimeError(f'CPM cache directory not found: {cpm_path}. '
                           'Populate the cache before generating bindings (see BUILDING.md).')

    # CPM names the checkout after a content hash; older caches used a short form.
    dir_patterns = [r'[0-9a-z]{40}', r'[0-9a-z]{4}']
    cpm_hash_dir = None
    for dir_pattern in dir_patterns:
        cpm_hash_dir = next((d for d in os.listdir(cpm_path)
                             if os.path.isdir(cpm_path / d) and re.match(dir_pattern, d)),
                            None)
        if cpm_hash_dir:
            break

    if not cpm_hash_dir:
        raise RuntimeError(f'Unable to find CPM hash directory for path: {cpm_path}.')

    return [inc.format(cache=cache_dir, hash=cpm_hash_dir) for inc in includes]


class LlvmEnvironment:
    """Resolved LLVM paths plus the clang arguments derived from them."""

    def __init__(self,
                 repo_root: Path,
                 cxx_client_root: Path,
                 cxx_client_cache: Path,
                 deps_include_paths: Dict[str, List[str]],
                 version: Optional[str] = None,
                 includedir: Optional[str] = None,
                 libdir: Optional[str] = None,
                 system_headers: Optional[str] = None,
                 verbose: bool = False) -> None:
        self._repo_root = repo_root
        self._cxx_client_root = cxx_client_root
        self._verbose = verbose

        version = version or os.environ.get('CN_LLVM_VERSION')
        if version is None:
            find_llvm()
            version = _llvm_config('version')
        if not version:
            raise ValueError('Missing LLVM version.')
        self.version = version

        includedir = includedir or os.environ.get('CN_LLVM_INCLUDE') or _llvm_config('includedir')
        if not includedir:
            raise ValueError('Missing LLVM include directory.')
        self.includedir = includedir

        libdir = libdir or os.environ.get('CN_LLVM_LIB') or _llvm_config('libdir')
        if not libdir:
            raise ValueError('Missing LLVM lib directory.')
        self.libdir = libdir

        if system_headers is None:
            system_headers = os.environ.get('CN_SYS_HEADERS')
        if system_headers is None:
            system_headers = get_system_headers()
        if system_headers is None:
            raise ValueError('Missing system headers path.')
        self.system_headers = system_headers

        self.llvm_root_dir = _find_llvm_root_dir(version)

        self.include_paths = [
            f'-I{HOMEBREW_LLVM_OPT}/include/c++/v1',
            f'-I{cxx_client_root}/',
            f'-I{self.llvm_root_dir}/lib/clang/{version[:2]}/include',
            f'-I{system_headers}/usr/include',
        ]
        for dep, includes in deps_include_paths.items():
            self.include_paths.extend(find_cpm_dep_include_paths(cxx_client_cache, dep, includes))

    def configure_clang(self) -> None:
        """Point the clang python bindings at the resolved libclang."""
        import clang.cindex
        clang.cindex.Config.set_library_path(self.libdir)

    def clang_args(self) -> List[str]:
        """Arguments passed to ``clang.cindex.Index.parse``.

        ``-isysroot`` is pinned to the repository root rather than a real SDK path.  That
        mirrors the original generator, which passed ``os.getcwd()``; the value is inert
        because the actual system headers arrive via the ``-I`` above, but pinning it to a
        fixed path keeps generation independent of the directory it is invoked from.
        """
        args = ['-std=c++17']
        if self._verbose:
            args.append('-v')
        args.append(f'-isysroot{self._repo_root}')
        args.extend(self.include_paths)
        args.extend(['-Wno-nullability-completeness', '-Wno-deprecated-literal-operator'])
        return args
