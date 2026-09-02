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

"""Turn the parsed C++ type model into the render contexts the templates consume.

Everything that requires knowing something about C++ or TypeScript lives here.  The
templates are deliberately dumb: they iterate and interpolate, they do not decide.
"""

from __future__ import annotations

import string
from typing import (Any,
                    Collection,
                    Dict,
                    Iterator,
                    List,
                    Optional)

# Namespace prefixes stripped from a fully-qualified name, longest first.
_NAME_PREFIXES = ('couchbase::core::operations::', 'couchbase::core::', 'couchbase::')

# len('_request_with_legacy_durability'), the suffix dropped to recover the response name.
LEGACY_DURABILITY_SUFFIX_LEN = 31

# C++ types with a direct TypeScript spelling.
_TS_SCALAR_MAP = {
    'std::string': 'string',
    'std::chrono::milliseconds': 'CppMilliseconds',
    'std::chrono::microseconds': 'CppMilliseconds',
    'std::chrono::nanoseconds': 'CppMilliseconds',
    'std::chrono::seconds': 'CppMilliseconds',
    'std::error_code': 'CppError',
    'std::monostate': 'undefined',
    'std::size_t': 'number',
    'std::int8_t': 'number',
    'std::uint8_t': 'number',
    'std::byte': 'number',
    'std::int16_t': 'number',
    'std::uint16_t': 'number',
    'std::int32_t': 'number',
    'std::uint32_t': 'number',
    'std::int64_t': 'number',
    'std::uint64_t': 'number',
    'std::bool': 'boolean',
    'std::float': 'number',
    'std::double': 'number',
    'couchbase::core::impl::subdoc::opcode': 'number',
}

# Types the parser spells with a `std::` prefix that C++ does not.
_CPP_BARE_TYPES = {
    'std::bool': 'bool',
    'std::int': 'int',
    'std::double': 'double',
    'std::float': 'float',
}

# Single-parameter templates rendered as `name<of>`.
_CPP_SINGLE_PARAM_TEMPLATES = ('std::vector', 'std::optional', 'std::set')

WRAPPER_SPAN_TYPE = 'couchbase::core::tracing::wrapper_sdk_span'


def uppercase_first(name: str) -> str:
    return name[:1].upper() + name[1:]


def iter_variant_types(type_model: Optional[Dict[str, Any]]) -> Iterator[Dict[str, Any]]:
    """Every std::variant node inside a parsed field type, nested ones included.

    A variant reached through an optional, vector or map still marshals through the
    generic converter, so it counts the same as one declared directly on the field.
    """
    if not isinstance(type_model, dict):
        return
    if type_model.get('name') == 'std::variant':
        yield type_model

    of = type_model.get('of')
    if isinstance(of, list):
        for item in of:
            yield from iter_variant_types(item)
    elif of is not None:
        yield from iter_variant_types(of)

    yield from iter_variant_types(type_model.get('to'))


def field_is_ignored(struct_name: str,
                     field_name: str,
                     ignored_fields: Collection[str],
                     private_field_structs: Collection[str]) -> bool:
    """Whether a field is left unmarshalled.

    Shared with validators.py so that a check about what gets marshalled and the code doing
    the marshalling cannot disagree about which fields those are.
    """
    if field_name in ignored_fields:
        return True
    # A trailing underscore marks a private member, which JS has no business setting.
    return field_name.endswith('_') and struct_name not in private_field_structs


class BindingBuilder:
    """Derives the render contexts from one parsed type model."""

    def __init__(self, type_model: Dict[str, Any], config: Dict[str, Any]) -> None:
        self._type_model = type_model
        # Type lookups resolve against the *unfiltered* model: a struct excluded from
        # generation can still appear as the type of a field that is not.
        self._all_structs = type_model['op_structs']
        self._known_struct_names = {s['name'] for s in self._all_structs}
        self._enums = type_model['op_enums']

        self._custom_defined_types = list(config.get('custom_defined_types', []))
        self._other_observable_types = list(config.get('other_observable_types', []))
        self._ignored_fields = set(config.get('ignored_fields', []))
        self._private_field_structs = list(config.get('structs_with_allowed_private_fields', []))
        self._bigint_fields = dict(config.get('bigint_fields', {}))
        self._optional_ts_fields = dict(config.get('optional_ts_fields', {}))

        # (struct, field) -> {alternative: tag}.  Addressed as a pair, so a field name shared
        # with an unrelated struct cannot pull that struct into variant handling.  The tags are
        # cross-checked against the C++ alternatives in validators.py before anything renders.
        self._variant_tags = {
            (v['core_struct'], v['field']): {a['core_struct']: a['tag'] for a in v['alternatives']}
            for v in config.get('cpp_core_variants', [])
        }

        excluded = set(config.get('excluded_structs', []))
        structs = [s for s in self._all_structs if s['name'] not in excluded]

        # The operation list and the tracing sets are derived before the custom types are
        # dropped, so that filtering cannot change which operations exist.
        self._op_req_types: List[str] = []
        self._reqs_with_tracing: List[str] = []
        self._resps_with_tracing: List[str] = []
        for struct in structs:
            req_name = self.op_req_name(struct['name'])
            if req_name:
                self._op_req_types.append(req_name)
            field_names = {f['name'] for f in struct['fields']}
            if 'parent_span' in field_names:
                self._reqs_with_tracing.append(struct['name'])
            if 'cpp_core_span' in field_names:
                self._resps_with_tracing.append(struct['name'])

        # Hand-written and internal types are marshalled elsewhere.
        self._structs = [s for s in structs
                         if s['name'] not in self._custom_defined_types
                         and not s['name'].endswith('::internal')]

    # -- properties ---------------------------------------------------------

    @property
    def structs(self) -> List[Dict[str, Any]]:
        return self._structs

    @property
    def enums(self) -> List[Dict[str, Any]]:
        return self._enums

    @property
    def op_req_types(self) -> List[str]:
        return self._op_req_types

    @property
    def responses_with_tracing(self) -> List[str]:
        return self._resps_with_tracing

    # -- naming -------------------------------------------------------------

    @staticmethod
    def op_req_name(name: str) -> Optional[str]:
        """The operation name behind a request struct, or None if it is not one."""
        if name.endswith('_request'):
            return name[:-len('_request')]
        if name.endswith('_with_legacy_durability'):
            return name
        if name.endswith('>'):
            # Templated request: drop the first `_request`, keeping the template argument.
            return name.replace('_request', '', 1)
        return None

    @staticmethod
    def unprefixed_name(name: str) -> str:
        for prefix in _NAME_PREFIXES:
            if name.startswith(prefix):
                name = name[len(prefix):]
                break
        else:
            raise ValueError(f'unexpected struct name: {name}')

        if '<' in name:
            name_tokens = name.split('<')
            template_tokens = name_tokens[1].replace('>', '').split('::')
            template_name = uppercase_first(template_tokens[-1])
            # Keep `_request` as the suffix rather than leaving it stranded mid-name.
            if '_request' in name_tokens[0]:
                name = name_tokens[0].replace('_request', '', 1) + template_name + '_request'
            else:
                name = name_tokens[0] + template_name

        name = name.replace('::', '_')
        if '_with_legacy_durability' in name:
            name = name.replace('_request_', '_', 1)

        return name

    @classmethod
    def ts_nice_name(cls, name: str) -> str:
        """snake_case -> camelCase, with the namespace prefix dropped."""
        name = cls.unprefixed_name(name)
        for letter in string.ascii_lowercase:
            name = name.replace(f'_{letter}', letter.upper())
        return name

    @classmethod
    def struct_ts_name(cls, name: str) -> str:
        return 'Cpp' + uppercase_first(cls.ts_nice_name(name))

    # Enums and structs are named identically; both spellings exist for readability
    # at the call sites.
    enum_ts_name = struct_ts_name

    # -- types --------------------------------------------------------------

    def ts_type(self, type_model: Dict[str, Any]) -> str:
        name = type_model['name']

        # std::vector<std::byte> is a Buffer, not a number[].
        if name == 'std::vector' and type_model['of']['name'] == 'std::byte':
            return 'Buffer'

        if name in _TS_SCALAR_MAP:
            return _TS_SCALAR_MAP[name]

        if name == 'std::optional':
            return self.ts_type(type_model['of']) + ' | undefined'
        if name == 'std::variant':
            return ' | '.join(self.ts_type(v) for v in type_model['of'])
        if name in ('std::vector', 'std::array', 'std::set'):
            return self.ts_type(type_model['of']) + '[]'
        if name == 'std::map':
            key = self.ts_type(type_model['of'])
            value = self.ts_type(type_model['to'])
            return '{[key: string /*' + key + '*/]: ' + value + '}'
        if name == WRAPPER_SPAN_TYPE:
            return self.struct_ts_name(name)

        if any(s['name'] == name for s in self._all_structs):
            return self.struct_ts_name(name)
        if any(e['name'] == name for e in self._enums):
            return self.enum_ts_name(name)

        raise ValueError(f'unexpected type: {type_model}')

    def cpp_type(self, type_model: Dict[str, Any]) -> str:
        name = type_model['name']

        if name in _CPP_BARE_TYPES:
            return _CPP_BARE_TYPES[name]
        if name in _CPP_SINGLE_PARAM_TEMPLATES:
            return f"{name}<{self.cpp_type(type_model['of'])}>"
        if name == 'std::variant':
            return f"{name}<{', '.join(self.cpp_type(t) for t in type_model['of'])}>"
        if name == 'std::map':
            key = self.cpp_type(type_model['of'])
            value = self.cpp_type(type_model['to'])
            if 'comparator' in type_model:
                return f"{name}<{key}, {value}, {self.cpp_type(type_model['comparator'])}>"
            return f'{name}<{key}, {value}>'
        if name == 'std::array':
            return f"{name}<{self.cpp_type(type_model['of'])}, {type_model['size']}>"
        if name == 'template':
            return self.cpp_type(type_model['of'])

        if 'of' in type_model:
            raise ValueError(f'unexpected type: {type_model}')

        return name

    # -- field classification ----------------------------------------------

    def is_ignored_field(self, struct: Dict[str, Any], field_name: str) -> bool:
        return field_is_ignored(struct['name'], field_name,
                                self._ignored_fields, self._private_field_structs)

    def is_variant_field(self, struct: Dict[str, Any], field_name: str) -> bool:
        return (struct['name'], field_name) in self._variant_tags

    def is_untagged_variant(self, struct: Dict[str, Any], field: Dict[str, Any]) -> bool:
        """Whether a field holds a std::variant that has nothing to dispatch on.

        A variant of primitives and std::monostate has no alternative JS could name, so it
        marshals through the generic converter in jstocbpp_cpptypes.hpp by design.  Saying so
        at the call site keeps it distinguishable from a variant that merely has not been
        registered yet - which validators.py reports as a warning instead.
        """
        if self.is_variant_field(struct, field['name']):
            return False
        return any(not any(alt['name'] in self._known_struct_names
                           for alt in variant.get('of', []))
                   for variant in iter_variant_types(field.get('type')))

    def bigint_type(self, struct_name: str, field_name: str) -> Optional[str]:
        return self._bigint_fields.get(struct_name, {}).get(field_name)

    def request_has_tracing(self, op_name: str) -> bool:
        return any(self.op_req_name(r) == op_name for r in self._reqs_with_tracing)

    def struct_is_traced_request(self, struct_name: str) -> bool:
        return struct_name in self._reqs_with_tracing

    def struct_is_traced_response(self, struct_name: str) -> bool:
        return struct_name in self._resps_with_tracing

    def struct_takes_wrapper_span(self, struct_name: str) -> bool:
        """Whether `to_js` accepts a wrapper span for this struct."""
        return struct_name.endswith('response') or struct_name in self._other_observable_types

    # -- response naming ----------------------------------------------------

    def response_ts_name(self, op_name: str) -> str:
        """The response interface paired with an operation's request."""
        if op_name.endswith('_with_legacy_durability'):
            return self.struct_ts_name(op_name[:-LEGACY_DURABILITY_SUFFIX_LEN] + '_response')
        if op_name.endswith('>'):
            return self.struct_ts_name(op_name.split('<')[0] + '_response')
        return self.struct_ts_name(op_name + '_response')

    def request_cpp_name(self, op_name: str) -> str:
        """The fully-qualified C++ request type for an operation."""
        if op_name.endswith('_with_legacy_durability'):
            return op_name
        if op_name.endswith('>'):
            head, template_arg = op_name.split('<', 1)
            return f'{head}_request<{template_arg}'
        return f'{op_name}_request'

    # -- render contexts ----------------------------------------------------
    #
    # Each of these returns exactly what one template needs.  Field-level decisions are
    # reduced to a `kind` the template can switch on, so no template has to reason about
    # optionality, tracing or bigint marshalling.

    def build_binding_ts_context(self) -> Dict[str, Any]:
        interfaces = []
        for struct in self._structs:
            name = struct['name']
            # A legacy-durability struct is named as the request it stands in for.
            ts_name = (self.struct_ts_name(name + '_request')
                       if name.endswith('_with_legacy_durability')
                       else self.struct_ts_name(name))
            field_names = {f['name'] for f in struct['fields']}
            if 'parent_span' in field_names:
                base = 'CppObservableRequest'
            elif 'cpp_core_span' in field_names:
                base = 'CppObservableResponse'
            else:
                base = None
            interfaces.append({
                'ts_name': ts_name,
                'base': base,
                'fields': [f for f in (self._ts_field(struct, ts_name, field)
                                       for field in struct['fields']) if f],
            })

        connection_ops = [{
            'js_name': self.ts_nice_name(op),
            'request': self.struct_ts_name(op + '_request'),
            'response': self.response_ts_name(op),
        } for op in self._op_req_types]

        binding_enums = [{
            'prop_name': self.unprefixed_name(enum['name']),
            'ts_name': self.enum_ts_name(enum['name']),
            # Named `enum_values`, not `values`: Jinja resolves attributes before keys,
            # so `enum.values` in a template would find dict.values instead.
            'enum_values': [v['name'] for v in enum['values']],
        } for enum in self._enums]

        return {
            'enum_names': [self.enum_ts_name(e['name']) for e in self._enums],
            'interfaces': interfaces,
            'connection_ops': connection_ops,
            'binding_enums': binding_enums,
            'observable_requests': [self.struct_ts_name(op + '_request')
                                    for op in self._op_req_types
                                    if self.request_has_tracing(op)],
        }

    def _ts_field(self,
                  struct: Dict[str, Any],
                  ts_name: str,
                  field: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """One TypeScript interface member, or None when the field is not emitted."""
        name = field['name']
        # Supplied by the CppObservableResponse interface the struct extends.
        if name == 'cpp_core_span':
            return None
        if self.is_ignored_field(struct, name):
            return {'kind': 'comment', 'name': name}

        bigint = self.bigint_type(struct['name'], name)
        field_type = field['type']

        if field_type['name'] == 'std::optional':
            return {'kind': 'field', 'name': name, 'optional': True,
                    'ts_type': bigint or self.ts_type(field_type['of'])}
        if field_type['name'] == 'template':
            return {'kind': 'field', 'name': name, 'optional': False,
                    'ts_type': self.struct_ts_name(field_type['of']['name'])}

        ts_type = bigint or self.ts_type(field_type)
        if name in self._optional_ts_fields.get(struct['name'], []):
            return {'kind': 'field', 'name': name, 'optional': True, 'ts_type': ts_type}
        if self.is_variant_field(struct, name):
            return {'kind': 'variant', 'name': name, 'ts_type': ts_type}
        # A request accepts the looser CppCasInput; only a response hands back a CppCas.
        if ts_type == 'CppCas' and ts_name.endswith('Request'):
            return {'kind': 'field', 'name': name, 'optional': False, 'ts_type': 'CppCasInput'}
        return {'kind': 'field', 'name': name, 'optional': False, 'ts_type': ts_type}

    def build_connection_ops_context(self) -> Dict[str, Any]:
        """Shared by the method declaration, definition and registration templates."""
        ops = []
        for op in self._op_req_types:
            base_name = self.ts_nice_name(op)
            ops.append({
                'base_name': base_name,
                'js_name': 'js' + uppercase_first(base_name),
                'request_cpp_name': self.request_cpp_name(op),
                'has_tracing': self.request_has_tracing(op),
            })
        return {'ops': ops, 'wrapper_span_type': WRAPPER_SPAN_TYPE}

    def build_constants_context(self) -> Dict[str, Any]:
        return {'enums': [{
            'prop_name': self.unprefixed_name(enum['name']),
            'cpp_name': enum['name'],
            # Named `enum_values`, not `values`: Jinja resolves attributes before keys,
            # so `enum.values` in a template would find dict.values instead.
            'enum_values': [v['name'] for v in enum['values']],
        } for enum in self._enums]}

    def build_marshalling_context(self) -> Dict[str, Any]:
        structs = []
        for struct in self._structs:
            name = struct['name']
            variant_fields = [f for f in struct['fields']
                              if self.is_variant_field(struct, f['name'])]
            structs.append({
                'cpp_name': name,
                'has_tracing': self.struct_is_traced_request(name),
                'takes_wrapper_span': self.struct_takes_wrapper_span(name),
                'from_js_variants': [self._from_js_variant(struct, f) for f in variant_fields],
                'to_js_variants': [self._to_js_variant(struct, f) for f in variant_fields],
                'from_js_statements': [self._from_js_statement(struct, f)
                                       for f in struct['fields']],
                'to_js_statements': [self._to_js_statement(struct, f)
                                     for f in struct['fields']],
            })
        return {'structs': structs, 'wrapper_span_type': WRAPPER_SPAN_TYPE}

    def _variant_branches(self,
                          struct: Dict[str, Any],
                          field: Dict[str, Any]) -> List[Dict[str, Any]]:
        """The if / else-if / else chain discriminating one variant field.

        The alternatives and their order come from the C++ core, so the chain follows the
        declaration; the config only supplies the tag each one is known by on the JS side.

        A variant including std::monostate gets no trailing `else`: the monostate
        alternative is filtered out of the chain, so the last emitted index never reaches
        the end of the declared alternatives and every branch stays an explicit test.
        """
        alternatives = field['type']['of']
        tags = self._variant_tags[(struct['name'], field['name'])]
        emitted = [t for t in alternatives if 'monostate' not in t['name']]
        branches = []
        for index, alternative in enumerate(emitted):
            branches.append({
                'is_else': index == len(alternatives) - 1,
                'keyword': 'else if(' if index > 0 else 'if(',
                'cpp_name': alternative['name'],
                'tag': tags[alternative['name']],
            })
        return branches

    def _from_js_variant(self, struct: Dict[str, Any], field: Dict[str, Any]) -> Dict[str, Any]:
        alternatives = field['type']['of']
        emitted = [t for t in alternatives if 'monostate' not in t['name']]
        has_monostate = any('monostate' in t['name'] for t in alternatives)
        declared = (('std::monostate,' if has_monostate else '')
                    + ', '.join(self.cpp_type(t) for t in emitted))
        return {
            'name': field['name'],
            'declared_type': f'std::variant<{declared}>',
            'branches': self._variant_branches(struct, field),
        }

    def _to_js_variant(self, struct: Dict[str, Any], field: Dict[str, Any]) -> Dict[str, Any]:
        return {'name': field['name'], 'branches': self._variant_branches(struct, field)}

    def _from_js_statement(self, struct: Dict[str, Any], field: Dict[str, Any]) -> Dict[str, Any]:
        name = field['name']
        # The span is built by the caller, so it is assigned rather than unmarshalled.
        if self.struct_is_traced_request(struct['name']) and name == 'parent_span':
            return {'kind': 'wrapper_span', 'name': name}
        if self.is_ignored_field(struct, name):
            return {'kind': 'comment', 'name': name}
        if self.is_variant_field(struct, name):
            return {'kind': 'variant_assign', 'name': name}
        if self.bigint_type(struct['name'], name):
            kind = 'u64_optional' if field['type']['name'] == 'std::optional' else 'u64'
            return {'kind': kind, 'name': name}
        return {'kind': 'convert', 'name': name, 'cpp_type': self.cpp_type(field['type']),
                'untagged_variant': self.is_untagged_variant(struct, field)}

    def _to_js_statement(self, struct: Dict[str, Any], field: Dict[str, Any]) -> Dict[str, Any]:
        name = field['name']
        if name == 'cpp_core_span' and self.struct_is_traced_response(struct['name']):
            return {'kind': 'span', 'name': name}
        if self.is_ignored_field(struct, name):
            return {'kind': 'comment', 'name': name}

        key = f'{name}_value' if self.is_variant_field(struct, name) else name
        # Exact uint64 response values (e.g. counter content) marshal to bigint.  Optional
        # uint64 inputs fall through to the generic path: their to_js is unused (requests
        # only marshal JS -> C++) and cbpp_to_js_u64 takes a plain uint64, not an optional.
        if self.bigint_type(struct['name'], name) and field['type']['name'] != 'std::optional':
            return {'kind': 'u64', 'key': key, 'name': name}
        return {'kind': 'set', 'key': key, 'name': name,
                'cpp_type': self.cpp_type(field['type']),
                'untagged_variant': self.is_untagged_variant(struct, field)}
