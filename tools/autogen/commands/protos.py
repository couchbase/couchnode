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

"""The ``protos`` command group."""

from __future__ import annotations

import subprocess
from pathlib import Path

import click

from tools.autogen.core.protos import (GENERATED,
                                       PROTOS,
                                       ProtosError,
                                       drift,
                                       render,
                                       write)


@click.group(name='protos')
def protos_group():
    """The couchbase2 protocol's schema and the type declarations generated from it."""


@protos_group.command(name='generate')
@click.option('--check', is_flag=True,
              help='Write nothing; fail when the tree differs from what would be written.')
@click.pass_context
def generate(ctx, check: bool) -> None:
    """Write the pinned protos and their declarations, or check that they are current."""
    root = Path(ctx.obj['root'])
    try:
        trees = render(root)
        changes = drift(root, trees) if check else write(root, trees)
    except (ProtosError, subprocess.CalledProcessError) as error:
        raise click.ClickException(str(error))
    if check and changes:
        click.echo('\n'.join(changes), err=True)
        raise click.ClickException(f'{PROTOS} or {GENERATED} is stale: run `npm run gen:protos`')
    if changes:
        click.echo('\n'.join(changes))
    else:
        click.echo(f'{PROTOS} and {GENERATED} up to date')
