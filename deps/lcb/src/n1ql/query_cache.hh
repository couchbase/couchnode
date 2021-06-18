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

#ifndef LIBCOUCHBASE_N1QL_QUERY_CACHE_HH
#define LIBCOUCHBASE_N1QL_QUERY_CACHE_HH

#include <cstddef>
#include <cstdint>
#include <chrono>
#include <string>
#include <map>
#include <list>

#include "contrib/lcb-jsoncpp/lcb-jsoncpp.h"

class Plan
{
  private:
    friend struct lcb_QUERY_CACHE_;
    std::string key;
    std::string planstr;
    explicit Plan(std::string k) : key(std::move(k)) {}

  public:
    /**
     * Applies the plan to the output 'bodystr'. We don't assign the
     * Json::Value directly, as this appears to be horribly slow. On my system
     * an assignment took about 200ms!
     * @param body The request body (e.g. lcb_QUERY_HANDLE_::json)
     * @param[out] bodystr the actual request payload
     */
    void apply_plan(Json::Value &body, std::string &bodystr) const
    {
        body.removeMember("statement");
        bodystr = Json::FastWriter().write(body);

        // Assume bodystr ends with '}'
        size_t pos = bodystr.rfind('}');
        bodystr.erase(pos);

        if (!body.empty()) {
            bodystr.append(",");
        }
        bodystr.append(planstr);
        bodystr.append("}");
    }

  private:
    /**
     * Assign plan data to this entry
     * @param plan The JSON returned from the PREPARE request
     */
    void set_plan(const Json::Value &plan, bool include_encoded_plan)
    {
        // Set the plan as a string
        planstr = "\"prepared\":";
        planstr += Json::FastWriter().write(plan["name"]);
        if (include_encoded_plan) {
            planstr += ",";
            planstr += "\"encoded_plan\":";
            planstr += Json::FastWriter().write(plan["encoded_plan"]);
        }
    }
};

/**
 * @private
 */
// LRU Cache structure..
struct lcb_QUERY_CACHE_ {
    ~lcb_QUERY_CACHE_()
    {
        clear();
    }

    /** Maximum number of entries in LRU cache. This is fixed at 5000 */
    static size_t max_size()
    {
        return 5000;
    }

    /**
     * Adds an entry for a given key
     * @param key The key to add
     * @param json The prepared statement returned by the server
     * @return the newly added plan.
     */
    const Plan &add_entry(const std::string &key, const Json::Value &json, bool include_encoded_plan = true)
    {
        if (lru.size() == max_size()) {
            // Purge entry from end
            remove_entry(lru.back()->key);
        }

        // Remove old entry, if present
        remove_entry(key);

        lru.push_front(new Plan(key));
        by_name[key] = lru.begin();
        lru.front()->set_plan(json, include_encoded_plan);
        return *lru.front();
    }

    /**
     * Gets the entry for a given key
     * @param key The statement (key) to look up
     * @return a pointer to the plan if present, nullptr if no entry exists for key
     */
    const Plan *get_entry(const std::string &key)
    {
        auto m = by_name.find(key);
        if (m == by_name.end()) {
            return nullptr;
        }

        const Plan *cur = *m->second;

        // Update LRU:
        lru.splice(lru.begin(), lru, m->second);
        // Note, updating of iterators is not required since splice doesn't
        // invalidate iterators.
        return cur;
    }

    /** Removes an entry with the given key */
    void remove_entry(const std::string &key)
    {
        auto m = by_name.find(key);
        if (m == by_name.end()) {
            return;
        }
        // Remove entry from map
        auto m2 = m->second;
        delete *m2;
        by_name.erase(m);
        lru.erase(m2);
    }

    /** Clears the LRU cache */
    void clear()
    {
        for (auto &ii : lru) {
            delete ii;
        }
        lru.clear();
        by_name.clear();
    }

  private:
    std::list<Plan *> lru;
    std::map<std::string, decltype(lru)::iterator> by_name;
};

#endif // LIBCOUCHBASE_N1QL_QUERY_CACHE_HH
