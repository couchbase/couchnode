import os
import json
import re
import clang.cindex

from functools import reduce

# configurable part

CLANG_VERSION='13.0.1'
#   homebrew installs for llvm (brew info llvm gives details):
#       x64: /usr/local/opt/llvm/lib
#       arm64: /opt/homebrew/opt/llvm/lib
llvmLibPath = "/usr/local/Cellar/llvm/13.0.1_1/lib/"

cxx_client_root = "../deps/couchbase-cxx-client"
cxx_client_cache = "../deps/couchbase-cxx-cache"
cxx_deps_include_paths = {
    'asio': ['-I{0}/asio/{1}/asio/asio/include'],
    'fmt': ['-I{0}/fmt/{1}/fmt/include'],
    'gsl': ['-I{0}/gsl/{1}/gsl/include'],
    'json': ['-I{0}/json/{1}/json/include',
             '-I{0}/json/{1}/json/external/PEGTL/include'
             ],
}

fileList = [
    "core/management/analytics_dataset.hxx",
    "core/management/analytics_index.hxx",
    "core/management/analytics_link_azure_blob_external.hxx",
    "core/management/analytics_link_couchbase_remote.hxx",
    "core/management/analytics_link_s3_external.hxx",
    "core/management/bucket_settings.hxx",
    "core/management/design_document.hxx",
    "core/management/eventing_function.hxx",
    "core/management/eventing_status.hxx",
    "core/management/rbac.hxx",
    "core/management/search_index.hxx",
    "couchbase/management/query_index.hxx",
    "couchbase/retry_reason.hxx",
    "core/topology/collections_manifest.hxx",
    "core/protocol/client_opcode.hxx",
    "core/protocol/cmd_lookup_in.hxx",
    "core/protocol/cmd_mutate_in.hxx",
    "core/protocol/status.hxx",
    "core/analytics_scan_consistency.hxx",
    "core/design_document_namespace.hxx",
    "core/diagnostics.hxx",
    "core/document_id.hxx",
    "core/json_string.hxx",
    "couchbase/query_profile.hxx",
    "couchbase/query_scan_consistency.hxx",
    "core/search_highlight_style.hxx",
    "core/search_scan_consistency.hxx",
    "core/service_type.hxx",
    "core/view_on_error.hxx",
    "core/view_scan_consistency.hxx",
    "core/view_sort_order.hxx",
    "core/operations/*",
    "core/operations/management/*",
    "couchbase/durability_level.hxx",
    "couchbase/cas.hxx",
    "couchbase/error_codes.hxx",
    "couchbase/mutation_token.hxx",
    "couchbase/key_value_status_code.hxx",
    "core/impl/subdoc/opcode.hxx",
    "core/impl/subdoc/command.hxx",
    "couchbase/store_semantics.hxx",
    "couchbase/persist_to.hxx",
    "couchbase/replicate_to.hxx",
    "core/range_scan_options.hxx",
    "core/range_scan_orchestrator_options.hxx",
    "core/query_context.hxx",
    "core/vector_query_combination.hxx",
]

typeList = [
    "couchbase::core::management::analytics::dataset",
    "couchbase::core::management::analytics::index",
    "couchbase::core::management::analytics::azure_blob_external_link",
    "couchbase::core::management::analytics::couchbase_link_encryption_level",
    "couchbase::core::management::analytics::couchbase_link_encryption_settings",
    "couchbase::core::management::analytics::couchbase_remote_link",
    "couchbase::core::management::analytics::s3_external_link",
    "couchbase::core::management::cluster::bucket_settings",
    "couchbase::core::management::cluster::bucket_type",
    "couchbase::core::management::cluster::bucket_compression",
    "couchbase::core::management::cluster::bucket_eviction_policy",
    "couchbase::core::management::cluster::bucket_conflict_resolution",
    "couchbase::core::management::cluster::bucket_storage_backend",
    "couchbase::core::management::views::design_document",
    "couchbase::core::management::eventing::function",
    "couchbase::core::management::eventing::status",
    "couchbase::core::management::rbac::role",
    "couchbase::core::management::rbac::role_and_description",
    "couchbase::core::management::rbac::origin",
    "couchbase::core::management::rbac::role_and_origins",
    "couchbase::core::management::rbac::user",
    "couchbase::core::management::rbac::auth_domain",
    "couchbase::core::management::rbac::user_and_metadata",
    "couchbase::core::management::rbac::group",
    "couchbase::core::management::search::index",
    "couchbase::management::query_index",
    "couchbase::retry_reason",
    "couchbase::core::topology::collections_manifest",
    "couchbase::core::protocol::status",
    "couchbase::core::protocol::subdoc_opcode",
    "couchbase::core::protocol::lookup_in_request_body::lookup_in_specs",
    "couchbase::core::protocol::mutate_in_request_body::mutate_in_specs",
    "couchbase::core::protocol::mutate_in_request_body::store_semantics_type",
    "couchbase::durability_level",
    "couchbase::errc::common",
    "couchbase::errc::key_value",
    "couchbase::errc::query",
    "couchbase::errc::analytics",
    "couchbase::errc::search",
    "couchbase::errc::view",
    "couchbase::errc::management",
    "couchbase::errc::field_level_encryption",
    "couchbase::errc::network",
    "couchbase::core::analytics_scan_consistency",
    "couchbase::cas",
    "couchbase::core::design_document_namespace",
    "couchbase::core::diag::cluster_state",
    "couchbase::core::diag::endpoint_state",
    "couchbase::core::diag::endpoint_diag_info",
    "couchbase::core::diag::diagnostics_result",
    "couchbase::core::diag::ping_state",
    "couchbase::core::diag::endpoint_ping_info",
    "couchbase::core::diag::ping_result",
    "couchbase::core::document_id",
    "couchbase::core::json_string",
    "couchbase::mutation_token",
    "couchbase::query_profile",
    "couchbase::query_scan_consistency",
    "couchbase::core::search_highlight_style",
    "couchbase::core::search_scan_consistency",
    "couchbase::core::service_type",
    "couchbase::core::view_on_error",
    "couchbase::core::view_scan_consistency",
    "couchbase::core::view_sort_order",
    "couchbase::core::operations::*",
    "couchbase::core::operations::management::*",
    "couchbase::core::tracing::request_span",
    "couchbase::key_value_status_code",
    "couchbase::core::impl::subdoc::command",
    "couchbase::core::impl::subdoc::opcode",
    "couchbase::store_semantics",
    "couchbase::persist_to",
    "couchbase::replicate_to",
    "couchbase::core::range_scan_create_options",
    "couchbase::core::range_scan_continue_options",
    "couchbase::core::range_scan_cancel_options",
    "couchbase::core::range_scan_orchestrator_options",
    "couchbase::core::mutation_state",
    "couchbase::core::scan_term",
    "couchbase::core::scan_sort",
    "couchbase::core::range_scan",
    "couchbase::core::prefix_scan",
    "couchbase::core::sampling_scan",
    "couchbase::core::range_snapshot_requirements",
    "couchbase::core::range_scan_item_body",
    "couchbase::core::range_scan_item",
    "couchbase::core::range_scan_create_result",
    "couchbase::core::range_scan_continue_result",
    "couchbase::core::range_scan_cancel_result",
    "couchbase::core::query_context",
    "couchbase::core::vector_query_combination",
]

# end of configurable part

clang.cindex.Config.set_library_path(llvmLibPath)

def set_cxx_deps_include_paths(dep, includes):
    cpm_path = os.path.join(cxx_client_cache, dep)
    dir_pattern = r'[0-9a-z]{40}'
    cpm_hash_dir = next((d for d in os.listdir(cpm_path)
                         if os.path.isdir(os.path.join(cpm_path, d)) and re.match(dir_pattern, d)),
                         None)
    if not cpm_hash_dir:
        raise Exception(f'Unable to find CPM hash directory for path: {cpm_path}.')
    return list(map(lambda p: p.format(cxx_client_cache, cpm_hash_dir), includes))

def list_headers_in_dir(path):
    # enumerates a folder but keeps the full pathing for the files returned
    # and removes certain files we don't want (like non-hxx, _json.hxx or _fmt.hxx)

    # list all the files in the folder
    files = os.listdir(path)
    # only include .hxx files
    files = list(filter(lambda x: x.endswith('.hxx'), files))
    # add the folder path back on
    files = list(map(lambda x: path + x, files))
    return files


# parse through the list of files specified and expand wildcards
fullFileList = []
for filePath in fileList:
    if "*" in filePath:
        # wildcard path
        basePath = filePath[:-1]
        if "*" in basePath:
            # if there is still a wildcard, we have an issue...
            raise NotImplementedError(
                "wildcard only supported at end of file path")
        files = list_headers_in_dir(os.path.join(cxx_client_root, basePath))
        fullFileList = fullFileList + files
    else:
        # normal path
        fullFileList.append(os.path.join(cxx_client_root, filePath))

# exclude _json.hxx files
fullFileList = list(
    filter(lambda x: not x.endswith('_json.hxx'), fullFileList))
# exclude _fmt.hxx files
fullFileList = list(
    filter(lambda x: not x.endswith('_fmt.hxx'), fullFileList))


# generate a list of regexps from the type list (for handling wildcards)
typeListRe = list(map(lambda x: x.replace("*", "(.*)") + "(.*)", typeList))


def is_included_type(name, with_durability=False):

    # TODO(brett19): This should be generalized somehow...
    if "is_compound_operation" in name:
        return False

    if "replica_context" in name:
        return False

    if with_durability is True and '_with_legacy_durability' not in name:
        return False

    for x in typeListRe:
        if re.fullmatch(x, name):
            return True
    return False


opTypes = []
opEnums = []


def parse_type(type):
    typeStr = type.get_canonical().spelling
    return parse_type_str(typeStr)

std_comparator_templates = ["std::less<{0}>", "std::greater<{0}>", "std::less_equal<{0}>", "std::greater_equal<{0}>"]
# flatten the list of lists
std_comparators = list(reduce(lambda a, b: a + b,
                              list(map(lambda c: [c.format(s) for s in ['', 'void']], std_comparator_templates)),
                              []))

def parse_type_str(typeStr):
    if typeStr == "std::mutex":
        return {"name": "std::mutex"}
    if typeStr == "std::string":
        return {"name": "std::string"}
    if typeStr == "std::chrono::duration<long long>":
        return {"name": "std::chrono::seconds"}
    if typeStr == "std::chrono::duration<long long, std::ratio<1, 1000>>":
        return {"name": "std::chrono::milliseconds"}
    if typeStr == "std::chrono::duration<long long, std::ratio<1, 1000000>>":
        return {"name": "std::chrono::microseconds"}
    if typeStr == "std::chrono::duration<long long, std::ratio<1, 1000000000>>":
        return {"name": "std::chrono::nanoseconds"}
    if typeStr == "std::error_code":
        return {"name": "std::error_code"}
    if typeStr == "std::monostate":
        return {"name": "std::monostate"}
    if typeStr == "std::byte":
        return {"name": "std::byte"}
    if typeStr == "unsigned long":
        return {"name": "std::size_t"}
    if typeStr == "char":
        return {"name": "std::int8_t"}
    if typeStr == "unsigned char":
        return {"name": "std::uint8_t"}
    if typeStr == "short":
        return {"name": "std::int16_t"}
    if typeStr == "unsigned short":
        return {"name": "std::uint16_t"}
    if typeStr == "int":
        return {"name": "std::int32_t"}
    if typeStr == "unsigned int":
        return {"name": "std::uint32_t"}
    if typeStr == "long long":
        return {"name": "std::int64_t"}
    if typeStr == "unsigned long long":
        return {"name": "std::uint64_t"}
    if typeStr == "bool":
        return {"name": "std::bool"}
    if typeStr == "float":
        return {"name": "std::float"}
    if typeStr == "double":
        return {"name": "std::double"}
    if typeStr == "std::nullptr_t":
        return {"name": "std::nullptr_t"}
    if typeStr in std_comparators:
        if 'void' in typeStr:
            return {"name": typeStr.replace("void", "")}
        return {"name": typeStr}

    tplParts = typeStr.split("<", 1)
    if len(tplParts) > 1:
        tplClassName = tplParts[0]
        tplParams = tplParts[1][:-1]
        if tplClassName == "std::function":
            return {
                "name": "std::function"
            }
        if tplClassName == "std::optional":
            return {
                "name": "std::optional",
                "of": parse_type_str(tplParams)
            }
        if tplClassName == "std::vector":
            return {
                "name": "std::vector",
                "of": parse_type_str(tplParams)
            }
        if tplClassName == "std::set":
            return {
                "name": "std::set",
                "of": parse_type_str(tplParams)
            }
        if tplClassName == "std::variant":
            variantParts = tplParams.split(", ")
            variantTypes = []
            for variantPart in variantParts:
                variantTypes.append(parse_type_str(variantPart))
            return {
                "name": "std::variant",
                "of": variantTypes
            }
        if tplClassName == "std::array":
            variantParts = tplParams.split(", ")
            if len(variantParts) != 2:
                print("FAILED TO PARSE ARRAY TYPES: " + typeStr)
                return {"name": "unknown", "str": typeStr}
            return {
                "name": "std::array",
                "of": parse_type_str(variantParts[0]),
                "size": int(variantParts[1])
            }
        if tplClassName == "std::map":
            variantParts = tplParams.split(", ")
            if len(variantParts) < 2 or len(variantParts) > 3:
                print("FAILED TO PARSE MAP TYPES: " + typeStr)
                return {"name": "unknown", "str": typeStr}

            if len(variantParts) == 2:
                return {
                    "name": "std::map",
                    "of": parse_type_str(variantParts[0]),
                    "to": parse_type_str(variantParts[1])
                }
            else:
                return {
                    "name": "std::map",
                    "of": parse_type_str(variantParts[0]),
                    "to": parse_type_str(variantParts[1]),
                    "comparator": parse_type_str(variantParts[2])
                }

        if tplClassName == "std::shared_ptr":
            return {
                "name": "std::shared_ptr",
                "of": parse_type_str(tplParams)
            }

    if not typeStr.startswith("couchbase::"):
        print("FAILED TO PARSE STRING TYPE: " + typeStr)
        return {"name": "unknown", "str": typeStr}

    if 'unnamed struct' in typeStr:
        print("WARNING:  Found unnamed struct: " + typeStr)

    return {"name": typeStr}

internal_structs = []
UNNAMED_STRUCT_DELIM = '::(unnamed struct'

def traverse(node, namespace, main_file):
    # only scan the elements of the file we parsed
    if node.location.file != None and node.location.file.name != main_file:
        return

    if node.kind == clang.cindex.CursorKind.STRUCT_DECL or node.kind == clang.cindex.CursorKind.CLASS_DECL:
        fullStructName = "::".join([*namespace, node.displayname])
        if fullStructName.endswith('::') or UNNAMED_STRUCT_DELIM in fullStructName:
            struct_name = fullStructName if fullStructName.endswith('::') else fullStructName.split(UNNAMED_STRUCT_DELIM)[0]
            match = next((s for s in internal_structs if struct_name in s), None)
            if match:
                fullStructName = match

        if is_included_type(fullStructName) or fullStructName in internal_structs:
            structFields = []
            for child in node.get_children():
                if child.kind == clang.cindex.CursorKind.FIELD_DECL:
                    struct_type = parse_type(child.type)
                    type_str = child.type.get_canonical().spelling
                    if 'unnamed' in type_str:
                        name_tokens = type_str.split('::')
                        name_override = '::'.join(name_tokens[:-1] + [child.displayname])
                        struct_type['name'] = name_override
                        internal_structs.append(name_override)

                    structFields.append({
                        "name": child.displayname,
                        "type": struct_type,
                    })
            # replica read changes introduced duplicate get requests
            if any(map(lambda op: op['name'] == fullStructName, opTypes)):
                return

            opTypes.append({
                "name": fullStructName,
                "fields": structFields,
            })
    if node.kind == clang.cindex.CursorKind.TYPE_ALIAS_DECL:
        fullStructName = "::".join([*namespace, node.displayname])
        if is_included_type(fullStructName, with_durability=True):
            type_ref = next((c for c in node.get_children() if c.kind == clang.cindex.CursorKind.TYPE_REF), None)
            if type_ref:
                base_request_name = type_ref.displayname.replace('struct', '').strip()
                base_request = next((op for op in opTypes if op['name'] == base_request_name), None)
                if base_request:
                    new_fields = [f for f in base_request['fields'] if f['name'] != 'durability_level']
                    new_fields.extend([
                            {"name":"persist_to", "type":{"name":"couchbase::persist_to"}},
                            {"name":"replicate_to", "type":{"name":"couchbase::replicate_to"}}
                        ])

                    opTypes.append({
                        "name": fullStructName,
                        "fields": new_fields
                    })
    if node.kind == clang.cindex.CursorKind.ENUM_DECL:
        fullEnumName = "::".join([*namespace, node.displayname])
        if is_included_type(fullEnumName):
            enumValues = []

            for child in node.get_children():
                if child.kind == clang.cindex.CursorKind.ENUM_CONSTANT_DECL:
                    enumValues.append({
                        "name": child.displayname,
                        "value": child.enum_value,
                    })
            opEnums.append({
                "name": fullEnumName,
                "type": parse_type(node.enum_type),
                "values": enumValues,
            })

    if node.kind == clang.cindex.CursorKind.NAMESPACE:
        namespace = [*namespace, node.displayname]
    if node.kind == clang.cindex.CursorKind.CLASS_DECL:
        namespace = [*namespace, node.displayname]
    if node.kind == clang.cindex.CursorKind.STRUCT_DECL:
        namespace = [*namespace, node.displayname]

    for child in node.get_children():
        traverse(child, namespace, main_file)

include_paths = [
    f'-I{cxx_client_root}/',
    f'-I/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/lib/clang/{CLANG_VERSION}/include',
]
for dep, inc in cxx_deps_include_paths.items():
    include_paths.extend(set_cxx_deps_include_paths(dep, inc))

for headerPath in fullFileList:
    print("processing " + headerPath)
    index = clang.cindex.Index.create()
    args = ['-std=c++17'] + include_paths
    translation_unit = index.parse(headerPath, args=args)

    # output clang compiler diagnostics information (for debugging)
    if 1:
        for diagnostic in translation_unit.diagnostics:
            diagnosticMsg = diagnostic.format()
            print(diagnostic)

    traverse(translation_unit.cursor, [], headerPath)

jsonData = json.dumps({
    'op_structs': opTypes,
    'op_enums': opEnums
})

f = open("bindings.json", "w")
f.write(jsonData)
f.close()
