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

#ifndef LIBCOUCHBASE_CAPI_COLLECTION_QUALIFIER_HH
#define LIBCOUCHBASE_CAPI_COLLECTION_QUALIFIER_HH

#include <cstddef>
#include <cstdint>
#include <string>
#include <stdexcept>

namespace lcb
{
/**
 * @private
 */
struct collection_qualifier {
    collection_qualifier() = default;

    collection_qualifier(const char *scope_name, std::size_t scope_name_len, const char *collection_name,
                         std::size_t collection_name_len)
    {
        if (!is_valid_collection_element(scope_name, scope_name_len)) {
            throw std::invalid_argument("invalid scope name");
        }
        if (!is_valid_collection_element(collection_name, collection_name_len)) {
            throw std::invalid_argument("invalid collection name");
        }

        if (scope_name != nullptr && scope_name_len > 0) {
            scope_.assign(scope_name, scope_name_len);
        }
        if (collection_name != nullptr && collection_name_len > 0) {
            collection_.assign(collection_name, collection_name_len);
        }

        spec_ = (scope_.empty() ? "_default" : scope_) +
                '.' +
                (collection_.empty() ? "_default" : collection_);
    }

    const std::string &scope() const
    {
        return scope_;
    }

    const std::string &collection() const
    {
        return collection_;
    }

    bool has_default_scope() const
    {
        return scope_.empty() || scope_ == "_default";
    }

    bool is_default_collection() const
    {
        return has_default_scope() && (collection_.empty() || collection_ == "_default");
    }

    bool is_resolved() const
    {
        return resolved_;
    }

    std::uint32_t collection_id() const
    {
        return resolved_collection_id_;
    }

    void collection_id(std::uint32_t id)
    {
        resolved_collection_id_ = id;
        resolved_ = true;
    }

    const std::string &spec() const
    {
        return spec_;
    }

  private:
    static bool is_valid_collection_char(char ch)
    {
        if (ch >= 'A' && ch <= 'Z') {
            return true;
        }
        if (ch >= 'a' && ch <= 'z') {
            return true;
        }
        if (ch >= '0' && ch <= '9') {
            return true;
        }
        switch (ch) {
            case '_':
            case '-':
            case '%':
                return true;
            default:
                return false;
        }
    }

    static bool is_valid_collection_element(const char *element, size_t element_len)
    {
        if (element_len == 0 || element == nullptr) {
            /* nullptr/0 for collection is mapped to default collection */
            return true;
        }
        if (element_len < 1 || element_len > 30) {
            return false;
        }
        for (size_t i = 0; i < element_len; ++i) {
            if (!is_valid_collection_char(element[i])) {
                return false;
            }
        }
        return true;
    }

    std::string scope_{"_default"};
    std::string collection_{"_default"};
    std::string spec_{};
    std::uint32_t resolved_collection_id_{0};
    bool resolved_{false};
};
} // namespace lcb

#endif // LIBCOUCHBASE_CAPI_COLLECTION_QUALIFIER_HH
