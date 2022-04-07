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

#ifndef LIBCOUCHBASE_CAPI_SUBDOC_HH
#define LIBCOUCHBASE_CAPI_SUBDOC_HH

#include <cstddef>
#include <cstdint>
#include <chrono>

#include "key_value_error_context.hh"

/**
 * @private
 */
enum class subdoc_opcode {
    undefined = 0,

    /* Retrieve the value for a path */
    get = 1,

    /* Check if the value for a path exists. If the path exists then the error code will be @ref LCB_SUCCESS */
    exist,

    /* Replace the value at the specified path. This operation can work on any existing and valid path. */
    replace,

    /* Add the value at the given path, if the given path does not exist. The penultimate path component must point to
     * an array. The operation may be used in conjunction with @ref subdoc_spec_options::create_parents to create the
     * parent dictionary (and its parents as well) if it does not yet exist. */
    dict_add,

    /* Unconditionally set the value at the path. This logically attempts to perform a @ref reaplace, and if it fails,
       performs an @ref dict_add. */
    dict_upsert,

    /* Prepend the value(s) to the array indicated by the path. The path should reference an array. When the @ref
     * subdoc_spec_options::create_parents flag is specified then the array may be created if it does not exist.
     *
     * Note that it is possible to add more than a single value to an array in an operation (this is valid for this
     * command as well as @ref array_add_last and @ref array_insert). Multiple items can be specified by placing a comma
     * between then (the values should otherwise be valid JSON). */
    array_add_first,

    /* Identical to @ref array_add_first but places the item(s) at the end of the array rather than at the beginning. */
    array_add_last,

    /* Add the value to the array indicated by the path, if the value is not already in the array. The @ref
     * subdoc_spec_options::create_parents flag can be specified to create the array if it does not already exist.
     *
     * Currently the value for this operation must be a JSON primitive (i.e. no arrays or dictionaries) and the existing
     * array itself must also contain only primitives (otherwise a @ref LCB_ERR_SUBDOC_PATH_MISMATCH error will be
     * received). */
    array_add_unique,

    /* Add the value at the given array index. Unlike other array operations, the path specified should include the
     * actual index at which the item(s) should be placed, for example `array[2]` will cause the value(s) to be the 3rd
     * item(s) in the array.
     *
     * The array must already exist and the @ref subdoc_options::create_parents flag is not honored. */
    array_insert,

    /* Increment or decrement an existing numeric path. If the number does not exist, it will be created (though its
     * parents will not, unless @ref subdoc_spec_options::create_parents is specified).
     *
     * The value for this operation should be a valid JSON-encoded integer and must be between `INT64_MIN` and
     * `INT64_MAX`, inclusive. */
    counter,

    /* Remove an existing path in the document. */
    remove,

    /* Count the number of elements in an array or dictionary */
    get_count,

    /* Retrieve the entire document */
    get_fulldoc,

    /* Replace the entire document */
    set_fulldoc,

    /* Remove the entire document */
    remove_fulldoc,
};

struct subdoc_spec_options {
    /* Create intermediate paths */
    bool create_parents{false};

    /* Access document XATTR path */
    bool xattr{false};

    /* Access document virtual/materialized path. Implies F_XATTRPATH */
    bool expand_macros{false};
};

/**
 * @brief Subdoc command specification.
 * This structure describes an operation and its path, and possibly its value.
 * This structure is provided in an array to the lcb_CMDSUBDOC::specs field.
 */
struct subdoc_spec {
    bool is_lookup() const
    {
        return opcode_ == subdoc_opcode::get || opcode_ == subdoc_opcode::get_count ||
               opcode_ == subdoc_opcode::get_fulldoc || opcode_ == subdoc_opcode::exist;
    }

    subdoc_opcode opcode() const
    {
        return opcode_;
    }

    lcb_STATUS opcode(subdoc_opcode opcode)
    {
        opcode_ = opcode;
        return LCB_SUCCESS;
    }

    const subdoc_spec_options &options() const
    {
        return options_;
    }

    lcb_STATUS options(std::uint32_t flags)
    {
        options_ = {};
        if (flags & LCB_SUBDOCSPECS_F_MKINTERMEDIATES) {
            options_.create_parents = true;
        }
        if (flags & LCB_SUBDOCSPECS_F_XATTRPATH) {
            options_.xattr = true;
        }
        if (flags & LCB_SUBDOCSPECS_F_XATTR_MACROVALUES) {
            options_.expand_macros = true;
        }
        return LCB_SUCCESS;
    }

    const std::string &path() const
    {
        return path_;
    }

    void clear_path()
    {
        path_.clear();
    }

    lcb_STATUS path(std::string path)
    {
        path_ = std::move(path);
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

    lcb_STATUS value(std::int64_t value)
    {
        value_ = std::to_string(value);
        return LCB_SUCCESS;
    }

  private:
    subdoc_opcode opcode_{subdoc_opcode::undefined};
    subdoc_spec_options options_{};

    std::string path_{};
    std::string value_{};
};

#define LCB_SDMULTI_MODE_INVALID 0
#define LCB_SDMULTI_MODE_LOOKUP 1
#define LCB_SDMULTI_MODE_MUTATE 2

struct subdoc_options {
    /* This command flag should be used if the document is to be created if it does not exist. */
    bool upsert_document{false};

    /* This command flag should be used if the document must be created anew. In this case, it will fail if it already
     * exists */
    bool insert_document{false};

    /* Access a potentially deleted document */
    bool access_deleted{false};

    bool create_as_deleted{false};
};

struct lcb_SUBDOCSPECS_ {
  public:
    std::vector<subdoc_spec> &specs()
    {
        return specs_;
    }

    const std::vector<subdoc_spec> &specs() const
    {
        return specs_;
    }

    bool is_lookup() const
    {
        return specs_.empty() || specs_[0].is_lookup();
    }

  private:
    std::vector<subdoc_spec> specs_{};
};

struct lcb_CMDSUBDOC_ {
    const std::string &operation_name() const
    {
        static std::string lookup_in_name = LCBTRACE_OP_LOOKUPIN;
        static std::string mutate_in_name = LCBTRACE_OP_MUTATEIN;
        return specs_.is_lookup() ? lookup_in_name : mutate_in_name;
    }

    const subdoc_options &options() const
    {
        return options_;
    }

    lcb_STATUS store_semantics(lcb_SUBDOC_STORE_SEMANTICS mode)
    {
        if (cas_ != 0 && (mode == LCB_SUBDOC_STORE_UPSERT || mode == LCB_SUBDOC_STORE_INSERT)) {
            return LCB_ERR_INVALID_ARGUMENT;
        }

        switch (mode) {
            case LCB_SUBDOC_STORE_REPLACE:
                /* replace is default, does not require setting the flags */
                options_.insert_document = options_.upsert_document = false;
                break;
            case LCB_SUBDOC_STORE_UPSERT:
                options_.insert_document = false;
                options_.upsert_document = true;
                break;
            case LCB_SUBDOC_STORE_INSERT:
                options_.insert_document = true;
                options_.upsert_document = false;
                break;
            default:
                return LCB_ERR_INVALID_ARGUMENT;
        }
        return LCB_SUCCESS;
    }

    lcb_STATUS access_deleted(bool enabled)
    {
        options_.access_deleted = enabled;
        return LCB_SUCCESS;
    }

    lcb_STATUS create_as_deleted(bool enabled)
    {
        options_.create_as_deleted = enabled;
        return LCB_SUCCESS;
    }

    const lcb_SUBDOCSPECS &specs() const
    {
        return specs_;
    }

    lcb_STATUS specs(const lcb_SUBDOCSPECS *operations)
    {
        if (operations == nullptr || operations->specs().empty()) {
            return LCB_ERR_INVALID_ARGUMENT;
        }
        specs_ = *operations;
        return LCB_SUCCESS;
    }

    std::uint32_t expiry() const
    {
        return expiry_;
    }

    bool has_expiry() const
    {
        return expiry_ != 0;
    }

    lcb_STATUS expiry(std::uint32_t expiry)
    {
        expiry_ = expiry;
        return LCB_SUCCESS;
    }

    std::uint64_t cas() const
    {
        return cas_;
    }

    lcb_STATUS cas(std::uint64_t cas)
    {
        if (options_.insert_document || options_.upsert_document) {
            return LCB_ERR_INVALID_ARGUMENT;
        }
        cas_ = cas;
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

    lcb_STATUS key(std::string key)
    {
        key_ = std::move(key);
        return LCB_SUCCESS;
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

    lcb_STATUS durability_level(lcb_DURABILITY_LEVEL level)
    {
        durability_level_ = level;
        return LCB_SUCCESS;
    }

    bool has_durability_requirements() const
    {
        return durability_level_ != LCB_DURABILITYLEVEL_NONE;
    }

    lcb_DURABILITY_LEVEL durability_level() const
    {
        return durability_level_;
    }

    lcb_STATUS preserve_expiry(bool preserve)
    {
        preserve_expiry_ = preserve;
        return LCB_SUCCESS;
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
    std::uint32_t expiry_{0};
    lcbtrace_SPAN *parent_span_{nullptr};
    void *cookie_{nullptr};
    std::string key_{};
    std::uint64_t cas_{0};
    lcb_DURABILITY_LEVEL durability_level_{LCB_DURABILITYLEVEL_NONE};
    subdoc_options options_{};
    lcb_SUBDOCSPECS_ specs_{};
    bool preserve_expiry_{false};
    std::string impostor_{};
    std::vector<std::string> extra_privileges_{};
};

/**
 * Structure for a single sub-document mutation or lookup result.
 * Note that #value and #nvalue are only valid if #status is ::LCB_SUCCESS
 */
struct lcb_SDENTRY {
    /** Value for the mutation (only applicable for ::LCB_SDCMD_COUNTER, currently) */
    const void *value;
    /** Length of the value */
    std::size_t nvalue;
    /** Status code */
    lcb_STATUS status;

    /**
     * Request index which this result pertains to. This field only
     * makes sense for multi mutations where not all request specs are returned
     * in the result
     */
    std::uint8_t index;
};

/**
 * Response structure for multi lookups. If the top level response is successful
 * then the individual results may be retrieved using lcb_sdmlookup_next()
 */
struct lcb_RESPSUBDOC_ {
    lcb_KEY_VALUE_ERROR_CONTEXT ctx{};
    lcb_MUTATION_TOKEN mt{};
    /**
     Application-defined pointer passed as the `cookie` parameter when
     scheduling the command.
     */
    void *cookie;
    /** Response specific flags. see ::lcb_RESPFLAGS */
    std::uint16_t rflags;

    const void *responses;
    /** Use with lcb_backbuf_ref/unref */
    void *bufh;
    std::size_t nres;
    lcb_SDENTRY *res;
};

#endif // LIBCOUCHBASE_CAPI_SUBDOC_HH
