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

#ifndef LIBCOUCHBASE_CAPI_GET_HH
#define LIBCOUCHBASE_CAPI_GET_HH

#include <cstddef>
#include <cstdint>
#include <chrono>

#include "key_value_error_context.hh"
#include "collection_qualifier.hh"

enum class get_mode {
    normal,
    with_touch,
    with_lock,
};
/**
 * @private
 */
struct lcb_CMDGET_ {
    static const std::string &operation_name()
    {
        static std::string name = LCBTRACE_OP_GET;
        return name;
    }

    lcb_STATUS with_touch(std::uint32_t expiry)
    {
        if (mode_ != get_mode::normal && mode_ != get_mode::with_touch) {
            return LCB_ERR_INVALID_ARGUMENT;
        }
        mode_ = get_mode::with_touch;
        expiry_ = expiry;
        return LCB_SUCCESS;
    }

    lcb_STATUS with_lock(std::uint32_t duration)
    {
        if (mode_ != get_mode::normal && mode_ != get_mode::with_lock) {
            return LCB_ERR_INVALID_ARGUMENT;
        }
        mode_ = get_mode::with_lock;
        lock_time_ = duration;
        return LCB_SUCCESS;
    }

    bool with_touch() const
    {
        return mode_ == get_mode::with_touch;
    }

    bool with_lock() const
    {
        return mode_ == get_mode::with_lock;
    }

    std::uint32_t expiry() const
    {
        return expiry_;
    }

    std::uint32_t lock_time() const
    {
        return lock_time_;
    }

    lcb_STATUS key(std::string key)
    {
        key_ = std::move(key);
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
     * Right now only internal code is using it (see view requests)
     */
    void treat_cookie_as_callback(bool value)
    {
        cookie_is_callback_ = value;
    }

    bool is_cookie_callback() const
    {
        return cookie_is_callback_;
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
    std::uint32_t expiry_{0};
    std::uint32_t lock_time_{0};
    lcbtrace_SPAN *parent_span_{nullptr};
    void *cookie_{nullptr};
    std::string key_{};
    get_mode mode_{get_mode::normal};
    bool cookie_is_callback_{false};
    std::string impostor_{};
    std::vector<std::string> extra_privileges_{};
};

/** @private */
struct lcb_RESPGET_ {
    lcb_KEY_VALUE_ERROR_CONTEXT ctx{};
    /**
     Application-defined pointer passed as the `cookie` parameter when
     scheduling the command.
     */
    void *cookie;
    /** Response specific flags. see ::lcb_RESPFLAGS */
    std::uint16_t rflags;

    const void *value;  /**< Value buffer for the item */
    std::size_t nvalue; /**< Length of value */
    void *bufh;
    std::uint8_t datatype;  /**< @internal */
    std::uint32_t itmflags; /**< User-defined flags for the item */
};

#endif // LIBCOUCHBASE_CAPI_GET_HH
