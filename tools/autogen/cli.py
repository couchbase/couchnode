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

"""Main CLI entry point for the autogen tools."""

from pathlib import Path

import click

from tools.autogen.commands.bindings import bindings_group


@click.group()
@click.version_option(version='1.0.0', prog_name='autogen')
@click.pass_context
def cli(ctx):
    """Couchbase Node.js SDK code generation tools.

    Generate SDK code from the C++ core headers using the schema in
    tools/autogen/config/bindings.yaml.

    Examples:

    \b
    # Generate the C++ / TypeScript bindings
    python -m tools.autogen bindings generate
    """
    ctx.ensure_object(dict)
    # tools/autogen/cli.py -> tools/autogen -> tools -> repository root
    ctx.obj['root'] = Path(__file__).parent.parent.parent


cli.add_command(bindings_group)


if __name__ == '__main__':
    cli()
