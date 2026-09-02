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

"""The ``bindings`` command group."""

from __future__ import annotations

import json
import sys
from pathlib import (Path,
                     PurePosixPath)
from typing import (Optional,
                    Tuple)

import click

from tools.autogen.core.binding_builder import BindingBuilder
from tools.autogen.core.config import BindingsConfig
from tools.autogen.core.cpp_type_parser import CppTypeParser
from tools.autogen.core.generate_binding_files import (BindingGenerator,
                                                       RegionMissingError)
from tools.autogen.core.llvm_env import LlvmEnvironment
from tools.autogen.core.post_process import (FormatterError,
                                             format_files,
                                             preserve_times,
                                             restore_unchanged,
                                             revert,
                                             snapshot)
from tools.autogen.core.validators import (validate_llvm_compatibility,
                                           validate_type_model)

# Where the parsed type model is written.  Consumed by the renderer; gitignored.
TYPE_MODEL_FILENAME = 'bindings.json'


@click.group(name='bindings')
def bindings_group():
    """Generate the C++ / TypeScript binding code from the C++ core headers."""


def llvm_options(command):
    """Shared LLVM discovery overrides."""
    for option in reversed([
        click.option('--llvm-version',
                     help='LLVM version, e.g. 18.  Defaults to CN_LLVM_VERSION or `llvm-config --version`.'),
        click.option('--llvm-includedir',
                     help='LLVM include dir.  Defaults to CN_LLVM_INCLUDE or `llvm-config --includedir`.'),
        click.option('--llvm-libdir',
                     help='Directory holding libclang.  Defaults to CN_LLVM_LIB or `llvm-config --libdir`.'),
        click.option('--system-headers',
                     help='System SDK path.  Defaults to CN_SYS_HEADERS or `xcrun --show-sdk-path`.'),
        click.option('--config-path',
                     type=click.Path(exists=True, dir_okay=False, path_type=Path),
                     help='Override the bindings config (defaults to config/bindings.yaml).'),
        click.option('--verbose', is_flag=True, help='Verbose parser and clang output.'),
    ]):
        command = option(command)
    return command


def _build_parser(ctx,
                  llvm_version: Optional[str],
                  llvm_includedir: Optional[str],
                  llvm_libdir: Optional[str],
                  system_headers: Optional[str],
                  config_path: Optional[Path],
                  verbose: bool) -> Tuple[BindingsConfig, CppTypeParser]:
    """Resolve config + LLVM and return the config alongside a parser ready to run."""
    repo_root = ctx.obj['root']
    config = BindingsConfig.load(repo_root, config_path)
    config.check_paths()

    llvm = LlvmEnvironment(repo_root=repo_root,
                           cxx_client_root=config.cxx_client_root,
                           cxx_client_cache=config.cxx_client_cache,
                           deps_include_paths=config.deps_include_paths,
                           version=llvm_version,
                           includedir=llvm_includedir,
                           libdir=llvm_libdir,
                           system_headers=system_headers,
                           verbose=verbose)

    warning = validate_llvm_compatibility(llvm.version)
    if warning:
        click.secho(warning, fg='yellow')

    click.echo(f'Using LLVM version={llvm.version}')
    if verbose:
        click.echo(f'Using libdir={llvm.libdir}')
        click.echo(f'Include paths={llvm.include_paths}')

    llvm.configure_clang()

    log = click.echo if verbose else (lambda *_a, **_k: None)
    parser = CppTypeParser(cxx_client_root=config.cxx_client_root,
                           headers=config.headers,
                           types=config.types,
                           excluded_name_fragments=config.excluded_name_fragments,
                           templated_requests=config.templated_requests,
                           span_only_responses=config.span_only_responses,
                           clang_args=llvm.clang_args(),
                           verbose=verbose,
                           log=log)
    return config, parser


@bindings_group.command()
@llvm_options
@click.option('--output-path',
              type=click.Path(file_okay=False, path_type=Path),
              help='Directory to write the parsed type model into (defaults to tools/).')
@click.option('--parse-only', is_flag=True,
              help='Parse the C++ core and write the type model, but do not render.')
@click.option('--dry-run', is_flag=True,
              help='Generate and format, then put every file back, reporting what would '
                   'have changed.  Same answer as a real run, no lasting edits.')
@click.option('--no-format', is_flag=True,
              help='Skip the formatting pass.  The result will not match what is committed.')
@click.option('--no-restore-unchanged', is_flag=True,
              help='Keep generated files whose only delta against HEAD is run metadata.')
@click.option('--check', is_flag=True,
              help='Exit non-zero if a regeneration would change anything.  Implies '
                   '--dry-run: nothing is left modified.  For CI.')
@click.pass_context
def generate(ctx,
             llvm_version: Optional[str],
             llvm_includedir: Optional[str],
             llvm_libdir: Optional[str],
             system_headers: Optional[str],
             config_path: Optional[Path],
             verbose: bool,
             output_path: Optional[Path],
             parse_only: bool,
             dry_run: bool,
             no_format: bool,
             no_restore_unchanged: bool,
             check: bool):
    """Parse the C++ core headers and render the binding files."""
    if check:
        if parse_only:
            raise click.UsageError('--check has nothing to check with --parse-only; '
                                   '--parse-only renders no files.')
        if no_format:
            raise click.UsageError('--check cannot skip formatting: unformatted output never '
                                   'matches what is committed, so every file would report as '
                                   'changed.')
        # The measurement is the same either way; only the exit code differs.
        dry_run = True

    repo_root = ctx.obj['root']
    config, parser = _build_parser(ctx, llvm_version, llvm_includedir, llvm_libdir,
                                   system_headers, config_path, verbose)

    click.echo(f'Parsing {len(parser.header_files)} header(s) from the C++ core...')
    type_model = parser.parse()
    click.echo(f'Parsed {len(type_model["op_structs"])} struct(s) '
               f'and {len(type_model["op_enums"])} enum(s).')

    _check_type_model(config, type_model)

    if not dry_run:
        out_dir = output_path if output_path else repo_root / 'tools'
        out_dir.mkdir(parents=True, exist_ok=True)
        model_file = out_dir / TYPE_MODEL_FILENAME
        with open(model_file, 'w') as f:
            f.write(json.dumps(type_model))
        click.echo(f'Wrote type model to {model_file}')

    if parse_only:
        return

    click.echo('Rendering binding files...')
    builder = BindingBuilder(type_model, config.renderer)
    generator = BindingGenerator(builder=builder,
                                 outputs=config.outputs,
                                 templates_dir=config.templates_dir,
                                 repo_root=repo_root)

    # What actually changed is settled against HEAD; this is for the timestamps, and for
    # undoing a dry run.
    before = snapshot(config.output_files)

    def report(region):
        click.echo(f'  {region.path.relative_to(repo_root)}  ({region.region})')

    try:
        generator.generate(on_region=report)
    except RegionMissingError as ex:
        raise click.ClickException(str(ex))

    _post_process(config, repo_root,
                  skip_format=no_format,
                  skip_restore=no_restore_unchanged,
                  verbose=verbose)

    if dry_run:
        moved = revert(before)
        if moved:
            click.echo(f'{len(moved)} file(s) would change:')
            for path in moved:
                click.echo(f'  {path.relative_to(repo_root)}')
        else:
            click.echo('Nothing would change - the bindings are already up to date.')
        click.secho('Dry run complete; every file was put back.', fg='yellow')
        if check and moved:
            raise click.ClickException(
                'The generated bindings are out of date.  Run `bindings generate` and commit '
                'the result.')
        return

    preserve_times(before)
    click.secho('Generation complete.', fg='green')
    if no_format:
        click.echo('Run `bindings tidy` before committing; see BUILDING.md.')


def _check_type_model(config: BindingsConfig, type_model) -> None:
    """Stop before rendering when the parse produced something that cannot be right."""
    renderer = config.renderer
    report = validate_type_model(type_model,
                                 allow_empty_fields=config.allow_empty_fields,
                                 required_fields=config.required_fields,
                                 cpp_core_variants=renderer.get('cpp_core_variants', []),
                                 ignored_fields=renderer.get('ignored_fields', []),
                                 private_field_structs=renderer.get(
                                     'structs_with_allowed_private_fields', []))
    for warning in report.warnings:
        click.secho(f'  warning: {warning}', fg='yellow')
    if report.ok:
        return

    for error in report.errors:
        click.secho(f'  {error}', fg='red', err=True)
    raise click.ClickException(
        f'{len(report.errors)} validation error(s); nothing was generated.\n'
        'Run `bindings inspect --type <name>` to see what the parser found for one of them.')


def _post_process(config: BindingsConfig,
                  repo_root: Path,
                  skip_format: bool = False,
                  skip_restore: bool = False,
                  verbose: bool = False) -> None:
    """Format the generated files, then drop the ones that did not really change."""
    output_files = config.output_files

    if not skip_format:
        click.echo('Formatting generated files...')
        try:
            results = format_files(config.formatters, output_files, repo_root,
                                   log=click.echo if verbose else None)
        except FormatterError as ex:
            raise click.ClickException(str(ex))
        for result in results:
            state = 'reformatted' if result.changed else 'already tidy'
            click.echo(f'  {result.path.relative_to(repo_root)}  ({state})')

    if skip_restore:
        return

    report = restore_unchanged(output_files, repo_root)
    click.echo(f'{len(report.changed)} file(s) changed, '
               f'{len(report.restored)} restored (metadata-only), '
               f'{len(report.untouched)} already up to date')
    for path in report.changed:
        click.secho(f'  changed:  {path.relative_to(repo_root)}', fg='cyan')
    for path in report.restored:
        click.echo(f'  restored: {path.relative_to(repo_root)}')


@bindings_group.command()
@click.option('--config-path',
              type=click.Path(exists=True, dir_okay=False, path_type=Path),
              help='Override the bindings config (defaults to config/bindings.yaml).')
@click.option('--no-format', is_flag=True,
              help='Skip the formatting pass and only report what changed.')
@click.option('--verbose', is_flag=True, help='Echo each formatter invocation.')
@click.pass_context
def tidy(ctx, config_path: Optional[Path], no_format: bool, verbose: bool):
    """Format generated files and restore the ones that did not really change.

    The tail of `bindings generate`, runnable on its own for when generation and formatting
    were done by hand.  Parses nothing and needs no LLVM.
    """
    repo_root = ctx.obj['root']
    config = BindingsConfig.load(repo_root, config_path)
    _post_process(config, repo_root, skip_format=no_format, verbose=verbose)
    click.secho('Done.', fg='green')


@bindings_group.command()
@llvm_options
@click.option('--type', 'type_names', multiple=True,
              help='Struct to inspect.  Accepts a fully-qualified name, a leaf name, '
                   'or a substring.  May be repeated.')
@click.option('--header', 'header_names', multiple=True,
              help='Header whose types should be dumped.  Accepts a path relative to the '
                   'C++ core root, or just the file name.  May be repeated.')
@click.option('--as-json', is_flag=True, help='Emit the raw parsed model as JSON.')
@click.pass_context
def inspect(ctx,
            llvm_version: Optional[str],
            llvm_includedir: Optional[str],
            llvm_libdir: Optional[str],
            system_headers: Optional[str],
            config_path: Optional[Path],
            verbose: bool,
            type_names,
            header_names,
            as_json: bool):
    """Dump what the libclang pass sees for a struct or header.  Writes no files."""
    if not type_names and not header_names:
        raise click.UsageError('Provide at least one --type or --header.')

    _, parser = _build_parser(ctx, llvm_version, llvm_includedir, llvm_libdir,
                              system_headers, config_path, verbose)
    type_model = parser.parse()
    structs = type_model['op_structs']

    matched = []
    for name in type_names:
        hits = [s for s in structs
                if s['name'] == name
                or s['name'].split('::')[-1] == name
                or name in s['name']]
        if not hits:
            click.secho(f'No parsed struct matches --type {name}', fg='red', err=True)
        matched.extend(hits)

    # Every struct records the header it was declared in, so this selects on where a type
    # actually came from.  Matching works off the model, so it reports what survived parsing.
    for header in header_names:
        hits = [s for s in structs if _header_matches(s.get('header', ''), header)]
        if not hits:
            click.secho(f'No parsed struct was declared in --header {header}', fg='red', err=True)
        matched.extend(hits)

    # De-duplicate, preserving order.
    seen = set()
    unique = [s for s in matched if not (s['name'] in seen or seen.add(s['name']))]

    if as_json:
        click.echo(json.dumps(unique, indent=2))
        return

    for struct in unique:
        click.secho(struct['name'], fg='cyan', bold=True)
        if not struct['fields']:
            click.secho('  (no fields)', fg='red')
        for field in struct['fields']:
            click.echo(f"  {field['name']}: {_render_type(field['type'])}")
        click.echo('')

    if not unique:
        sys.exit(1)


def _header_matches(recorded: str, wanted: str) -> bool:
    """Whether a struct's recorded header is the one asked for.

    Accepts either the path relative to the C++ core root, as the model records it, or just
    the file name - `core/operations/document_get.hxx` and `document_get.hxx` both select.
    """
    if not recorded:
        return False
    recorded_path = PurePosixPath(recorded)
    wanted_path = PurePosixPath(wanted)
    if wanted_path.name == str(wanted_path):
        return recorded_path.name == wanted_path.name
    return recorded_path == wanted_path


def _render_type(type_model) -> str:
    """Render a parsed type model back into something close to its C++ spelling."""
    if isinstance(type_model, list):
        return ', '.join(_render_type(t) for t in type_model)

    name = type_model.get('name', 'unknown')
    if 'of' not in type_model:
        return name

    inner = _render_type(type_model['of'])
    if 'to' in type_model:
        inner = f"{inner}, {_render_type(type_model['to'])}"
        if 'comparator' in type_model:
            inner = f"{inner}, {_render_type(type_model['comparator'])}"
    elif 'size' in type_model:
        inner = f"{inner}, {type_model['size']}"
    return f'{name}<{inner}>'
