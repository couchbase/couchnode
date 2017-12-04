/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2015-2017 Couchbase, Inc.
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

#include <libcouchbase/couchbase.h>
#include <libcouchbase/n1ql.h>
#include <libcouchbase/vbucket.h>
#include "contrib/lcb-jsoncpp/lcb-jsoncpp.h"
#include <string>

#define SCANVEC_NONE 0
#define SCANVEC_PARTIAL 1
#define SCANVEC_FULL 2

struct lcb_N1QLPARAMS_st {
    Json::Value root;
    std::string encoded;

    lcb_N1QLPARAMS_st() : root(Json::objectValue) {
    }
};

extern "C" {
static size_t get_strlen(const char *s, size_t n)
{
    if (n == (size_t)-1) {
        return strlen(s);
    } else {
        return n;
    }
}

static lcb_error_t
setopt(lcb_N1QLPARAMS *params, const char *k, size_t nk, const char *v, size_t nv)
{
    nv = get_strlen(v, nv);
    nk = get_strlen(k, nk);
    Json::Reader rdr;
    Json::Value value;
    bool rv = rdr.parse(v, v + nv, value);
    if (!rv) {
        return LCB_EINVAL;
    }

    params->root[std::string(k, nk)] = value;
    return LCB_SUCCESS;
}

lcb_error_t
lcb_n1p_setopt(lcb_N1QLPARAMS *params,
    const char *k, size_t nk, const char *v, size_t nv)
{
    return setopt(params, k, nk, v, nv);
}

lcb_error_t
lcb_n1p_setquery(lcb_N1QLPARAMS *params,
    const char *qstr, size_t nqstr, int type)
{
    if (type == LCB_N1P_QUERY_STATEMENT) {
        size_t nstmt = get_strlen(qstr, nqstr);
        params->root["statement"] = std::string(qstr, nstmt);
        return LCB_SUCCESS;
    } else if (type == LCB_N1P_QUERY_PREPARED) {
        return lcb_n1p_setopt(params, "prepared", -1, qstr, nqstr);
    } else {
        return LCB_EINVAL;
    }
}

lcb_error_t
lcb_n1p_namedparam(lcb_N1QLPARAMS *params,
    const char *name, size_t nname, const char *value, size_t nvalue)
{
    return lcb_n1p_setopt(params, name, nname, value, nvalue);
}

lcb_error_t
lcb_n1p_posparam(lcb_N1QLPARAMS *params, const char *value, size_t nvalue)
{
    nvalue = get_strlen(value, nvalue);
    Json::Value jval;
    Json::Reader rdr;
    if (!rdr.parse(value, value + nvalue, jval)) {
        return LCB_EINVAL;
    }
    params->root["args"].append(jval);
    return LCB_SUCCESS;
}

lcb_error_t
lcb_n1p_readonly(lcb_N1QLPARAMS *params, int readonly)
{
    params->root["readonly"] = readonly ? true : false;
    return LCB_SUCCESS;
}

lcb_error_t
lcb_n1p_scancap(lcb_N1QLPARAMS *params, int scancap)
{
    params->root["scan_cap"] = Json::valueToString(scancap);
    return LCB_SUCCESS;
}

lcb_error_t
lcb_n1p_pipelinecap(lcb_N1QLPARAMS *params, int pipelinecap)
{
    params->root["pipeline_cap"] = Json::valueToString(pipelinecap);
    return LCB_SUCCESS;
}

lcb_error_t
lcb_n1p_pipelinebatch(lcb_N1QLPARAMS *params, int pipelinebatch)
{
    params->root["pipeline_batch"] = Json::valueToString(pipelinebatch);
    return LCB_SUCCESS;
}

static void
encode_mutation_token(Json::Value& sparse, const lcb_MUTATION_TOKEN *sv)
{
    char buf[64] = { 0 };
    sprintf(buf, "%u", sv->vbid_);
    Json::Value& cur_sv = sparse[buf];

    cur_sv[0] = static_cast<Json::UInt64>(sv->seqno_);
    sprintf(buf, "%llu", (unsigned long long)sv->uuid_);
    cur_sv[1] = buf;
}

lcb_error_t
lcb_n1p_setconsistent_token(lcb_N1QLPARAMS *params,
    const char *keyspace, const lcb_MUTATION_TOKEN *sv)
{
    if (!LCB_MUTATION_TOKEN_ISVALID(sv)) {
        return LCB_EINVAL;
    }

    params->root["scan_consistency"] = "at_plus";
    encode_mutation_token(params->root["scan_vectors"][keyspace], sv);
    return LCB_SUCCESS;
}

lcb_error_t
lcb_n1p_setconsistent_handle(lcb_N1QLPARAMS *params, lcb_t instance)
{
    lcbvb_CONFIG *vbc;
    lcb_error_t rc = lcb_cntl(instance, LCB_CNTL_GET, LCB_CNTL_VBCONFIG, &vbc);
    if (rc != LCB_SUCCESS) {
        return rc;
    }

    const char *bucketname;
    rc = lcb_cntl(instance, LCB_CNTL_GET, LCB_CNTL_BUCKETNAME, &bucketname);
    if (rc != LCB_SUCCESS) {
        return rc;
    }

    Json::Value* sv_json = NULL;

    size_t vbmax = vbc->nvb;
    for (size_t ii = 0; ii < vbmax; ++ii) {
        lcb_KEYBUF kb;
        kb.type = LCB_KV_VBID;
        kb.contig.nbytes = ii;
        kb.contig.bytes = NULL;
        const lcb_MUTATION_TOKEN *mt = lcb_get_mutation_token(instance, &kb, &rc);
        if (rc == LCB_SUCCESS && mt != NULL) {
            if (sv_json == NULL) {
                sv_json = &params->root["scan_vectors"][bucketname];
                params->root["scan_consistency"] = "at_plus";
            }
            encode_mutation_token(*sv_json, mt);
        }
    }

    if (!sv_json) {
        return LCB_KEY_ENOENT;
    }

    return LCB_SUCCESS;
}

lcb_error_t
lcb_n1p_setconsistency(lcb_N1QLPARAMS *params, int mode)
{
    if (mode == LCB_N1P_CONSISTENCY_NONE) {
        params->root.removeMember("scan_consistency");
    } else if (mode == LCB_N1P_CONSISTENCY_REQUEST) {
        params->root["scan_consistency"] = "request_plus";
    } else if (mode == LCB_N1P_CONSISTENCY_STATEMENT) {
        params->root["scan_consistency"] = "statement_plus";
    }
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API
const char *
lcb_n1p_encode(lcb_N1QLPARAMS *params, lcb_error_t *err)
{
    lcb_error_t err_s = LCB_SUCCESS;
    if (!err) {
        err = &err_s;
    }

    *err = LCB_SUCCESS;
    /* Build the query */
    Json::FastWriter w;
    params->encoded = w.write(params->root);
    return params->encoded.c_str();
}

LIBCOUCHBASE_API
lcb_error_t
lcb_n1p_mkcmd(lcb_N1QLPARAMS *params, lcb_CMDN1QL *cmd)
{
    lcb_error_t rc = LCB_SUCCESS;
    lcb_n1p_encode(params, &rc);
    if (rc != LCB_SUCCESS) {
        return rc;
    }
    cmd->content_type = "application/json";
    cmd->query = params->encoded.c_str();
    cmd->nquery = params->encoded.size();
    return LCB_SUCCESS;
}

lcb_N1QLPARAMS *
lcb_n1p_new(void)
{
    return new lcb_N1QLPARAMS;
}

void
lcb_n1p_reset(lcb_N1QLPARAMS *params)
{
    params->encoded.clear();
    params->root.clear();
}

void
lcb_n1p_free(lcb_N1QLPARAMS *params)
{
    delete params;
}

} // extern C
