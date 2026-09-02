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

"""Loading and validating ``config/bindings.yaml``."""

from __future__ import annotations

from pathlib import Path
from typing import (Any,
                    Dict,
                    List,
                    Optional)

import yaml

DEFAULT_CONFIG_PATH = Path(__file__).parent.parent / 'config' / 'bindings.yaml'

_REQUIRED_SECTIONS = ['cxx_client', 'parser', 'renderer', 'format']

DEFAULT_TEMPLATES_DIR = Path(__file__).parent.parent / 'templates' / 'bindings'


class BindingsConfig:
    """Typed accessors over the parsed YAML config."""

    def __init__(self, raw: Dict[str, Any], repo_root: Path) -> None:
        self._raw = raw
        self._repo_root = repo_root

        missing = [s for s in _REQUIRED_SECTIONS if s not in raw]
        if missing:
            raise ValueError(f'bindings config is missing required section(s): {missing}')

        parser = raw['parser']
        if not parser.get('headers'):
            raise ValueError('bindings config: parser.headers is empty')
        if not parser.get('types'):
            raise ValueError('bindings config: parser.types is empty')
        if not raw['renderer'].get('outputs'):
            raise ValueError('bindings config: renderer.outputs is empty')
        if not raw['format'].get('formatters'):
            raise ValueError('bindings config: format.formatters is empty')

    @classmethod
    def load(cls, repo_root: Path, config_path: Optional[Path] = None) -> 'BindingsConfig':
        path = Path(config_path) if config_path else DEFAULT_CONFIG_PATH
        if not path.is_file():
            raise FileNotFoundError(f'bindings config not found: {path}')
        with open(path, 'r') as f:
            return cls(yaml.safe_load(f), repo_root)

    # ----------------------------------------------------------- cxx_client

    @property
    def cxx_client_root(self) -> Path:
        return self._repo_root / self._raw['cxx_client']['root']

    @property
    def cxx_client_cache(self) -> Path:
        return self._repo_root / self._raw['cxx_client']['cache']

    @property
    def deps_include_paths(self) -> Dict[str, List[str]]:
        return self._raw['cxx_client'].get('deps_include_paths', {})

    # --------------------------------------------------------------- parser

    @property
    def headers(self) -> List[str]:
        return self._raw['parser']['headers']

    @property
    def types(self) -> List[str]:
        return self._raw['parser']['types']

    @property
    def excluded_name_fragments(self) -> List[str]:
        return self._raw['parser'].get('excluded_name_fragments', [])

    @property
    def templated_requests(self) -> Dict[str, Any]:
        return self._raw['parser'].get('templated_requests', {})

    # ------------------------------------------------------------- renderer

    @property
    def renderer(self) -> Dict[str, Any]:
        return self._raw['renderer']

    @property
    def outputs(self) -> List[Dict[str, str]]:
        return self._raw['renderer']['outputs']

    @property
    def templates_dir(self) -> Path:
        return DEFAULT_TEMPLATES_DIR

    @property
    def output_files(self) -> List[Path]:
        """Every file holding a generated region, de-duplicated, in config order."""
        paths = [self._repo_root / o['file'] for o in self.outputs]
        return list(dict.fromkeys(paths))

    # ------------------------------------------------------------- validation

    @property
    def allow_empty_fields(self) -> List[str]:
        return self._raw.get('validation', {}).get('allow_empty_fields', [])

    @property
    def required_fields(self) -> Dict[str, List[str]]:
        return self._raw.get('validation', {}).get('required_fields', {})

    # --------------------------------------------------------------- format

    @property
    def formatters(self) -> Dict[str, List[str]]:
        return self._raw['format']['formatters']

    # -------------------------------------------------------- observability

    @property
    def span_only_responses(self) -> List[str]:
        return self._raw.get('observability', {}).get('span_only_responses', [])

    def check_paths(self) -> None:
        """Fail early, with actionable guidance, when the C++ core inputs are absent."""
        if not self.cxx_client_root.is_dir() or not any(self.cxx_client_root.iterdir()):
            raise RuntimeError(
                f'C++ core checkout is missing or empty: {self.cxx_client_root}\n'
                'Run: git submodule update --init --recursive deps/couchbase-cxx-client')
        if not self.cxx_client_cache.is_dir():
            raise RuntimeError(
                f'CPM dependency cache is missing: {self.cxx_client_cache}\n'
                'Populate it before generating bindings (see BUILDING.md).')
