/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2016-2021 Couchbase, Inc.
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

#ifndef LIBCOUCHBASE_CAPI_STORE_HH
#define LIBCOUCHBASE_CAPI_STORE_HH

#include <cstddef>
#include <cstdint>
#include <chrono>

#include "key_value_error_context.hh"
#include "collection_qualifier.hh"

enum class durability_mode {
    none,
    poll,
    sync,
};

/**
 * @private
 */
struct lcb_CMDSTORE_ {
    const std::string &operation_name() const
    {
        static std::map<int, std::string> names{
            {LCB_STORE_UPSERT, LCBTRACE_OP_UPSERT}, {LCB_STORE_REPLACE, LCBTRACE_OP_REPLACE},
            {LCB_STORE_APPEND, LCBTRACE_OP_APPEND}, {LCB_STORE_PREPEND, LCBTRACE_OP_PREPEND},
            {LCB_STORE_INSERT, LCBTRACE_OP_INSERT},
        };
        return names[operation_];
    }

    lcb_STATUS operation(lcb_STORE_OPERATION operation)
    {
        operation_ = operation;
        return LCB_SUCCESS;
    }

    std::uint32_t expiry() const
    {
        return expiry_;
    }

    lcb_STATUS expiry(std::uint32_t expiry)
    {
        if (operation_ == LCB_STORE_PREPEND || operation_ == LCB_STORE_APPEND) {
            return LCB_ERR_OPTIONS_CONFLICT;
        }
        expiry_ = expiry;
        return LCB_SUCCESS;
    }

    std::uint64_t cas() const
    {
        return cas_;
    }

    lcb_STATUS cas(std::uint64_t cas)
    {
        if (operation_ == LCB_STORE_UPSERT || operation_ == LCB_STORE_INSERT) {
            return LCB_ERR_INVALID_ARGUMENT;
        }
        cas_ = cas;
        return LCB_SUCCESS;
    }

    std::uint8_t opcode() const
    {
        switch (operation_) {
            case LCB_STORE_UPSERT:
                return PROTOCOL_BINARY_CMD_SET;

            case LCB_STORE_INSERT:
                return PROTOCOL_BINARY_CMD_ADD;

            case LCB_STORE_REPLACE:
                return PROTOCOL_BINARY_CMD_REPLACE;

            case LCB_STORE_APPEND:
                return PROTOCOL_BINARY_CMD_APPEND;

            case LCB_STORE_PREPEND:
                return PROTOCOL_BINARY_CMD_PREPEND;
        }
        lcb_assert(false && "unknown operation");
        return PROTOCOL_BINARY_CMD_INVALID;
    }

    std::uint8_t extras_size() const
    {
        switch (operation_) {
            case LCB_STORE_UPSERT:
            case LCB_STORE_INSERT:
            case LCB_STORE_REPLACE:
                return 8;

            case LCB_STORE_APPEND:
            case LCB_STORE_PREPEND:
                return 0;
        }
        lcb_assert(false && "unknown extras_size");
        return 0;
    }

    bool is_replace_semantics() const
    {
        switch (operation_) {
            case LCB_STORE_UPSERT:
            case LCB_STORE_REPLACE:
            case LCB_STORE_APPEND:
            case LCB_STORE_PREPEND:
                return true;

            case LCB_STORE_INSERT:
                return false;
        }
        lcb_assert(false && "unknown replace semantics");
        return false;
    }

    lcb_STATUS flags(std::uint32_t flags)
    {
        if (operation_ == LCB_STORE_APPEND || operation_ == LCB_STORE_PREPEND) {
            return LCB_ERR_OPTIONS_CONFLICT;
        }
        flags_ = flags;
        return LCB_SUCCESS;
    }

    std::uint32_t flags() const
    {
        return flags_;
    }

    void value_is_json(bool val)
    {
        json_ = val;
    }

    bool value_is_json() const
    {
        return json_;
    }

    void value_is_compressed(bool val)
    {
        compressed_ = val;
    }

    bool value_is_compressed() const
    {
        return compressed_;
    }

    lcb_STATUS durability_level(lcb_DURABILITY_LEVEL level)
    {
        if (durability_mode_ != durability_mode::sync && durability_mode_ != durability_mode::none) {
            return LCB_ERR_INVALID_ARGUMENT;
        }
        durability_mode_ = durability_mode::sync;
        durability_level_ = level;
        return LCB_SUCCESS;
    }

    lcb_STATUS durability_poll(int persist_to, int replicate_to)
    {
        if (durability_mode_ != durability_mode::poll && durability_mode_ != durability_mode::none) {
            return LCB_ERR_INVALID_ARGUMENT;
        }
        durability_mode_ = durability_mode::poll;
        replicate_to_ = replicate_to;
        persist_to_ = persist_to;
        return LCB_SUCCESS;
    }

    std::uint16_t replicate_to() const
    {
        return static_cast<std::uint16_t>(replicate_to_);
    }

    std::uint16_t persist_to() const
    {
        return static_cast<std::uint16_t>(persist_to_);
    }

    bool cap_to_maximum_nodes() const
    {
        return replicate_to_ < 0 || persist_to_ < 0;
    }

    bool has_sync_durability_requirements() const
    {
        return durability_mode_ == durability_mode::sync && durability_level_ != LCB_DURABILITYLEVEL_NONE;
    }

    bool need_poll_durability() const
    {
        return durability_mode_ == durability_mode::poll;
    }

    lcb_DURABILITY_LEVEL durability_level() const
    {
        return durability_level_;
    }

    lcb_STATUS key(std::string key)
    {
        key_ = std::move(key);
        return LCB_SUCCESS;
    }

    const std::string &value() const
    {
        return value_;
    }

    lcb_STATUS value(std::string value)
    {
        value_ = std::move(value);
        return LCB_SUCCESS;
    }

    lcb_STATUS value(const lcb_IOV *iov, std::size_t iov_len)
    {
        std::size_t total_size = 0;
        for (std::size_t i = 0; i < iov_len; ++i) {
            total_size += iov[i].iov_len;
        }
        value_.reserve(total_size);
        for (std::size_t i = 0; i < iov_len; ++i) {
            if (iov[i].iov_len > 0 && iov[i].iov_base != nullptr) {
                value_.append(static_cast<const char *>(iov[i].iov_base), iov[i].iov_len);
            }
        }
        return LCB_SUCCESS;
    }

    lcb_STATUS collection(lcb::collection_qualifier collection)
    {
        collection_ = std::move(collection);
        return LCB_SUCCESS;
    }

    lcb_STATUS parent_span(lcbtrace_SPAN *parent_span)
    {
        parent_span_ = parent_span;
        return LCB_SUCCESS;
    }

    lcb_STATUS timeout_in_milliseconds(std::uint32_t timeout)
    {
        timeout_ = std::chrono::milliseconds(timeout);
        return LCB_SUCCESS;
    }

    lcb_STATUS timeout_in_microseconds(std::uint32_t timeout)
    {
        timeout_ = std::chrono::microseconds(timeout);
        return LCB_SUCCESS;
    }

    lcb_STATUS start_time_in_nanoseconds(std::uint64_t val)
    {
        start_time_ = std::chrono::nanoseconds(val);
        return LCB_SUCCESS;
    }

    std::uint64_t start_time_or_default_in_nanoseconds(std::uint64_t default_val) const
    {
        if (start_time_ == std::chrono::nanoseconds::zero()) {
            return default_val;
        }
        return start_time_.count();
    }

    const lcb::collection_qualifier &collection() const
    {
        return collection_;
    }

    lcb::collection_qualifier &collection()
    {
        return collection_;
    }

    const std::string &key() const
    {
        return key_;
    }

    std::uint64_t timeout_or_default_in_nanoseconds(std::uint64_t default_timeout) const
    {
        if (timeout_ > std::chrono::microseconds::zero()) {
            return std::chrono::duration_cast<std::chrono::nanoseconds>(timeout_).count();
        }
        return default_timeout;
    }

    std::uint32_t timeout_in_microseconds() const
    {
        return static_cast<std::uint32_t>(timeout_.count());
    }

    lcbtrace_SPAN *parent_span() const
    {
        return parent_span_;
    }

    void cookie(void *cookie)
    {
        cookie_ = cookie;
    }

    void *cookie()
    {
        return cookie_;
    }

    /* TODO: this function will be removed once the per-command callbacks will be implemented.
     * Right now only internal code is using it (see analytics requests)
     */
    void treat_cookie_as_callback(bool value)
    {
        cookie_is_callback_ = value;
    }

    bool is_cookie_callback() const
    {
        return cookie_is_callback_;
    }

    lcb_STATUS preserve_expiry(bool preserve)
    {
        switch (operation_) {
            case LCB_STORE_INSERT:
            case LCB_STORE_APPEND:
            case LCB_STORE_PREPEND:
                return LCB_ERR_INVALID_ARGUMENT;

            case LCB_STORE_REPLACE:
            case LCB_STORE_UPSERT:
                preserve_expiry_ = preserve;
                return LCB_SUCCESS;
        }
        return LCB_ERR_INVALID_ARGUMENT;
    }

    bool should_preserve_expiry() const
    {
        return preserve_expiry_;
    }

    lcb_STATUS on_behalf_of(std::string user)
    {
        impostor_ = std::move(user);
        return LCB_SUCCESS;
    }

    lcb_STATUS on_behalf_of_add_extra_privilege(std::string privilege)
    {
        extra_privileges_.emplace_back(std::move(privilege));
        return LCB_SUCCESS;
    }

    const std::vector<std::string> &extra_privileges() const
    {
        return extra_privileges_;
    }

    bool want_impersonation() const
    {
        return !impostor_.empty();
    }

    const std::string &impostor() const
    {
        return impostor_;
    }

  private:
    lcb::collection_qualifier collection_{};
    std::chrono::microseconds timeout_{0};
    std::chrono::nanoseconds start_time_{0};
    lcbtrace_SPAN *parent_span_{nullptr};
    void *cookie_{nullptr};
    lcb_STORE_OPERATION operation_{LCB_STORE_UPSERT};
    std::uint32_t expiry_{0};
    std::string key_{};
    std::string value_{};
    std::uint64_t cas_{0};
    std::uint32_t flags_{0};
    durability_mode durability_mode_{durability_mode::none};
    lcb_DURABILITY_LEVEL durability_level_{LCB_DURABILITYLEVEL_NONE};
    int persist_to_{0};
    int replicate_to_{0};
    bool json_{false};
    bool compressed_{false};
    bool cookie_is_callback_{false};
    bool preserve_expiry_{false};
    std::string impostor_{};
    std::vector<std::string> extra_privileges_{};
};

/**
 * @private
 */
struct lcb_RESPSTORE_ {
    lcb_KEY_VALUE_ERROR_CONTEXT ctx{};
    lcb_MUTATION_TOKEN mt{};
    /**
     Application-defined pointer passed as the `cookie` parameter when
     scheduling the command.
     */
    void *cookie;
    /** Response specific flags. see ::lcb_RESPFLAGS */
    std::uint16_t rflags;

    /** The type of operation which was performed */
    lcb_STORE_OPERATION op;

    /** Internal durability response structure. */
    const lcb_RESPENDURE *dur_resp;

    /**If the #rc field is not @ref LCB_SUCCESS, this field indicates
     * what failed. If this field is nonzero, then the store operation failed,
     * but the durability checking failed. If this field is zero then the
     * actual storage operation failed. */
    int store_ok;
};

#endif // LIBCOUCHBASE_CAPI_STORE_HH
