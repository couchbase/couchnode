#include "constants.hpp"
#include "jstocbpp.hpp"
#include <couchbase/cluster.hxx>
#include <couchbase/errors.hxx>
#include <set>
#include <vector>

namespace couchnode
{

template <typename T>
static inline Napi::Object
cbppEnumToJs(Napi::Env env,
             const std::vector<std::pair<std::string, T>> &values)
{
    auto jsVals = Napi::Object::New(env);
    auto dedupValues = std::set<T>();
    for (const auto &value : values) {
        auto dedupRes = dedupValues.emplace(value.second);
        if (!dedupRes.second) {
            throw Napi::Error::New(env,
                                   "duplicate constants during initialization");
        }

        jsVals.Set(value.first,
                   Napi::Number::New(env, static_cast<int64_t>(value.second)));
    }
    return jsVals;
}

void Constants::Init(Napi::Env env, Napi::Object exports)
{
    exports.Set(
        "service_type",
        cbppEnumToJs<couchbase::service_type>(
            env, {
                     {"key_value", couchbase::service_type::key_value},
                     {"query", couchbase::service_type::query},
                     {"analytics", couchbase::service_type::analytics},
                     {"search", couchbase::service_type::search},
                     {"view", couchbase::service_type::view},
                     {"management", couchbase::service_type::management},
                     {"eventing", couchbase::service_type::eventing},
                 }));

    exports.Set(
        "endpoint_state",
        cbppEnumToJs<couchbase::diag::endpoint_state>(
            env,
            {
                {"disconnected", couchbase::diag::endpoint_state::disconnected},
                {"connecting", couchbase::diag::endpoint_state::connecting},
                {"connected", couchbase::diag::endpoint_state::connected},
                {"disconnecting",
                 couchbase::diag::endpoint_state::disconnecting},
            }));

    exports.Set("ping_state",
                cbppEnumToJs<couchbase::diag::ping_state>(
                    env, {
                             {"ok", couchbase::diag::ping_state::ok},
                             {"timeout", couchbase::diag::ping_state::timeout},
                             {"error", couchbase::diag::ping_state::error},
                         }));

    exports.Set(
        "durability_level",
        cbppEnumToJs<couchbase::protocol::durability_level>(
            env,
            {
                {"none", couchbase::protocol::durability_level::none},
                {"majority", couchbase::protocol::durability_level::majority},
                {"majority_and_persist_to_active",
                 couchbase::protocol::durability_level::
                     majority_and_persist_to_active},
                {"persist_to_majority",
                 couchbase::protocol::durability_level::persist_to_majority},
            }));

    exports.Set(
        "subdoc_store_semantics_type",
        cbppEnumToJs<
            couchbase::protocol::mutate_in_request_body::store_semantics_type>(
            env, {
                     {"replace", couchbase::protocol::mutate_in_request_body::
                                     store_semantics_type::replace},
                     {"upsert", couchbase::protocol::mutate_in_request_body::
                                    store_semantics_type::upsert},
                     {"insert", couchbase::protocol::mutate_in_request_body::
                                    store_semantics_type::insert},
                 }));

    exports.Set(
        "subdoc_opcode",
        cbppEnumToJs<couchbase::protocol::subdoc_opcode>(
            env,
            {
                {"get_doc", couchbase::protocol::subdoc_opcode::get_doc},
                {"set_doc", couchbase::protocol::subdoc_opcode::set_doc},
                {"remove_doc", couchbase::protocol::subdoc_opcode::remove_doc},
                {"get", couchbase::protocol::subdoc_opcode::get},
                {"exists", couchbase::protocol::subdoc_opcode::exists},
                {"dict_add", couchbase::protocol::subdoc_opcode::dict_add},
                {"dict_upsert",
                 couchbase::protocol::subdoc_opcode::dict_upsert},
                {"remove", couchbase::protocol::subdoc_opcode::remove},
                {"replace", couchbase::protocol::subdoc_opcode::replace},
                {"array_push_last",
                 couchbase::protocol::subdoc_opcode::array_push_last},
                {"array_push_first",
                 couchbase::protocol::subdoc_opcode::array_push_first},
                {"array_insert",
                 couchbase::protocol::subdoc_opcode::array_insert},
                {"array_add_unique",
                 couchbase::protocol::subdoc_opcode::array_add_unique},
                {"counter", couchbase::protocol::subdoc_opcode::counter},
                {"get_count", couchbase::protocol::subdoc_opcode::get_count},
                {"replace_body_with_xattr",
                 couchbase::protocol::subdoc_opcode::replace_body_with_xattr},
            }));

    exports.Set(
        "lookup_in_path_flag",
        cbppEnumToJs<uint8_t>(
            env, {
                     {"xattr", couchbase::protocol::lookup_in_request_body::
                                   lookup_in_specs::path_flag_xattr},

                 }));

    exports.Set(
        "mutate_in_path_flag",
        cbppEnumToJs<uint8_t>(
            env,
            {
                {"create_parents",
                 couchbase::protocol::mutate_in_request_body::mutate_in_specs::
                     path_flag_create_parents},
                {"xattr", couchbase::protocol::mutate_in_request_body::
                              mutate_in_specs::path_flag_xattr},
                {"expand_macros", couchbase::protocol::mutate_in_request_body::
                                      mutate_in_specs::path_flag_expand_macros},
            }));

    exports.Set(
        "view_name_space",
        cbppEnumToJs<couchbase::operations::design_document::name_space>(
            env, {
                     {"development", couchbase::operations::design_document::
                                         name_space::development},
                     {"production", couchbase::operations::design_document::
                                        name_space::production},
                 }));

    exports.Set(
        "view_scan_consistency",
        cbppEnumToJs<
            couchbase::operations::document_view_request::scan_consistency>(
            env,
            {
                {"not_bounded", couchbase::operations::document_view_request::
                                    scan_consistency::not_bounded},
                {"update_after", couchbase::operations::document_view_request::
                                     scan_consistency::update_after},
                {"request_plus", couchbase::operations::document_view_request::
                                     scan_consistency::request_plus},
            }));

    exports.Set(
        "view_sort_order",
        cbppEnumToJs<couchbase::operations::document_view_request::sort_order>(
            env,
            {
                {"ascending", couchbase::operations::document_view_request::
                                  sort_order::ascending},
                {"descending", couchbase::operations::document_view_request::
                                   sort_order::descending},
            }));

    exports.Set(
        "query_scan_consistency",
        cbppEnumToJs<
            couchbase::operations::query_request::scan_consistency_type>(
            env, {
                     {"not_bounded", couchbase::operations::query_request::
                                         scan_consistency_type::not_bounded},
                     {"request_plus", couchbase::operations::query_request::
                                          scan_consistency_type::request_plus},
                 }));

    exports.Set(
        "query_profile_mode",
        cbppEnumToJs<couchbase::operations::query_request::profile_mode>(
            env,
            {
                {"off",
                 couchbase::operations::query_request::profile_mode::off},
                {"phases",
                 couchbase::operations::query_request::profile_mode::phases},
                {"timings",
                 couchbase::operations::query_request::profile_mode::timings},
            }));

    exports.Set(
        "analytics_scan_consistency",
        cbppEnumToJs<
            couchbase::operations::analytics_request::scan_consistency_type>(
            env, {
                     {"not_bounded", couchbase::operations::analytics_request::
                                         scan_consistency_type::not_bounded},
                     {"request_plus", couchbase::operations::analytics_request::
                                          scan_consistency_type::request_plus},
                 }));

    exports.Set(
        "search_scan_consistency",
        cbppEnumToJs<
            couchbase::operations::search_request::scan_consistency_type>(
            env, {
                     {"not_bounded", couchbase::operations::search_request::
                                         scan_consistency_type::not_bounded},
                 }));

    exports.Set(
        "search_highlight_style",
        cbppEnumToJs<
            couchbase::operations::search_request::highlight_style_type>(
            env, {
                     {"html", couchbase::operations::search_request::
                                  highlight_style_type::html},
                     {"ansi", couchbase::operations::search_request::
                                  highlight_style_type::ansi},
                 }));

    exports.Set(
        "common_errc",
        cbppEnumToJs<couchbase::error::common_errc>(
            env,
            {
                {"request_canceled",
                 couchbase::error::common_errc::request_canceled},
                {"invalid_argument",
                 couchbase::error::common_errc::invalid_argument},
                {"service_not_available",
                 couchbase::error::common_errc::service_not_available},
                {"internal_server_failure",
                 couchbase::error::common_errc::internal_server_failure},
                {"authentication_failure",
                 couchbase::error::common_errc::authentication_failure},
                {"temporary_failure",
                 couchbase::error::common_errc::temporary_failure},
                {"parsing_failure",
                 couchbase::error::common_errc::parsing_failure},
                {"cas_mismatch", couchbase::error::common_errc::cas_mismatch},
                {"bucket_not_found",
                 couchbase::error::common_errc::bucket_not_found},
                {"collection_not_found",
                 couchbase::error::common_errc::collection_not_found},
                {"unsupported_operation",
                 couchbase::error::common_errc::unsupported_operation},
                {"ambiguous_timeout",
                 couchbase::error::common_errc::ambiguous_timeout},
                {"unambiguous_timeout",
                 couchbase::error::common_errc::unambiguous_timeout},
                {"feature_not_available",
                 couchbase::error::common_errc::feature_not_available},
                {"scope_not_found",
                 couchbase::error::common_errc::scope_not_found},
                {"index_not_found",
                 couchbase::error::common_errc::index_not_found},
                {"index_exists", couchbase::error::common_errc::index_exists},
                {"decoding_failure",
                 couchbase::error::common_errc::decoding_failure},
                {"rate_limited", couchbase::error::common_errc::rate_limited},
                {"quota_limited", couchbase::error::common_errc::quota_limited},
            }));

    exports.Set(
        "key_value_errc",
        cbppEnumToJs<couchbase::error::key_value_errc>(
            env,
            {
                {"document_not_found",
                 couchbase::error::key_value_errc::document_not_found},
                {"document_irretrievable",
                 couchbase::error::key_value_errc::document_irretrievable},
                {"document_locked",
                 couchbase::error::key_value_errc::document_locked},
                {"value_too_large",
                 couchbase::error::key_value_errc::value_too_large},
                {"document_exists",
                 couchbase::error::key_value_errc::document_exists},
                {"durability_level_not_available",
                 couchbase::error::key_value_errc::
                     durability_level_not_available},
                {"durability_impossible",
                 couchbase::error::key_value_errc::durability_impossible},
                {"durability_ambiguous",
                 couchbase::error::key_value_errc::durability_ambiguous},
                {"durable_write_in_progress",
                 couchbase::error::key_value_errc::durable_write_in_progress},
                {"durable_write_re_commit_in_progress",
                 couchbase::error::key_value_errc::
                     durable_write_re_commit_in_progress},
                {"path_not_found",
                 couchbase::error::key_value_errc::path_not_found},
                {"path_mismatch",
                 couchbase::error::key_value_errc::path_mismatch},
                {"path_invalid",
                 couchbase::error::key_value_errc::path_invalid},
                {"path_too_big",
                 couchbase::error::key_value_errc::path_too_big},
                {"path_too_deep",
                 couchbase::error::key_value_errc::path_too_deep},
                {"value_too_deep",
                 couchbase::error::key_value_errc::value_too_deep},
                {"value_invalid",
                 couchbase::error::key_value_errc::value_invalid},
                {"document_not_json",
                 couchbase::error::key_value_errc::document_not_json},
                {"number_too_big",
                 couchbase::error::key_value_errc::number_too_big},
                {"delta_invalid",
                 couchbase::error::key_value_errc::delta_invalid},
                {"path_exists", couchbase::error::key_value_errc::path_exists},
                {"xattr_unknown_macro",
                 couchbase::error::key_value_errc::xattr_unknown_macro},
                {"xattr_invalid_key_combo",
                 couchbase::error::key_value_errc::xattr_invalid_key_combo},
                {"xattr_unknown_virtual_attribute",
                 couchbase::error::key_value_errc::
                     xattr_unknown_virtual_attribute},
                {"xattr_cannot_modify_virtual_attribute",
                 couchbase::error::key_value_errc::
                     xattr_cannot_modify_virtual_attribute},
                {"xattr_no_access",
                 couchbase::error::key_value_errc::xattr_no_access},
                {"cannot_revive_living_document",
                 couchbase::error::key_value_errc::
                     cannot_revive_living_document},
            }));

    exports.Set(
        "query_errc",
        cbppEnumToJs<couchbase::error::query_errc>(
            env,
            {
                {"planning_failure",
                 couchbase::error::query_errc::planning_failure},
                {"index_failure", couchbase::error::query_errc::index_failure},
                {"prepared_statement_failure",
                 couchbase::error::query_errc::prepared_statement_failure},
                {"dml_failure", couchbase::error::query_errc::dml_failure},
            }));

    exports.Set(
        "analytics_errc",
        cbppEnumToJs<couchbase::error::analytics_errc>(
            env,
            {
                {"compilation_failure",
                 couchbase::error::analytics_errc::compilation_failure},
                {"job_queue_full",
                 couchbase::error::analytics_errc::job_queue_full},
                {"dataset_not_found",
                 couchbase::error::analytics_errc::dataset_not_found},
                {"dataverse_not_found",
                 couchbase::error::analytics_errc::dataverse_not_found},
                {"dataset_exists",
                 couchbase::error::analytics_errc::dataset_exists},
                {"dataverse_exists",
                 couchbase::error::analytics_errc::dataverse_exists},
                {"link_not_found",
                 couchbase::error::analytics_errc::link_not_found},
                {"link_exists", couchbase::error::analytics_errc::link_exists},
            }));

    exports.Set(
        "search_errc",
        cbppEnumToJs<couchbase::error::search_errc>(
            env, {
                     {"index_not_ready",
                      couchbase::error::search_errc::index_not_ready},
                     {"consistency_mismatch",
                      couchbase::error::search_errc::consistency_mismatch},
                 }));

    exports.Set(
        "view_errc",
        cbppEnumToJs<couchbase::error::view_errc>(
            env,
            {
                {"view_not_found", couchbase::error::view_errc::view_not_found},
                {"design_document_not_found",
                 couchbase::error::view_errc::design_document_not_found},
            }));

    exports.Set(
        "management_errc",
        cbppEnumToJs<couchbase::error::management_errc>(
            env,
            {
                {"collection_exists",
                 couchbase::error::management_errc::collection_exists},
                {"scope_exists",
                 couchbase::error::management_errc::scope_exists},
                {"user_not_found",
                 couchbase::error::management_errc::user_not_found},
                {"group_not_found",
                 couchbase::error::management_errc::group_not_found},
                {"bucket_exists",
                 couchbase::error::management_errc::bucket_exists},
                {"user_exists", couchbase::error::management_errc::user_exists},
                {"bucket_not_flushable",
                 couchbase::error::management_errc::bucket_not_flushable},
                {"eventing_function_not_found",
                 couchbase::error::management_errc::
                     eventing_function_not_found},
                {"eventing_function_not_deployed",
                 couchbase::error::management_errc::
                     eventing_function_not_deployed},
                {"eventing_function_compilation_failure",
                 couchbase::error::management_errc::
                     eventing_function_compilation_failure},
                {"eventing_function_identical_keyspace",
                 couchbase::error::management_errc::
                     eventing_function_identical_keyspace},
                {"eventing_function_not_bootstrapped",
                 couchbase::error::management_errc::
                     eventing_function_not_bootstrapped},
                {"eventing_function_deployed",
                 couchbase::error::management_errc::eventing_function_deployed},
                {"eventing_function_paused",
                 couchbase::error::management_errc::eventing_function_paused},
            }));

    exports.Set("field_level_encryption_errc",
                cbppEnumToJs<couchbase::error::field_level_encryption_errc>(
                    env, {
                             {"generic_cryptography_failure",
                              couchbase::error::field_level_encryption_errc::
                                  generic_cryptography_failure},
                             {"encryption_failure",
                              couchbase::error::field_level_encryption_errc::
                                  encryption_failure},
                             {"decryption_failure",
                              couchbase::error::field_level_encryption_errc::
                                  decryption_failure},
                             {"crypto_key_not_found",
                              couchbase::error::field_level_encryption_errc::
                                  crypto_key_not_found},
                             {"invalid_crypto_key",
                              couchbase::error::field_level_encryption_errc::
                                  invalid_crypto_key},
                             {"decrypter_not_found",
                              couchbase::error::field_level_encryption_errc::
                                  decrypter_not_found},
                             {"encrypter_not_found",
                              couchbase::error::field_level_encryption_errc::
                                  encrypter_not_found},
                             {"invalid_ciphertext",
                              couchbase::error::field_level_encryption_errc::
                                  invalid_ciphertext},
                         }));

    exports.Set(
        "network_errc",
        cbppEnumToJs<couchbase::error::network_errc>(
            env,
            {
                {"resolve_failure",
                 couchbase::error::network_errc::resolve_failure},
                {"no_endpoints_left",
                 couchbase::error::network_errc::no_endpoints_left},
                {"handshake_failure",
                 couchbase::error::network_errc::handshake_failure},
                {"protocol_error",
                 couchbase::error::network_errc::protocol_error},
                {"configuration_not_available",
                 couchbase::error::network_errc::configuration_not_available},
            }));

    exports.Set(
        "txn_failure_type",
        cbppEnumToJs<couchbase::transactions::failure_type>(
            env, {
                     {"fail", couchbase::transactions::failure_type::FAIL},
                     {"expiry", couchbase::transactions::failure_type::EXPIRY},
                     {"commit_ambiguous",
                      couchbase::transactions::failure_type::COMMIT_AMBIGUOUS},
                 }));

    exports.Set(
        "txn_external_exception",
        cbppEnumToJs<couchbase::transactions::external_exception>(
            env, {
                     {"unknown",
                      couchbase::transactions::external_exception::UNKNOWN},
                     {"active_transaction_record_entry_not_found",
                      couchbase::transactions::external_exception::
                          ACTIVE_TRANSACTION_RECORD_ENTRY_NOT_FOUND},
                     {"active_transaction_record_full",
                      couchbase::transactions::external_exception::
                          ACTIVE_TRANSACTION_RECORD_FULL},
                     {"active_transaction_record_not_found",
                      couchbase::transactions::external_exception::
                          ACTIVE_TRANSACTION_RECORD_NOT_FOUND},
                     {"document_already_in_transaction",
                      couchbase::transactions::external_exception::
                          DOCUMENT_ALREADY_IN_TRANSACTION},
                     {"document_exists_exception",
                      couchbase::transactions::external_exception::
                          DOCUMENT_EXISTS_EXCEPTION},
                     {"document_not_found_exception",
                      couchbase::transactions::external_exception::
                          DOCUMENT_NOT_FOUND_EXCEPTION},
                     {"not_set",
                      couchbase::transactions::external_exception::NOT_SET},
                     {"feature_not_available_exception",
                      couchbase::transactions::external_exception::
                          FEATURE_NOT_AVAILABLE_EXCEPTION},
                     {"transaction_aborted_externally",
                      couchbase::transactions::external_exception::
                          TRANSACTION_ABORTED_EXTERNALLY},
                     {"previous_operation_failed",
                      couchbase::transactions::external_exception::
                          PREVIOUS_OPERATION_FAILED},
                     {"forward_compatibility_failure",
                      couchbase::transactions::external_exception::
                          FORWARD_COMPATIBILITY_FAILURE},
                 }));
}

} // namespace couchnode
