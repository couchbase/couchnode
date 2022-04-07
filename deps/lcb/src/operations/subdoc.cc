/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2015-2020 Couchbase, Inc.
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */
#include "internal.h"
#include "collections.h"
#include <vector>
#include <string>

#include "defer.h"

#include "capi/cmd_subdoc.hh"

LIBCOUCHBASE_API size_t lcb_respsubdoc_result_size(const lcb_RESPSUBDOC *resp)
{
    return resp->nres;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respsubdoc_result_status(const lcb_RESPSUBDOC *resp, size_t index)
{
    if (index >= resp->nres) {
        return LCB_ERR_OPTIONS_CONFLICT;
    }
    return resp->res[index].status;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respsubdoc_result_value(const lcb_RESPSUBDOC *resp, size_t index, const char **value,
                                                        size_t *value_len)
{
    if (index >= resp->nres) {
        return LCB_ERR_OPTIONS_CONFLICT;
    }
    *value = (const char *)resp->res[index].value;
    *value_len = resp->res[index].nvalue;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respsubdoc_status(const lcb_RESPSUBDOC *resp)
{
    return resp->ctx.rc;
}

LIBCOUCHBASE_API int lcb_respsubdoc_is_deleted(const lcb_RESPSUBDOC *resp)
{
    return resp->ctx.status_code == PROTOCOL_BINARY_RESPONSE_SUBDOC_MULTI_PATH_FAILURE_DELETED ||
           resp->ctx.status_code == PROTOCOL_BINARY_RESPONSE_SUBDOC_SUCCESS_DELETED;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respsubdoc_error_context(const lcb_RESPSUBDOC *resp,
                                                         const lcb_KEY_VALUE_ERROR_CONTEXT **ctx)
{
    *ctx = &resp->ctx;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respsubdoc_cookie(const lcb_RESPSUBDOC *resp, void **cookie)
{
    *cookie = resp->cookie;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respsubdoc_cas(const lcb_RESPSUBDOC *resp, uint64_t *cas)
{
    *cas = resp->ctx.cas;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respsubdoc_key(const lcb_RESPSUBDOC *resp, const char **key, size_t *key_len)
{
    *key = resp->ctx.key.c_str();
    *key_len = resp->ctx.key.size();
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respsubdoc_mutation_token(const lcb_RESPSUBDOC *resp, lcb_MUTATION_TOKEN *token)
{
    if (token) {
        *token = resp->mt;
    }
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_subdocspecs_create(lcb_SUBDOCSPECS **operations, size_t capacity)
{
    *operations = new lcb_SUBDOCSPECS{};
    (*operations)->specs().resize(capacity);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_subdocspecs_destroy(lcb_SUBDOCSPECS *operations)
{
    delete operations;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdsubdoc_timeout(lcb_CMDSUBDOC *cmd, uint32_t timeout)
{
    return cmd->timeout_in_microseconds(timeout);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdsubdoc_cas(lcb_CMDSUBDOC *cmd, uint64_t cas)
{
    return cmd->cas(cas);
}

LIBCOUCHBASE_API lcb_STATUS lcb_subdocspecs_get(lcb_SUBDOCSPECS *operations, size_t index, uint32_t flags,
                                                const char *path, size_t path_len)
{
    if (index >= operations->specs().size()) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    auto &spec = operations->specs()[index];
    if (path == nullptr || path_len == 0) {
        spec.opcode(subdoc_opcode::get_fulldoc);
        spec.clear_path();
    } else {
        spec.opcode(subdoc_opcode::get);
        spec.path(std::string(path, path_len));
    }
    spec.options(flags);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_subdocspecs_exists(lcb_SUBDOCSPECS *operations, size_t index, uint32_t flags,
                                                   const char *path, size_t path_len)
{
    if (index >= operations->specs().size()) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    if (path == nullptr || path_len == 0) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    auto &spec = operations->specs()[index];
    spec.opcode(subdoc_opcode::exist);
    spec.path(std::string(path, path_len));
    spec.options(flags);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_subdocspecs_replace(lcb_SUBDOCSPECS *operations, size_t index, uint32_t flags,
                                                    const char *path, size_t path_len, const char *value,
                                                    size_t value_len)
{
    if (index >= operations->specs().size()) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    if (value == nullptr || value_len == 0) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    auto &spec = operations->specs()[index];
    if (path == nullptr || path_len == 0) {
        spec.opcode(subdoc_opcode::set_fulldoc);
        spec.clear_path();
    } else {
        spec.opcode(subdoc_opcode::replace);
        spec.path(std::string(path, path_len));
    }
    spec.value(std::string(value, value_len));
    spec.options(flags);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_subdocspecs_dict_add(lcb_SUBDOCSPECS *operations, size_t index, uint32_t flags,
                                                     const char *path, size_t path_len, const char *value,
                                                     size_t value_len)
{
    if (index >= operations->specs().size()) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    if (path == nullptr || path_len == 0) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    if (value == nullptr || value_len == 0) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    auto &spec = operations->specs()[index];
    spec.opcode(subdoc_opcode::dict_add);
    spec.path(std::string(path, path_len));
    spec.value(std::string(value, value_len));
    spec.options(flags);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_subdocspecs_dict_upsert(lcb_SUBDOCSPECS *operations, size_t index, uint32_t flags,
                                                        const char *path, size_t path_len, const char *value,
                                                        size_t value_len)
{
    if (index >= operations->specs().size()) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    if (path == nullptr || path_len == 0) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    if (value == nullptr || value_len == 0) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    auto &spec = operations->specs()[index];
    spec.opcode(subdoc_opcode::dict_upsert);
    spec.path(std::string(path, path_len));
    spec.value(std::string(value, value_len));
    spec.options(flags);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_subdocspecs_array_add_first(lcb_SUBDOCSPECS *operations, size_t index, uint32_t flags,
                                                            const char *path, size_t path_len, const char *value,
                                                            size_t value_len)
{
    if (index >= operations->specs().size()) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    if (value == nullptr || value_len == 0) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    auto &spec = operations->specs()[index];
    spec.opcode(subdoc_opcode::array_add_first);
    spec.path(std::string(path, path_len));
    spec.value(std::string(value, value_len));
    spec.options(flags);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_subdocspecs_array_add_last(lcb_SUBDOCSPECS *operations, size_t index, uint32_t flags,
                                                           const char *path, size_t path_len, const char *value,
                                                           size_t value_len)
{
    if (index >= operations->specs().size()) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    if (value == nullptr || value_len == 0) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    auto &spec = operations->specs()[index];
    spec.opcode(subdoc_opcode::array_add_last);
    spec.path(std::string(path, path_len));
    spec.value(std::string(value, value_len));
    spec.options(flags);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_subdocspecs_array_add_unique(lcb_SUBDOCSPECS *operations, size_t index, uint32_t flags,
                                                             const char *path, size_t path_len, const char *value,
                                                             size_t value_len)
{
    if (index >= operations->specs().size()) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    if (value == nullptr || value_len == 0) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    auto &spec = operations->specs()[index];
    spec.opcode(subdoc_opcode::array_add_unique);
    spec.path(std::string(path, path_len));
    spec.value(std::string(value, value_len));
    spec.options(flags);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_subdocspecs_array_insert(lcb_SUBDOCSPECS *operations, size_t index, uint32_t flags,
                                                         const char *path, size_t path_len, const char *value,
                                                         size_t value_len)
{
    if (index >= operations->specs().size()) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    if (value == nullptr || value_len == 0) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    auto &spec = operations->specs()[index];
    spec.opcode(subdoc_opcode::array_insert);
    spec.path(std::string(path, path_len));
    spec.value(std::string(value, value_len));
    spec.options(flags);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_subdocspecs_counter(lcb_SUBDOCSPECS *operations, size_t index, uint32_t flags,
                                                    const char *path, size_t path_len, int64_t delta)
{
    if (index >= operations->specs().size()) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    auto &spec = operations->specs()[index];
    spec.opcode(subdoc_opcode::counter);
    spec.path(std::string(path, path_len));
    spec.value(delta);
    spec.options(flags);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_subdocspecs_remove(lcb_SUBDOCSPECS *operations, size_t index, uint32_t flags,
                                                   const char *path, size_t path_len)
{
    if (index >= operations->specs().size()) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    auto &spec = operations->specs()[index];
    if (path == nullptr || path_len == 0) {
        spec.opcode(subdoc_opcode::remove_fulldoc);
        spec.clear_path();
    } else {
        spec.opcode(subdoc_opcode::remove);
        spec.path(std::string(path, path_len));
    }
    spec.options(flags);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_subdocspecs_get_count(lcb_SUBDOCSPECS *operations, size_t index, uint32_t flags,
                                                      const char *path, size_t path_len)
{
    if (index >= operations->specs().size()) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    auto &spec = operations->specs()[index];
    spec.opcode(subdoc_opcode::get_count);
    if (path != nullptr && path_len > 0) {
        spec.path(std::string(path, path_len));
    }
    spec.options(flags);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdsubdoc_create(lcb_CMDSUBDOC **cmd)
{
    *cmd = new lcb_CMDSUBDOC{};
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdsubdoc_destroy(lcb_CMDSUBDOC *cmd)
{
    delete cmd;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdsubdoc_parent_span(lcb_CMDSUBDOC *cmd, lcbtrace_SPAN *span)
{
    return cmd->parent_span(span);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdsubdoc_collection(lcb_CMDSUBDOC *cmd, const char *scope, size_t scope_len,
                                                     const char *collection, size_t collection_len)
{
    try {
        lcb::collection_qualifier qualifier(scope, scope_len, collection, collection_len);
        return cmd->collection(std::move(qualifier));
    } catch (const std::invalid_argument &) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdsubdoc_key(lcb_CMDSUBDOC *cmd, const char *key, size_t key_len)
{
    if (key == nullptr || key_len == 0) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    return cmd->key(std::string(key, key_len));
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdsubdoc_specs(lcb_CMDSUBDOC *cmd, const lcb_SUBDOCSPECS *operations)
{
    return cmd->specs(operations);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdsubdoc_expiry(lcb_CMDSUBDOC *cmd, uint32_t expiration)
{
    return cmd->expiry(expiration);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdsubdoc_preserve_expiry(lcb_CMDSUBDOC *cmd, int should_preserve)
{
    return cmd->preserve_expiry(should_preserve);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdsubdoc_durability(lcb_CMDSUBDOC *cmd, lcb_DURABILITY_LEVEL level)
{
    return cmd->durability_level(level);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdsubdoc_store_semantics(lcb_CMDSUBDOC *cmd, lcb_SUBDOC_STORE_SEMANTICS mode)
{
    return cmd->store_semantics(mode);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdsubdoc_access_deleted(lcb_CMDSUBDOC *cmd, int flag)
{
    return cmd->access_deleted(flag);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdsubdoc_create_as_deleted(lcb_CMDSUBDOC *cmd, int flag)
{
    return cmd->create_as_deleted(flag);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdsubdoc_on_behalf_of(lcb_CMDSUBDOC *cmd, const char *data, size_t data_len)
{
    return cmd->on_behalf_of(std::string(data, data_len));
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdsubdoc_on_behalf_of_extra_privilege(lcb_CMDSUBDOC *cmd, const char *privilege,
                                                                       size_t privilege_len)
{
    return cmd->on_behalf_of_add_extra_privilege(std::string(privilege, privilege_len));
}

namespace SubdocCmdTraits
{
enum Options {
    EMPTY_PATH = 1 << 0,
    ALLOW_EXPIRY = 1 << 1,
    HAS_VALUE = 1 << 2,
    ALLOW_MKDIRP = 1 << 3,
    IS_LOOKUP = 1 << 4,
    // Must encapsulate in 'multi' spec
    NO_STANDALONE = 1 << 5
};

struct Traits {
    const unsigned allow_empty_path;
    const unsigned allow_expiry;
    const unsigned has_value;
    const unsigned allow_mkdir_p;
    const unsigned is_lookup;
    const uint8_t opcode;

    inline bool valid() const
    {
        return opcode != PROTOCOL_BINARY_CMD_INVALID;
    }

    inline unsigned mode() const
    {
        return is_lookup ? LCB_SDMULTI_MODE_LOOKUP : LCB_SDMULTI_MODE_MUTATE;
    }

    inline bool chk_allow_empty_path(const subdoc_spec_options &options) const
    {
        if (allow_empty_path) {
            return true;
        }
        if (!is_lookup) {
            return false;
        }

        return !options.xattr;
    }

    inline Traits(uint8_t op, unsigned options) noexcept
        : allow_empty_path(options & EMPTY_PATH), allow_expiry(options & ALLOW_EXPIRY), has_value(options & HAS_VALUE),
          allow_mkdir_p(options & ALLOW_MKDIRP), is_lookup(options & IS_LOOKUP), opcode(op)
    {
    }
};

static const Traits Get(PROTOCOL_BINARY_CMD_SUBDOC_GET, IS_LOOKUP);

static const Traits Exists(PROTOCOL_BINARY_CMD_SUBDOC_EXISTS, IS_LOOKUP);

static const Traits GetCount(PROTOCOL_BINARY_CMD_SUBDOC_GET_COUNT, IS_LOOKUP | EMPTY_PATH);

static const Traits DictAdd(PROTOCOL_BINARY_CMD_SUBDOC_DICT_ADD, ALLOW_EXPIRY | HAS_VALUE);

static const Traits DictUpsert(PROTOCOL_BINARY_CMD_SUBDOC_DICT_UPSERT, ALLOW_EXPIRY | HAS_VALUE | ALLOW_MKDIRP);

static const Traits Remove(PROTOCOL_BINARY_CMD_SUBDOC_DELETE, ALLOW_EXPIRY);

static const Traits ArrayInsert(PROTOCOL_BINARY_CMD_SUBDOC_ARRAY_INSERT, ALLOW_EXPIRY | HAS_VALUE);

static const Traits Replace(PROTOCOL_BINARY_CMD_SUBDOC_REPLACE, ALLOW_EXPIRY | HAS_VALUE);

static const Traits ArrayAddFirst(PROTOCOL_BINARY_CMD_SUBDOC_ARRAY_PUSH_FIRST,
                                  ALLOW_EXPIRY | HAS_VALUE | EMPTY_PATH | ALLOW_MKDIRP);

static const Traits ArrayAddLast(PROTOCOL_BINARY_CMD_SUBDOC_ARRAY_PUSH_LAST,
                                 ALLOW_EXPIRY | HAS_VALUE | EMPTY_PATH | ALLOW_MKDIRP);

static const Traits ArrayAddUnique(PROTOCOL_BINARY_CMD_SUBDOC_ARRAY_ADD_UNIQUE,
                                   ALLOW_EXPIRY | HAS_VALUE | EMPTY_PATH | ALLOW_MKDIRP);

static const Traits Counter(PROTOCOL_BINARY_CMD_SUBDOC_COUNTER, ALLOW_EXPIRY | HAS_VALUE | ALLOW_MKDIRP);

static const Traits GetDoc(PROTOCOL_BINARY_CMD_GET, IS_LOOKUP | EMPTY_PATH | NO_STANDALONE);

static const Traits SetDoc(PROTOCOL_BINARY_CMD_SET, EMPTY_PATH | NO_STANDALONE);

static const Traits RemoveDoc(PROTOCOL_BINARY_CMD_DELETE, EMPTY_PATH | NO_STANDALONE);

static const Traits Invalid(PROTOCOL_BINARY_CMD_INVALID, 0);

const Traits &find(subdoc_opcode mode)
{
    switch (mode) {
        case subdoc_opcode::get:
            return Get;
        case subdoc_opcode::exist:
            return Exists;
        case subdoc_opcode::replace:
            return Replace;
        case subdoc_opcode::dict_add:
            return DictAdd;
        case subdoc_opcode::dict_upsert:
            return DictUpsert;
        case subdoc_opcode::array_add_first:
            return ArrayAddFirst;
        case subdoc_opcode::array_add_last:
            return ArrayAddLast;
        case subdoc_opcode::array_add_unique:
            return ArrayAddUnique;
        case subdoc_opcode::array_insert:
            return ArrayInsert;
        case subdoc_opcode::counter:
            return Counter;
        case subdoc_opcode::remove:
            return Remove;
        case subdoc_opcode::get_count:
            return GetCount;
        case subdoc_opcode::get_fulldoc:
            return GetDoc;
        case subdoc_opcode::set_fulldoc:
            return SetDoc;
        case subdoc_opcode::remove_fulldoc:
            return RemoveDoc;
        default:
            return Invalid;
    }
}
} // namespace SubdocCmdTraits

namespace SubdocPathFlags
{
static const uint8_t MKDIR_P = 0x01;
static const uint8_t XATTR = 0x04;
static const uint8_t EXPAND_MACROS = 0x010;
} // namespace SubdocPathFlags

namespace SubdocDocFlags
{
static const uint8_t MKDOC = 0x01;
static const uint8_t ADDDOC = 0x02;
static const uint8_t ACCESS_DELETED = 0x04;
static const uint8_t CREATE_AS_DELETED = 0x08;
} // namespace SubdocDocFlags

static uint8_t make_path_flags(const subdoc_spec_options &options)
{
    uint8_t flags = 0;
    if (options.create_parents) {
        flags |= SubdocPathFlags::MKDIR_P;
    }
    if (options.xattr) {
        flags |= SubdocPathFlags::XATTR;
    }
    if (options.expand_macros) {
        flags |= SubdocPathFlags::XATTR | SubdocPathFlags::EXPAND_MACROS;
    }
    return flags;
}

static uint8_t make_doc_flags(const subdoc_options &options)
{
    uint8_t flags = 0;
    if (options.insert_document) {
        flags |= SubdocDocFlags::ADDDOC;
    }
    if (options.upsert_document) {
        flags |= SubdocDocFlags::MKDOC;
    }
    if (options.access_deleted) {
        flags |= SubdocDocFlags::ACCESS_DELETED;
    }
    if (options.create_as_deleted) {
        flags |= SubdocDocFlags::CREATE_AS_DELETED;
    }
    return flags;
}

static unsigned infer_mode(const lcb_SUBDOCSPECS &specs)
{
    if (specs.specs().empty()) {
        return 0;
    }
    const SubdocCmdTraits::Traits &trait = SubdocCmdTraits::find(specs.specs()[0].opcode());
    if (!trait.valid()) {
        return 0;
    }
    return trait.mode();
}

struct MultiBuilder {
    explicit MultiBuilder(std::shared_ptr<lcb_CMDSUBDOC> cmd) : cmd_(cmd)
    {
        mode_ = infer_mode(cmd_->specs());
        size_t ebufsz = cmd->specs().specs().size() * (is_lookup() ? 4 : 8);
        extra_body_ = new char[ebufsz];
    }

    ~MultiBuilder()
    {
        delete[] extra_body_;
    }

    // IOVs which are fed into lcb_VALBUF for subsequent use
    std::shared_ptr<lcb_CMDSUBDOC> cmd_;
    std::vector<lcb_IOV> iovs_;
    char *extra_body_;
    size_t bodysz_{0};

    // Total size of the payload itself
    size_t payload_size_{0};

    unsigned mode_;

    bool is_lookup() const
    {
        return mode_ == LCB_SDMULTI_MODE_LOOKUP;
    }

    bool is_mutate() const
    {
        return mode_ == LCB_SDMULTI_MODE_MUTATE;
    }

    void maybe_setmode(const SubdocCmdTraits::Traits &t)
    {
        if (mode_ == 0) {
            mode_ = t.mode();
        }
    }

    template <typename T>
    void add_field(T itm, size_t len)
    {
        const char *b = reinterpret_cast<const char *>(&itm);
        memcpy(extra_body_ + bodysz_, b, len);
        bodysz_ += len;
    }

    const char *extra_mark() const
    {
        return extra_body_ + bodysz_;
    }

    void add_extras_iov(const char *last_begin)
    {
        const char *p_end = extra_mark();
        add_iov(last_begin, p_end - last_begin);
    }

    void add_iov(const void *b, size_t n)
    {
        if (!n) {
            return;
        }

        lcb_IOV iov;
        iov.iov_base = const_cast<void *>(b);
        iov.iov_len = n;
        iovs_.push_back(iov);
        payload_size_ += n;
    }

    void add_iov(const std::string &value)
    {
        add_iov(value.data(), value.size());
    }

    lcb_STATUS add_spec(const subdoc_spec &spec)
    {
        const SubdocCmdTraits::Traits &trait = SubdocCmdTraits::find(spec.opcode());
        if (!trait.valid()) {
            return LCB_ERR_UNKNOWN_SUBDOC_COMMAND;
        }
        maybe_setmode(trait);

        if (trait.mode() != mode_) {
            return LCB_ERR_OPTIONS_CONFLICT;
        }

        const char *p_begin = extra_mark();
        // opcode
        add_field(trait.opcode, 1);
        // flags
        add_field(make_path_flags(spec.options()), 1);

        if (!trait.chk_allow_empty_path(spec.options()) && spec.path().empty()) {
            return LCB_ERR_SUBDOC_PATH_INVALID;
        }

        // Path length
        add_field(htons(static_cast<uint16_t>(spec.path().size())), 2);

        if (is_mutate()) {
            // Mutation needs an additional 'value' spec.
            add_field(htonl(static_cast<uint32_t>(spec.value().size())), 4);
        }

        // Finalize the header..
        add_extras_iov(p_begin);

        // Add the actual path
        add_iov(spec.path().data(), spec.path().size());
        if (!spec.value().empty()) {
            add_iov(spec.value());
        }
        return LCB_SUCCESS;
    }
};

static lcb_STATUS subdoc_validate(lcb_INSTANCE *instance, const lcb_CMDSUBDOC *cmd)
{
    if (cmd->key().empty()) {
        return LCB_ERR_EMPTY_KEY;
    }
    if (!LCBT_SETTING(instance, use_collections) && !cmd->collection().is_default_collection()) {
        /* only allow default collection when collections disabled for the instance */
        return LCB_ERR_SDK_FEATURE_UNAVAILABLE;
    }
    if (cmd->specs().specs().empty()) {
        return LCB_ERR_NO_COMMANDS;
    }
    if (!LCBT_SETTING(instance, enable_durable_write) && cmd->has_durability_requirements()) {
        return LCB_ERR_UNSUPPORTED_OPERATION;
    }

    return LCB_SUCCESS;
}

static lcb_STATUS subdoc_schedule(lcb_INSTANCE *instance, std::shared_ptr<lcb_CMDSUBDOC> cmd)
{
    uint8_t docflags = make_doc_flags(cmd->options());

    if ((docflags & SubdocDocFlags::CREATE_AS_DELETED) != 0 &&
        (LCBVB_CAPS(LCBT_VBCONFIG(instance)) & LCBVB_CAP_TOMBSTONED_USER_XATTRS) == 0) {
        return LCB_ERR_SDK_FEATURE_UNAVAILABLE;
    }

    MultiBuilder ctx(cmd);

    if ((cmd->has_expiry() || cmd->should_preserve_expiry()) && !ctx.is_mutate()) {
        return LCB_ERR_OPTIONS_CONFLICT;
    }

    lcb_STATUS rc = LCB_SUCCESS;

    for (const auto &spec : cmd->specs().specs()) {
        rc = ctx.add_spec(spec);
        if (rc != LCB_SUCCESS) {
            return rc;
        }
    }

    mc_PIPELINE *pl;
    mc_PACKET *pkt;
    uint8_t extlen = 0;
    if (cmd->has_expiry()) {
        extlen += 4;
    }
    if (docflags != 0) {
        extlen++;
    }

    protocol_binary_request_header hdr;
    int new_durability_supported = LCBT_SUPPORT_SYNCREPLICATION(instance);

    std::vector<std::uint8_t> framing_extras;

    // Set the header fields.
    if (ctx.is_lookup()) {
        hdr.request.opcode = PROTOCOL_BINARY_CMD_SUBDOC_MULTI_LOOKUP;
    } else {
        hdr.request.opcode = PROTOCOL_BINARY_CMD_SUBDOC_MULTI_MUTATION;

        if (new_durability_supported && cmd->has_durability_requirements()) {
            auto durability_timeout = htons(lcb_durability_timeout(instance, cmd->timeout_in_microseconds()));
            std::uint8_t frame_id = 0x01;
            std::uint8_t frame_size = durability_timeout > 0 ? 3 : 1;
            framing_extras.emplace_back(frame_id << 4U | frame_size);
            framing_extras.emplace_back(cmd->durability_level());
            if (durability_timeout > 0) {
                framing_extras.emplace_back(durability_timeout >> 8U);
                framing_extras.emplace_back(durability_timeout & 0xff);
            }
        }
        if (cmd->should_preserve_expiry()) {
            std::uint8_t frame_id = 0x05;
            std::uint8_t frame_size = 0x00;
            framing_extras.emplace_back(frame_id << 4U | frame_size);
        }
    }
    if (cmd->want_impersonation()) {
        rc = lcb::flexible_framing_extras::encode_impersonate_user(cmd->impostor(), framing_extras);
        if (rc != LCB_SUCCESS) {
            return rc;
        }
        for (const auto &privilege : cmd->extra_privileges()) {
            rc = lcb::flexible_framing_extras::encode_impersonate_users_extra_privilege(privilege, framing_extras);
            if (rc != LCB_SUCCESS) {
                return rc;
            }
        }
    }
    hdr.request.magic = framing_extras.empty() ? PROTOCOL_BINARY_REQ : PROTOCOL_BINARY_AREQ;
    auto ffextlen = static_cast<std::uint8_t>(framing_extras.size());

    lcb_KEYBUF keybuf{LCB_KV_COPY, {cmd->key().c_str(), cmd->key().size()}};
    rc = mcreq_basic_packet(&instance->cmdq, &keybuf, cmd->collection().collection_id(), &hdr, extlen, ffextlen, &pkt,
                            &pl, MCREQ_BASICPACKET_F_FALLBACKOK);

    if (rc != LCB_SUCCESS) {
        return rc;
    }

    lcb_VALBUF vb = {LCB_KV_IOVCOPY};
    vb.u_buf.multi.iov = &ctx.iovs_[0];
    vb.u_buf.multi.niov = ctx.iovs_.size();
    vb.u_buf.multi.total_length = ctx.payload_size_;
    rc = mcreq_reserve_value(pl, pkt, &vb);

    if (rc != LCB_SUCCESS) {
        mcreq_wipe_packet(pl, pkt);
        mcreq_release_packet(pl, pkt);
        return rc;
    }

    hdr.request.datatype = PROTOCOL_BINARY_RAW_BYTES;
    hdr.request.extlen = extlen;
    hdr.request.opaque = pkt->opaque;
    hdr.request.cas = lcb_htonll(cmd->cas());
    hdr.request.bodylen = htonl(hdr.request.extlen + ffextlen + mcreq_get_key_size(&hdr) + ctx.payload_size_);
    memcpy(SPAN_BUFFER(&pkt->kh_span), hdr.bytes, sizeof(hdr.bytes));

    std::size_t offset = sizeof(hdr);
    if (!framing_extras.empty()) {
        memcpy(SPAN_BUFFER(&pkt->kh_span) + offset, framing_extras.data(), framing_extras.size());
        offset += framing_extras.size();
    }

    if (ctx.is_mutate() && cmd->has_expiry()) {
        std::uint32_t expiry = htonl(cmd->expiry());
        memcpy(SPAN_BUFFER(&pkt->kh_span) + offset, &expiry, sizeof(expiry));
        offset += sizeof(expiry);
    }
    if (docflags) {
        memcpy(SPAN_BUFFER(&pkt->kh_span) + offset, &docflags, sizeof(docflags));
    }
    if (ctx.is_mutate() && !cmd->options().insert_document) {
        pkt->flags |= MCREQ_F_REPLACE_SEMANTICS;
    }

    MCREQ_PKT_RDATA(pkt)->cookie = cmd->cookie();
    MCREQ_PKT_RDATA(pkt)->start = cmd->start_time_or_default_in_nanoseconds(gethrtime());
    MCREQ_PKT_RDATA(pkt)->deadline =
        MCREQ_PKT_RDATA(pkt)->start +
        cmd->timeout_or_default_in_nanoseconds(LCB_US2NS(LCBT_SETTING(instance, operation_timeout)));
    MCREQ_PKT_RDATA(pkt)->nsubreq = cmd->specs().specs().size();
    MCREQ_PKT_RDATA(pkt)->span = lcb::trace::start_kv_span(instance->settings, pkt, cmd);
    LCB_SCHED_ADD(instance, pl, pkt)
    return LCB_SUCCESS;
}

static lcb_STATUS subdoc_execute(lcb_INSTANCE *instance, std::shared_ptr<lcb_CMDSUBDOC> cmd)
{
    if (!LCBT_SETTING(instance, use_collections)) {
        /* fast path if collections are not enabled */
        return subdoc_schedule(instance, cmd);
    }

    if (collcache_get(instance, cmd->collection()) == LCB_SUCCESS) {
        return subdoc_schedule(instance, cmd);
    }

    return collcache_resolve(
        instance, cmd,
        [instance](lcb_STATUS status, const lcb_RESPGETCID *resp, std::shared_ptr<lcb_CMDSUBDOC> operation) {
            const auto callback_type = infer_mode(operation->specs()) == LCB_SDMULTI_MODE_LOOKUP
                                           ? LCB_CALLBACK_SDLOOKUP
                                           : LCB_CALLBACK_SDMUTATE;
            lcb_RESPCALLBACK operation_callback = lcb_find_callback(instance, callback_type);
            lcb_RESPSUBDOC response{};
            if (resp != nullptr) {
                response.ctx = resp->ctx;
            }
            response.ctx.key = operation->key();
            response.ctx.scope = operation->collection().scope();
            response.ctx.collection = operation->collection().collection();
            response.cookie = operation->cookie();
            if (status == LCB_ERR_SHEDULE_FAILURE || resp == nullptr) {
                response.ctx.rc = LCB_ERR_TIMEOUT;
                operation_callback(instance, callback_type, &response);
                return;
            }
            if (resp->ctx.rc != LCB_SUCCESS) {
                operation_callback(instance, callback_type, &response);
                return;
            }
            response.ctx.rc = subdoc_schedule(instance, operation);
            if (response.ctx.rc != LCB_SUCCESS) {
                operation_callback(instance, callback_type, &response);
            }
        });
}

LIBCOUCHBASE_API
lcb_STATUS lcb_subdoc(lcb_INSTANCE *instance, void *cookie, const lcb_CMDSUBDOC *command)
{
    lcb_STATUS err;

    err = subdoc_validate(instance, command);
    if (err != LCB_SUCCESS) {
        return err;
    }

    auto cmd = std::make_shared<lcb_CMDSUBDOC>(*command);
    cmd->cookie(cookie);

    if (instance->cmdq.config == nullptr) {
        cmd->start_time_in_nanoseconds(gethrtime());
        return lcb::defer_operation(instance, [instance, cmd](lcb_STATUS status) {
            const auto callback_type =
                infer_mode(cmd->specs()) == LCB_SDMULTI_MODE_LOOKUP ? LCB_CALLBACK_SDLOOKUP : LCB_CALLBACK_SDMUTATE;
            lcb_RESPCALLBACK operation_callback = lcb_find_callback(instance, callback_type);
            lcb_RESPSUBDOC response{};
            response.ctx.key = cmd->key();
            response.cookie = cmd->cookie();
            if (status == LCB_ERR_REQUEST_CANCELED) {
                response.ctx.rc = status;
                operation_callback(instance, callback_type, &response);
                return;
            }
            response.ctx.rc = subdoc_execute(instance, cmd);
            if (response.ctx.rc != LCB_SUCCESS) {
                operation_callback(instance, callback_type, &response);
            }
        });
    }
    return subdoc_execute(instance, cmd);
}
