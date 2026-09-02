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

"""Parse the C++ core headers with libclang into a language-neutral type model.

The output of :meth:`CppTypeParser.parse` is the ``op_structs`` / ``op_enums`` document that
downstream rendering consumes.  Nothing in this module knows about TypeScript or N-API - it
describes what the C++ core declares, and nothing more.
"""

from __future__ import annotations

import os
import re
from functools import reduce
from pathlib import Path
from typing import (Any,
                    Dict,
                    List,
                    Optional)

import clang.cindex

# Emitted by libclang for a field whose type is an inline anonymous struct.
UNNAMED_STRUCT_DELIM = '::(unnamed struct'

_STD_COMPARATOR_TEMPLATES = ['std::less<{0}>',
                             'std::greater<{0}>',
                             'std::less_equal<{0}>',
                             'std::greater_equal<{0}>']
# Both the explicit (`std::less<void>`) and defaulted (`std::less<>`) spellings.
STD_COMPARATORS = list(reduce(lambda a, b: a + b,
                              [[c.format(s) for s in ['', 'void']] for c in _STD_COMPARATOR_TEMPLATES],
                              []))

# Canonical spellings libclang produces, mapped to the names the templates expect.
_SCALAR_TYPE_MAP = {
    'std::mutex': 'std::mutex',
    'std::string': 'std::string',
    'std::chrono::duration<long long>': 'std::chrono::seconds',
    'std::chrono::duration<long long, std::ratio<1, 1000>>': 'std::chrono::milliseconds',
    'std::chrono::duration<long long, std::ratio<1, 1000000>>': 'std::chrono::microseconds',
    'std::chrono::duration<long long, std::ratio<1, 1000000000>>': 'std::chrono::nanoseconds',
    'std::error_code': 'std::error_code',
    'std::monostate': 'std::monostate',
    'std::byte': 'std::byte',
    'unsigned long': 'std::size_t',
    'char': 'std::int8_t',
    'unsigned char': 'std::uint8_t',
    'short': 'std::int16_t',
    'unsigned short': 'std::uint16_t',
    'int': 'std::int32_t',
    'unsigned int': 'std::uint32_t',
    'long long': 'std::int64_t',
    'unsigned long long': 'std::uint64_t',
    'bool': 'std::bool',
    'float': 'std::float',
    'double': 'std::double',
    'std::nullptr_t': 'std::nullptr_t',
}

# Template classes whose single parameter is parsed recursively.
_SINGLE_PARAM_TEMPLATES = ['std::optional', 'std::vector', 'std::set', 'std::shared_ptr']


class CppTypeParser:
    """libclang traversal of the configured C++ core headers."""

    def __init__(self,
                 cxx_client_root: Path,
                 headers: List[str],
                 types: List[str],
                 excluded_name_fragments: List[str],
                 templated_requests: Dict[str, Any],
                 span_only_responses: List[str],
                 clang_args: List[str],
                 verbose: bool = False,
                 log=print) -> None:
        self._cxx_client_root = cxx_client_root
        self._excluded_name_fragments = excluded_name_fragments
        self._templated_requests = templated_requests
        self._span_only_responses = span_only_responses
        self._clang_args = clang_args
        self._verbose = verbose
        self._log = log

        # Wildcards in the type list become regexes; "*" matches any suffix.  Everything
        # else is matched literally, so an entry without a "*" is an exact type name.
        self._type_list_re = ['.*'.join(re.escape(part) for part in t.split('*')) for t in types]

        self._op_types: List[Dict[str, Any]] = []
        self._op_enums: List[Dict[str, Any]] = []
        # Anonymous structs discovered mid-traversal, named after the field declaring them.
        self._internal_structs: List[str] = []
        self._header_files = self._resolve_headers(headers)

    @property
    def header_files(self) -> List[str]:
        return self._header_files

    @property
    def op_types(self) -> List[Dict[str, Any]]:
        return self._op_types

    @property
    def op_enums(self) -> List[Dict[str, Any]]:
        return self._op_enums

    # ------------------------------------------------------------------ headers

    def _resolve_headers(self, headers: List[str]) -> List[str]:
        """Expand the configured header globs into concrete paths."""
        resolved: List[str] = []
        for file_path in headers:
            if '*' not in file_path:
                resolved.append(os.path.join(self._cxx_client_root, file_path))
                continue

            base_path = file_path[:-1]
            if '*' in base_path:
                raise NotImplementedError('wildcard only supported at end of file path')

            if base_path[-1] != os.path.sep:
                # "<dir>/<prefix>*" - every .hxx in <dir> starting with <prefix>.
                tokens = base_path.split(os.path.sep)
                resolved.extend(self._list_headers_in_dir(
                    os.path.join(self._cxx_client_root, *tokens[:-1]), tokens[-1]))
            else:
                # "<dir>/*" - every .hxx in <dir>.
                resolved.extend(self._list_headers_in_dir(
                    os.path.join(self._cxx_client_root, base_path)))

        # Serialization and formatting helpers never contribute bindings.
        return [h for h in resolved if not h.endswith('_json.hxx') and not h.endswith('_fmt.hxx')]

    @staticmethod
    def _list_headers_in_dir(path: str, file_startswith: Optional[str] = None) -> List[str]:
        files = os.listdir(path)
        if file_startswith is not None:
            files = [f for f in files if f.endswith('.hxx') and f.startswith(file_startswith)]
            return [os.path.join(path, f) for f in files]
        files = [f for f in files if f.endswith('.hxx')]
        # `path` already carries its trailing separator in this branch.
        return [path + f for f in files]

    def _relative_header(self, header_path: str) -> str:
        """The header a struct came from, relative to the C++ core root.

        Recorded on every struct so `bindings inspect --header` can select on where a type
        was actually declared rather than guessing from its name.
        """
        try:
            return str(Path(header_path).relative_to(self._cxx_client_root))
        except ValueError:
            return header_path

    # ------------------------------------------------------------------- parse

    def parse(self) -> Dict[str, List[Dict[str, Any]]]:
        """Parse every configured header and return the assembled type model."""
        for header_path in self._header_files:
            self._log(f'processing {header_path}')
            index = clang.cindex.Index.create()
            translation_unit = index.parse(header_path, args=self._clang_args)

            for diagnostic in translation_unit.diagnostics:
                self._log(str(diagnostic))

            self.traverse(translation_unit.cursor, [], header_path)

        self._process_observability()
        return {'op_structs': self._op_types, 'op_enums': self._op_enums}

    def is_included_type(self, name: str, with_durability: bool = False) -> bool:
        if any(fragment in name for fragment in self._excluded_name_fragments):
            return False
        if with_durability is True and '_with_legacy_durability' not in name:
            return False
        return any(re.fullmatch(pattern, name) for pattern in self._type_list_re)

    # --------------------------------------------------------------- traversal

    def traverse(self, node, namespace: List[str], main_file: str) -> None:  # noqa: C901
        # Only scan declarations belonging to the header we asked for; everything else
        # arrived through an #include.
        if node.location.file is not None and node.location.file.name != main_file:
            return

        if node.kind in (clang.cindex.CursorKind.STRUCT_DECL, clang.cindex.CursorKind.CLASS_DECL):
            # Forward declarations carry no fields.  Registering one would shadow the real
            # definition later in the header via the duplicate guard below.
            if not node.is_definition():
                return
            if self._handle_struct(node, namespace, main_file):
                return

        if node.kind == clang.cindex.CursorKind.TYPE_ALIAS_DECL:
            self._handle_type_alias(node, namespace, main_file)

        if node.kind == clang.cindex.CursorKind.ENUM_DECL:
            self._handle_enum(node, namespace)

        if node.kind in (clang.cindex.CursorKind.NAMESPACE,
                         clang.cindex.CursorKind.CLASS_DECL,
                         clang.cindex.CursorKind.STRUCT_DECL):
            namespace = [*namespace, node.displayname]

        if node.kind == clang.cindex.CursorKind.CLASS_TEMPLATE:
            self._handle_class_template(node, namespace, main_file)

        for child in node.get_children():
            self.traverse(child, namespace, main_file)

    def _handle_struct(self, node, namespace: List[str], main_file: str) -> bool:
        """Register one struct.  Returns True when traversal should not descend into it."""
        full_struct_name = '::'.join([*namespace, node.displayname])

        # An anonymous struct is registered under the name of the field that declares it,
        # which `_handle_struct`'s field loop recorded on a previous visit.
        if full_struct_name.endswith('::') or UNNAMED_STRUCT_DELIM in full_struct_name:
            if full_struct_name.endswith('::'):
                struct_name = full_struct_name
            else:
                struct_name = full_struct_name.split(UNNAMED_STRUCT_DELIM)[0]
            match = next((s for s in self._internal_structs if struct_name in s), None)
            if match:
                full_struct_name = match

        if not (self.is_included_type(full_struct_name) or full_struct_name in self._internal_structs):
            return False

        struct_fields: List[Dict[str, Any]] = []
        parents: List[str] = []
        for child in node.get_children():
            if child.kind == clang.cindex.CursorKind.FIELD_DECL:
                struct_type = self.parse_type(child.type)
                type_str = child.type.get_canonical().spelling
                if 'unnamed' in type_str:
                    name_tokens = type_str.split('::')
                    name_override = '::'.join(name_tokens[:-1] + [child.displayname])
                    struct_type['name'] = name_override
                    self._internal_structs.append(name_override)

                struct_fields.append({'name': child.displayname, 'type': struct_type})
            elif child.kind == clang.cindex.CursorKind.CXX_BASE_SPECIFIER:
                parents.append('::'.join([*namespace, child.displayname]))

        # Inherited fields are flattened in; the bindings have no notion of a base class.
        if parents:
            part_op_types = [ot for ot in self._op_types if ot['name'] in parents]
            if self._verbose:
                self._log(f'{part_op_types=}')
            for sot in part_op_types:
                struct_fields.extend(sot['fields'])

        # Replica-read support introduced headers that redeclare an already-parsed request.
        # Stop here rather than descending: the nested declarations were registered the
        # first time this struct was seen.
        if any(op['name'] == full_struct_name for op in self._op_types):
            return True

        self._op_types.append({'name': full_struct_name,
                               'header': self._relative_header(main_file),
                               'fields': struct_fields})
        return False

    def _handle_type_alias(self, node, namespace: List[str], main_file: str) -> None:
        """`using x_with_legacy_durability = ...` swaps durability_level for persist/replicate."""
        full_struct_name = '::'.join([*namespace, node.displayname])
        if not self.is_included_type(full_struct_name, with_durability=True):
            return

        type_ref = next((c for c in node.get_children()
                         if c.kind == clang.cindex.CursorKind.TYPE_REF), None)
        if not type_ref:
            return

        base_request_name = type_ref.displayname.replace('struct', '').strip()
        base_request = next((op for op in self._op_types if op['name'] == base_request_name), None)
        if not base_request:
            return

        new_fields = [f for f in base_request['fields'] if f['name'] != 'durability_level']
        new_fields.extend([
            {'name': 'persist_to', 'type': {'name': 'couchbase::persist_to'}},
            {'name': 'replicate_to', 'type': {'name': 'couchbase::replicate_to'}},
        ])
        self._op_types.append({'name': full_struct_name,
                               'header': self._relative_header(main_file),
                               'fields': new_fields})

    def _handle_enum(self, node, namespace: List[str]) -> None:
        full_enum_name = '::'.join([*namespace, node.displayname])
        if not self.is_included_type(full_enum_name):
            return

        enum_values = [{'name': child.displayname, 'value': child.enum_value}
                       for child in node.get_children()
                       if child.kind == clang.cindex.CursorKind.ENUM_CONSTANT_DECL]

        self._op_enums.append({
            'name': full_enum_name,
            'type': self.parse_type(node.enum_type),
            'values': enum_values,
        })

    def _handle_class_template(self, node, namespace: List[str], main_file: str) -> None:
        """Instantiate a configured request template once per template argument."""
        name_tokens = node.displayname.split('<')
        if len(name_tokens) != 2 or name_tokens[0] not in self._templated_requests:
            return

        req = self._templated_requests[name_tokens[0]]
        full_struct_name = '::'.join([*namespace, node.displayname])
        for template in req['templates']:
            struct_fields = []
            for child in node.get_children():
                if child.kind != clang.cindex.CursorKind.FIELD_DECL:
                    continue
                type_str = child.type.get_canonical().spelling
                if 'type-parameter' in type_str:
                    struct_type = {'name': 'template', 'of': {'name': template}}
                else:
                    struct_type = self.parse_type(child.type)
                struct_fields.append({'name': child.displayname, 'type': struct_type})

            self._op_types.append({
                'name': full_struct_name.replace(req['template_name'], template),
                'header': self._relative_header(main_file),
                'fields': struct_fields,
            })

    # ----------------------------------------------------------- observability

    def _process_observability(self) -> None:
        """Rewrite `parent_span` on requests and add `cpp_core_span` to their responses."""
        cpp_spans_response = {
            'name': 'cpp_core_span',
            'type': {
                'name': 'std::optional',
                'of': {'name': 'std::vector',
                       'of': {'name': 'couchbase::core::tracing::wrapper_sdk_span'}},
            },
        }

        for op_type in self._op_types:
            if op_type.get('name') in self._span_only_responses:
                op_type['fields'].append(dict(cpp_spans_response))
                continue

            parent_span = next((f for f in op_type.get('fields') if f.get('name') == 'parent_span'),
                               None)
            if not parent_span:
                continue

            # The binding surfaces a span *name*, not the core's span object.
            parent_span['type']['name'] = 'std::optional'
            parent_span['type']['of']['name'] = 'std::string'

            resp_name = op_type.get('name').replace('request', 'response')
            resp_op = next((op for op in self._op_types if op.get('name') == resp_name), None)
            if resp_op:
                resp_op['fields'].append(dict(cpp_spans_response))

    # ------------------------------------------------------------- type model

    def parse_type(self, type_) -> Dict[str, Any]:
        return self.parse_type_str(type_.get_canonical().spelling)

    def parse_type_str(self, type_str: str) -> Dict[str, Any]:  # noqa: C901
        if type_str in _SCALAR_TYPE_MAP:
            return {'name': _SCALAR_TYPE_MAP[type_str]}

        if type_str in STD_COMPARATORS:
            # `std::less<void>` and `std::less<>` are the same type; normalize to the latter.
            if 'void' in type_str:
                return {'name': type_str.replace('void', '')}
            return {'name': type_str}

        tpl_parts = type_str.split('<', 1)
        if len(tpl_parts) > 1:
            tpl_class_name = tpl_parts[0]
            tpl_params = tpl_parts[1][:-1]

            if tpl_class_name == 'std::function':
                # Callbacks are wired up by hand; the binding only needs to know it is one.
                return {'name': 'std::function'}

            if tpl_class_name in _SINGLE_PARAM_TEMPLATES:
                return {'name': tpl_class_name, 'of': self.parse_type_str(tpl_params)}

            if tpl_class_name == 'std::variant':
                return {'name': 'std::variant',
                        'of': [self.parse_type_str(p) for p in tpl_params.split(', ')]}

            if tpl_class_name == 'std::array':
                array_parts = tpl_params.split(', ')
                if len(array_parts) != 2:
                    self._log(f'FAILED TO PARSE ARRAY TYPES: {type_str}')
                    return {'name': 'unknown', 'str': type_str}
                return {'name': 'std::array',
                        'of': self.parse_type_str(array_parts[0]),
                        'size': int(array_parts[1])}

            if tpl_class_name == 'std::map':
                map_parts = tpl_params.split(', ')
                if len(map_parts) < 2 or len(map_parts) > 3:
                    self._log(f'FAILED TO PARSE MAP TYPES: {type_str}')
                    return {'name': 'unknown', 'str': type_str}
                parsed = {'name': 'std::map',
                          'of': self.parse_type_str(map_parts[0]),
                          'to': self.parse_type_str(map_parts[1])}
                if len(map_parts) == 3:
                    parsed['comparator'] = self.parse_type_str(map_parts[2])
                return parsed

        if not type_str.startswith('couchbase::'):
            self._log(f'FAILED TO PARSE STRING TYPE: {type_str}')
            return {'name': 'unknown', 'str': type_str}

        if 'unnamed struct' in type_str:
            self._log(f'WARNING:  Found unnamed struct: {type_str}')

        return {'name': type_str}
