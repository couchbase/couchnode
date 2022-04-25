import os
import json
import re
import subprocess
from unittest import TestCase
import clang.cindex

# configurable part

llvmLibPath = "/usr/local/Cellar/llvm/13.0.1_1/lib/"

cxxClientRoot = "../deps/couchbase-cxx-client"

fileList = [
    "couchbase/management/analytics_dataset.hxx",
    "couchbase/management/analytics_index.hxx",
    "couchbase/management/analytics_link_azure_blob_external.hxx",
    "couchbase/management/analytics_link_couchbase_remote.hxx",
    "couchbase/management/analytics_link_s3_external.hxx",
    "couchbase/management/bucket_settings.hxx",
    "couchbase/management/design_document.hxx",
    "couchbase/management/eventing_function.hxx",
    "couchbase/management/eventing_status.hxx",
    "couchbase/management/rbac.hxx",
    "couchbase/management/search_index.hxx",
    "couchbase/management/query_index.hxx",
    "couchbase/io/retry_reason.hxx",
    "couchbase/topology/collections_manifest.hxx",
    "couchbase/protocol/client_opcode.hxx",
    "couchbase/protocol/cmd_lookup_in.hxx",
    "couchbase/protocol/cmd_mutate_in.hxx",
    "couchbase/protocol/durability_level.hxx",
    "couchbase/protocol/status.hxx",
    "couchbase/cas.hxx",
    "couchbase/errors.hxx",
    "couchbase/analytics_scan_consistency.hxx",
    "couchbase/design_document_namespace.hxx",
    "couchbase/diagnostics.hxx",
    "couchbase/document_id.hxx",
    "couchbase/json_string.hxx",
    "couchbase/mutation_token.hxx",
    "couchbase/query_profile_mode.hxx",
    "couchbase/query_scan_consistency.hxx",
    "couchbase/search_highlight_style.hxx",
    "couchbase/search_scan_consistency.hxx",
    "couchbase/service_type.hxx",
    "couchbase/view_scan_consistency.hxx",
    "couchbase/view_sort_order.hxx",
    "couchbase/operations/*",
    "couchbase/operations/management/*",
]

typeList = [
    "couchbase::management::analytics::dataset",
    "couchbase::management::analytics::index",
    "couchbase::management::analytics::azure_blob_external_link",
    "couchbase::management::analytics::couchbase_link_encryption_level",
    "couchbase::management::analytics::couchbase_link_encryption_settings",
    "couchbase::management::analytics::couchbase_remote_link",
    "couchbase::management::analytics::s3_external_link",
    "couchbase::management::cluster::bucket_settings",
    "couchbase::management::cluster::bucket_type",
    "couchbase::management::cluster::bucket_compression",
    "couchbase::management::cluster::bucket_eviction_policy",
    "couchbase::management::cluster::bucket_conflict_resolution",
    "couchbase::management::cluster::bucket_storage_backend",
    "couchbase::management::views::design_document",
    "couchbase::management::eventing::function",
    "couchbase::management::eventing::status",
    "couchbase::management::rbac::role",
    "couchbase::management::rbac::role_and_description",
    "couchbase::management::rbac::origin",
    "couchbase::management::rbac::role_and_origins",
    "couchbase::management::rbac::user",
    "couchbase::management::rbac::auth_domain",
    "couchbase::management::rbac::user_and_metadata",
    "couchbase::management::rbac::group",
    "couchbase::management::search::index",
    "couchbase::management::query::index",
    "couchbase::io::retry_reason",
    "couchbase::topology::collections_manifest",
    "couchbase::protocol::status",
    "couchbase::protocol::subdoc_opcode",
    "couchbase::protocol::lookup_in_request_body::lookup_in_specs",
    "couchbase::protocol::mutate_in_request_body::mutate_in_specs",
    "couchbase::protocol::mutate_in_request_body::store_semantics_type",
    "couchbase::protocol::durability_level",
    "couchbase::error::common_errc",
    "couchbase::error::key_value_errc",
    "couchbase::error::query_errc",
    "couchbase::error::analytics_errc",
    "couchbase::error::search_errc",
    "couchbase::error::view_errc",
    "couchbase::error::management_errc",
    "couchbase::error::field_level_encryption_errc",
    "couchbase::error::network_errc",
    "couchbase::analytics_scan_consistency",
    "couchbase::cas",
    "couchbase::design_document_namespace",
    "couchbase::diag::cluster_state",
    "couchbase::diag::endpoint_state",
    "couchbase::diag::endpoint_diag_info",
    "couchbase::diag::diagnostics_result",
    "couchbase::diag::ping_state",
    "couchbase::diag::endpoint_ping_info",
    "couchbase::diag::ping_result",
    "couchbase::document_id",
    "couchbase::json_string",
    "couchbase::mutation_token",
    "couchbase::query_profile_mode",
    "couchbase::query_scan_consistency",
    "couchbase::search_highlight_style",
    "couchbase::search_scan_consistency",
    "couchbase::service_type",
    "couchbase::view_scan_consistency",
    "couchbase::view_sort_order",
    "couchbase::operations::*",
    "couchbase::operations::management::*",
]

# end of configurable part

clang.cindex.Config.set_library_path(llvmLibPath)


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
        files = list_headers_in_dir(os.path.join(cxxClientRoot, basePath))
        fullFileList = fullFileList + files
    else:
        # normal path
        fullFileList.append(os.path.join(cxxClientRoot, filePath))

# exclude _json.hxx files
fullFileList = list(
    filter(lambda x: not x.endswith('_json.hxx'), fullFileList))
# exclude _fmt.hxx files
fullFileList = list(
    filter(lambda x: not x.endswith('_fmt.hxx'), fullFileList))


# generate a list of regexps from the type list (for handling wildcards)
typeListRe = list(map(lambda x: x.replace("*", "(.*)") + "(.*)", typeList))


def is_included_type(name):
    for x in typeListRe:
        if re.fullmatch(x, name):
            return True
    return False


opTypes = []
opEnums = []


def parse_type(type):
    typeStr = type.get_canonical().spelling
    return parse_type_str(typeStr)


def parse_type_str(typeStr):
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
            if len(variantParts) != 2:
                print("FAILED TO PARSE MAP TYPES: " + typeStr)
                return {"name": "unknown", "str": typeStr}
            return {
                "name": "std::map",
                "of": parse_type_str(variantParts[0]),
                "to": parse_type_str(variantParts[1])
            }

    if not typeStr.startswith("couchbase::"):
        print("FAILED TO PARSE STRING TYPE: " + typeStr)
        return {"name": "unknown", "str": typeStr}

    return {"name": typeStr}


def traverse(node, namespace, main_file):
    # only scan the elements of the file we parsed
    if node.location.file != None and node.location.file.name != main_file:
        return

    if node.kind == clang.cindex.CursorKind.STRUCT_DECL:
        fullStructName = "::".join([*namespace, node.displayname])
        if is_included_type(fullStructName):
            structFields = []

            for child in node.get_children():
                if child.kind == clang.cindex.CursorKind.FIELD_DECL:
                    structFields.append({
                        "name": child.displayname,
                        "type": parse_type(child.type),
                    })

            opTypes.append({
                "name": fullStructName,
                "fields": structFields,
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


for headerPath in fullFileList:
    print("processing " + headerPath)
    index = clang.cindex.Index.create()
    args = [
        '-std=c++17',
        "-I" + cxxClientRoot + "/",
        "-I" + cxxClientRoot + "/third_party/fmt/include",
        "-I" + cxxClientRoot + "/third_party/gsl/include",
        "-I" + cxxClientRoot + "/third_party/json/include",
        "-I" + "/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/lib/clang/13.0.0/include"
    ]
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
