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

"""Validation utilities for the autogen tools."""

from __future__ import annotations

from importlib import metadata
from typing import (Any,
                    Collection,
                    Dict,
                    List,
                    NamedTuple,
                    Optional,
                    Sequence,
                    Tuple)

from tools.autogen.core.binding_builder import (field_is_ignored,
                                                iter_variant_types)


def get_pip_clang_version() -> Optional[str]:
    """Version of the installed `clang` pip package, if present."""
    try:
        return metadata.version('clang')
    except metadata.PackageNotFoundError:
        return None


def parse_version(version_str: str) -> Tuple[int, ...]:
    """Parse a version string such as '18.1.1' or '18.0.0-rc1' into a tuple."""
    try:
        parts = version_str.split('-')[0].split('.')
        return tuple(int(p) for p in parts if p.isdigit())
    except (ValueError, AttributeError):
        return (0,)


def validate_llvm_compatibility(system_llvm_version: str) -> Optional[str]:
    """Warn when the pip `clang` package is newer than the system LLVM it binds to.

    Returns a warning message, or None when the pair looks usable.
    """
    pip_version_str = get_pip_clang_version()
    if not pip_version_str:
        return None

    system_ver = parse_version(system_llvm_version)
    pip_ver = parse_version(pip_version_str)

    if system_ver[0] < pip_ver[0]:
        return (f'WARNING: Potential LLVM/Clang version mismatch detected!\n'
                f'  - System LLVM version: {system_llvm_version}\n'
                f"  - Pip 'clang' package version: {pip_version_str}\n\n"
                "HINT: If you hit 'libclang' loading errors or parsing failures, make sure the "
                "system LLVM version is >= the pip 'clang' package version.  Either:\n"
                "  1. Upgrade system LLVM (e.g. 'brew upgrade llvm')\n"
                f"  2. Downgrade the pip package (e.g. 'pip install clang~={system_ver[0]}.0')")

    return None


class ValidationReport(NamedTuple):
    """What the parsed model looks wrong about."""

    errors: List[str]
    warnings: List[str]

    @property
    def ok(self) -> bool:
        return not self.errors


def validate_variants(structs: Dict[str, Any],
                      cpp_core_variants: Sequence[Dict[str, Any]],
                      ignored_fields: Collection[str] = (),
                      private_field_structs: Collection[str] = ()
                      ) -> Tuple[List[str], List[str]]:
    """Check the configured std::variant tags against the variants the C++ core declares.

    A std::variant reaches JS with no discriminator, so each one is flattened into a
    "<field>_name" / "<field>_value" pair and the generated converter dispatches on the tag.
    The alternatives come from the core and the tags from config, so the two have to be
    reconciled here: an alternative the core declares but config does not tag would be dropped
    from the dispatch chain, and one config tags but the core no longer declares would emit a
    branch that cannot compile.

    Anything not registered falls back to the generic converter in jstocbpp_cpptypes.hpp, which
    throws on the way in from JS.  That is only correct when there is nothing to dispatch on, so
    a variant with at least one marshallable alternative is reported as a warning rather than
    left to fail at runtime.
    """
    errors: List[str] = []
    warnings: List[str] = []
    registered = set()

    for entry in cpp_core_variants:
        core_struct = entry.get('core_struct')
        field_name = entry.get('field')
        if not core_struct or not field_name:
            errors.append(f'cpp_core_variants entry needs core_struct and field; got {entry}')
            continue

        label = f'{core_struct}::{field_name}'
        registered.add((core_struct, field_name))

        struct = structs.get(core_struct)
        if struct is None:
            errors.append(f'{label}: registered as a variant, but the struct was not parsed')
            continue

        field = next((f for f in struct.get('fields', []) if f['name'] == field_name), None)
        if field is None:
            errors.append(f'{label}: registered as a variant, but the struct declares no such field')
            continue

        field_type = field.get('type', {})
        if field_type.get('name') != 'std::variant':
            errors.append(f'{label}: registered as a variant, but it is a '
                          f'{field_type.get("name")}')
            continue

        # std::monostate takes no tag: it is what an absent value marshals to, and the
        # generated chain simply omits its branch.
        declared = [a['name'] for a in field_type['of'] if a['name'] != 'std::monostate']
        alternatives = entry.get('alternatives', [])
        configured = [a.get('core_struct') for a in alternatives]

        missing = [a for a in declared if a not in configured]
        if missing:
            errors.append(f'{label}: the C++ core declares alternative(s) with no configured '
                          f'tag: {", ".join(missing)}')

        unknown = [a for a in configured if a not in declared]
        if unknown:
            errors.append(f'{label}: configured alternative(s) the C++ core no longer declares: '
                          f'{", ".join(str(a) for a in unknown)}')

        tags = [a.get('tag') for a in alternatives]
        duplicates = sorted({t for t in tags if tags.count(t) > 1})
        if duplicates:
            errors.append(f'{label}: duplicate tag(s) {", ".join(str(t) for t in duplicates)}; '
                          'each alternative needs its own')

        # Every alternative is marshalled by js_to_cbpp<T>, so each one needs a generated
        # specialisation of its own.
        for alternative in declared:
            if alternative not in structs:
                errors.append(f'{label}: alternative {alternative} was not parsed, so it has '
                              'no marshaller; add it to parser.types')

    for struct_name in sorted(structs):
        for field in structs[struct_name].get('fields', []):
            field_name = field['name']
            if (struct_name, field_name) in registered:
                continue
            if field_is_ignored(struct_name, field_name, ignored_fields, private_field_structs):
                continue

            for variant in iter_variant_types(field.get('type')):
                taggable = [a['name'] for a in variant.get('of', []) if a['name'] in structs]
                if taggable:
                    warnings.append(
                        f'{struct_name}::{field_name}: untagged std::variant whose '
                        f'alternative(s) {", ".join(taggable)} are marshallable, so it should '
                        'have a renderer.cpp_core_variants entry; without one, marshalling it '
                        'from JS throws')

    return errors, warnings


def validate_type_model(type_model: Dict[str, Any],
                        allow_empty_fields: Optional[Sequence[str]] = None,
                        required_fields: Optional[Dict[str, Sequence[str]]] = None,
                        cpp_core_variants: Optional[Sequence[Dict[str, Any]]] = None,
                        ignored_fields: Collection[str] = (),
                        private_field_structs: Collection[str] = ()
                        ) -> ValidationReport:
    """Check the parsed model for the shapes that mean the parse silently went wrong.

    A struct that reaches the renderer with no fields yields a binding that compiles,
    marshals nothing and fails at runtime.  That is what a forward declaration shadowing
    its own definition looked like, and it went unnoticed until the binding was
    exercised - so it is an error here rather than a warning.
    """
    allowed_empty = set(allow_empty_fields or [])
    required = dict(required_fields or {})

    errors: List[str] = []
    warnings: List[str] = []

    structs = {s['name']: s for s in type_model.get('op_structs', [])}

    for name in sorted(structs):
        if not structs[name].get('fields') and name not in allowed_empty:
            errors.append(f'{name}: parsed with no fields')

    # An allow-listed name that has since gained fields is stale config rather than a
    # failure - report it so the list does not quietly outlive its reason.
    for name in sorted(allowed_empty):
        if name not in structs:
            warnings.append(f'{name}: allowed to be empty but was not parsed at all')
        elif structs[name].get('fields'):
            warnings.append(f'{name}: allowed to be empty but has fields')

    for name, expected in sorted(required.items()):
        struct = structs.get(name)
        if struct is None:
            errors.append(f'{name}: required fields configured, but the struct was not parsed')
            continue
        present = {f['name'] for f in struct.get('fields', [])}
        missing = [f for f in expected if f not in present]
        if missing:
            errors.append(f'{name}: missing required field(s) {", ".join(missing)}')

    for enum in type_model.get('op_enums', []):
        if not enum.get('values'):
            errors.append(f'{enum["name"]}: parsed with no values')

    variant_errors, variant_warnings = validate_variants(structs,
                                                         cpp_core_variants or [],
                                                         ignored_fields,
                                                         private_field_structs)
    errors.extend(variant_errors)
    warnings.extend(variant_warnings)

    return ValidationReport(errors=errors, warnings=warnings)
