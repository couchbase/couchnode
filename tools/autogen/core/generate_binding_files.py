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

"""Render the templates and splice the result into the generated regions."""

from __future__ import annotations

from pathlib import Path
from typing import (Callable,
                    Dict,
                    List,
                    NamedTuple,
                    Optional)

from jinja2 import (Environment,
                    FileSystemLoader,
                    StrictUndefined)

from tools.autogen.core.binding_builder import BindingBuilder

# Templates are named for the file they feed, so the mapping from a template to the
# context builder that supplies it lives here rather than in the config.
_CONTEXT_BUILDERS: Dict[str, str] = {
    'binding_ts.jinja2': 'build_binding_ts_context',
    'connection_hpp.jinja2': 'build_connection_ops_context',
    'connection_autogen_cpp.jinja2': 'build_connection_ops_context',
    'connection_cpp.jinja2': 'build_connection_ops_context',
    'constants_cpp.jinja2': 'build_constants_context',
    'jstocbpp_autogen_hpp.jinja2': 'build_marshalling_context',
}


class RegionMissingError(Exception):
    """A target file has lost one of its `//#region` markers."""


class GeneratedRegion(NamedTuple):
    region: str
    path: Path
    template: str

    @property
    def prolog(self) -> str:
        return f'//#region {self.region}'

    @property
    def epilog(self) -> str:
        return f'//#endregion {self.region}'


class BindingGenerator:
    """Renders each configured region and writes it back into its target file."""

    def __init__(self,
                 builder: BindingBuilder,
                 outputs: List[Dict[str, str]],
                 templates_dir: Path,
                 repo_root: Path) -> None:
        self._builder = builder
        self._repo_root = repo_root
        self._regions = [GeneratedRegion(region=o['region'],
                                         path=repo_root / o['file'],
                                         template=o['template'])
                         for o in outputs]
        # trim_blocks/lstrip_blocks let the control tags sit on their own lines without
        # contributing whitespace, so a template reads like the code it emits.
        self._env = Environment(loader=FileSystemLoader(str(templates_dir)),
                                trim_blocks=True,
                                lstrip_blocks=True,
                                keep_trailing_newline=True,
                                undefined=StrictUndefined)

    @property
    def regions(self) -> List[GeneratedRegion]:
        return self._regions

    def render(self, region: GeneratedRegion) -> str:
        build = getattr(self._builder, _CONTEXT_BUILDERS[region.template])
        return self._env.get_template(region.template).render(**build())

    def generate(self,
                 on_region: Optional[Callable[[GeneratedRegion], None]] = None
                 ) -> List[GeneratedRegion]:
        """Render every region, returning the ones whose rendered body moved.

        Note that a region can render identically and still leave the file changed once
        formatting runs, and vice versa - `post_process.restore_unchanged` is what answers
        "did generation change anything" for the run as a whole.
        """
        rewritten = []
        for region in self._regions:
            if on_region:
                on_region(region)
            if self._write_region(region, self.render(region)):
                rewritten.append(region)
        return rewritten

    @staticmethod
    def _write_region(region: GeneratedRegion, body: str) -> bool:
        """Replace the text between the region markers, leaving the rest of the file be.

        Returns whether the file needed rewriting; an identical region is not written at all.
        """
        original = region.path.read_text()

        start = original.find(region.prolog)
        if start == -1:
            raise RegionMissingError(
                f'{region.path}: no "{region.prolog}" marker to generate into')
        end = original.find(region.epilog)
        if end == -1:
            raise RegionMissingError(
                f'{region.path}: no "{region.epilog}" marker to generate into')
        if end < start:
            raise RegionMissingError(
                f'{region.path}: "{region.epilog}" appears before "{region.prolog}"')

        updated = (original[:start]
                   + region.prolog + '\n'
                   + '\n' + body + '\n'
                   + region.epilog
                   + original[end + len(region.epilog):])
        if updated == original:
            return False
        region.path.write_text(updated)
        return True


def render_all(builder: BindingBuilder,
               outputs: List[Dict[str, str]],
               templates_dir: Path,
               repo_root: Path) -> Dict[str, str]:
    """Render every region without touching the filesystem."""
    generator = BindingGenerator(builder, outputs, templates_dir, repo_root)
    return {r.region: generator.render(r) for r in generator.regions}
