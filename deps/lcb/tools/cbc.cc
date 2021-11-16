/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2011-2020 Couchbase, Inc.
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

#define NOMINMAX
#include <map>
#include <vector>
#include <array>
#include <iostream>
#include <iomanip>
#include <algorithm>
#include <limits>
#include <cstddef>
#include <cerrno>
#ifdef _WIN32
#ifndef sleep
#define sleep(interval) Sleep((interval)*1000)
#endif
#else
#include <unistd.h>
#endif
#include "common/options.h"
#include "common/histogram.h"
#include "cbc-handlers.h"
#include "connspec.h"
#include "rnd.h"
#include "contrib/lcb-jsoncpp/lcb-jsoncpp.h"
#include <libcouchbase/vbucket.h>
#include <libcouchbase/utils.h>

#ifndef LCB_NO_SSL
#include <openssl/crypto.h>
#endif
#include <snappy-stubs-public.h>
#include "internalstructs.h"
#include "internal.h"
#include "capi/cmd_observe.hh"
#include "capi/cmd_observe_seqno.hh"

using namespace cbc;

using std::map;
using std::string;
using std::stringstream;
using std::vector;

static void printKeyError(lcb_STATUS rc, const lcb_KEY_VALUE_ERROR_CONTEXT *ctx, const char *additional = nullptr)
{
    const char *key;
    size_t nkey;
    lcb_errctx_kv_key(ctx, &key, &nkey);
    fprintf(stderr, "%-20.*s %s\n", (int)nkey, key, lcb_strerror_short(rc));

    const char *val = nullptr;
    size_t nval;
    lcb_errctx_kv_ref(ctx, &val, &nval);
    if (val != nullptr) {
        fprintf(stderr, "%-20s Ref: %.*s", "", (int)nval, val);
    }
    lcb_errctx_kv_context(ctx, &val, &nval);
    if (val != nullptr) {
        fprintf(stderr, "%-20s Context: %.*s\n", "", (int)nval, val);
    }
    if (additional) {
        fprintf(stderr, "%-20s %s\n", "", additional);
    }
}

extern "C" {
static void get_callback(lcb_INSTANCE *, lcb_CALLBACK_TYPE, const lcb_RESPGET *resp)
{
    const char *p;
    size_t n;
    lcb_respget_key(resp, &p, &n);
    string key(p, n);
    lcb_STATUS rc = lcb_respget_status(resp);
    if (rc == LCB_SUCCESS) {
        const char *value;
        size_t nvalue;
        uint32_t flags;
        uint64_t cas;
        uint8_t datatype;

        lcb_respget_value(resp, &value, &nvalue);
        lcb_respget_flags(resp, &flags);
        lcb_respget_cas(resp, &cas);
        lcb_respget_datatype(resp, &datatype);
        fprintf(stderr, "%-20s CAS=0x%" PRIx64 ", Flags=0x%x, Size=%lu, Datatype=0x%02x", key.c_str(), cas, flags,
                (unsigned long)nvalue, (int)datatype);
        if (datatype) {
            int nflags = 0;
            fprintf(stderr, "(");
            if (datatype & LCB_VALUE_F_JSON) {
                fprintf(stderr, "JSON");
                nflags++;
            }
            if (datatype & LCB_VALUE_F_SNAPPYCOMP) {
                fprintf(stderr, "%sSNAPPY", nflags > 0 ? "," : "");
                nflags++;
            }
            fprintf(stderr, ")");
        }
        fprintf(stderr, "\n");
        fflush(stderr);
        fwrite(value, 1, nvalue, stdout);
        fflush(stdout);
        fprintf(stderr, "\n");
    } else {
        const lcb_KEY_VALUE_ERROR_CONTEXT *ctx;
        lcb_respget_error_context(resp, &ctx);
        printKeyError(rc, ctx);
    }
}

static void getreplica_callback(lcb_INSTANCE *, lcb_CALLBACK_TYPE, const lcb_RESPGETREPLICA *resp)
{
    const char *p;
    size_t n;
    lcb_respgetreplica_key(resp, &p, &n);
    string key(p, n);
    lcb_STATUS rc = lcb_respgetreplica_status(resp);
    if (rc == LCB_SUCCESS) {
        const char *value;
        size_t nvalue;
        uint32_t flags;
        uint64_t cas;
        uint8_t datatype;

        lcb_respgetreplica_value(resp, &value, &nvalue);
        lcb_respgetreplica_flags(resp, &flags);
        lcb_respgetreplica_cas(resp, &cas);
        lcb_respgetreplica_datatype(resp, &datatype);
        fprintf(stderr, "%-20s CAS=0x%" PRIx64 ", Flags=0x%x, Size=%lu, Datatype=0x%02x", key.c_str(), cas, flags,
                (unsigned long)nvalue, (int)datatype);
        if (datatype) {
            int nflags = 0;
            fprintf(stderr, "(");
            if (datatype & LCB_VALUE_F_JSON) {
                fprintf(stderr, "JSON");
                nflags++;
            }
            if (datatype & LCB_VALUE_F_SNAPPYCOMP) {
                fprintf(stderr, "%sSNAPPY", nflags > 0 ? "," : "");
                nflags++;
            }
            fprintf(stderr, ")");
        }
        fprintf(stderr, "\n");
        fflush(stderr);
        fwrite(value, 1, nvalue, stdout);
        fflush(stdout);
        fprintf(stderr, "\n");
    } else {
        const lcb_KEY_VALUE_ERROR_CONTEXT *ctx;
        lcb_respgetreplica_error_context(resp, &ctx);
        printKeyError(rc, ctx);
    }
}

static void storePrintSuccess(const lcb_RESPSTORE *resp, const char *message = nullptr)
{
    const char *key;
    size_t nkey;

    lcb_respstore_key(resp, &key, &nkey);
    fprintf(stderr, "%-20.*s ", (int)nkey, key);
    if (message != nullptr) {
        fprintf(stderr, "%s ", message);
    }

    uint64_t cas;
    lcb_respstore_cas(resp, &cas);
    fprintf(stderr, "CAS=0x%" PRIx64 "\n", cas);

    lcb_MUTATION_TOKEN token = {0};
    lcb_respstore_mutation_token(resp, &token);
    if (lcb_mutation_token_is_valid(&token)) {
        fprintf(stderr, "%-20s SYNCTOKEN=%u,%" PRIu64 ",%" PRIu64 "\n", "", token.vbid_, token.uuid_, token.seqno_);
    }
}

static void storePrintError(const lcb_RESPSTORE *resp, const char *message = nullptr)
{
    size_t sz = 0;
    const char *key;

    lcb_respstore_key(resp, &key, &sz);
    fprintf(stderr, "%-20.*s %s\n", (int)sz, key, lcb_strerror_short(lcb_respstore_status(resp)));

    const lcb_KEY_VALUE_ERROR_CONTEXT *ctx = nullptr;
    lcb_respstore_error_context(resp, &ctx);
    const char *context, *ref;
    size_t ncontext, nref;
    lcb_errctx_kv_context(ctx, &context, &ncontext);
    lcb_errctx_kv_ref(ctx, &ref, &nref);
    if (context != nullptr) {
        fprintf(stderr, "%-20s %.*s\n", "", (int)ncontext, context);
    }
    if (ref != nullptr) {
        fprintf(stderr, "%-20s Ref: %.*s\n", "", (int)nref, ref);
    }

    if (message) {
        fprintf(stderr, "%-20s %s\n", "", message);
    }
}

static void store_callback(lcb_INSTANCE *, lcb_CALLBACK_TYPE, const lcb_RESPSTORE *resp)
{
    lcb_STATUS rc = lcb_respstore_status(resp);

    if (lcb_respstore_observe_attached(resp)) {
        // Storage with durability
        char buf[4096];
        uint16_t npersisted, nreplicated;
        lcb_respstore_observe_num_persisted(resp, &npersisted);
        lcb_respstore_observe_num_replicated(resp, &nreplicated);
        if (rc == LCB_SUCCESS) {
            sprintf(buf, "Stored. Persisted(%u). Replicated(%u)", npersisted, nreplicated);
            storePrintSuccess(resp, buf);
        } else {
            int store_ok;
            lcb_respstore_observe_stored(resp, &store_ok);
            if (store_ok) {
                sprintf(buf, "Store OK, but durability failed. Persisted(%u). Replicated(%u)", npersisted, nreplicated);
            } else {
                sprintf(buf, "%s", "Store failed");
            }
            storePrintError(resp, buf);
        }
    } else {
        if (rc == LCB_SUCCESS) {
            storePrintSuccess(resp, "Stored.");
        } else {
            storePrintError(resp);
        }
    }
}

static void exists_callback(lcb_INSTANCE *, int, const lcb_RESPEXISTS *resp)
{
    const char *p;
    size_t n;

    lcb_respexists_key(resp, &p, &n);
    string key(p, n);

    lcb_STATUS rc = lcb_respexists_status(resp);
    if (rc != LCB_SUCCESS) {
        const lcb_KEY_VALUE_ERROR_CONTEXT *ctx;
        lcb_respexists_error_context(resp, &ctx);
        printKeyError(rc, ctx);
        return;
    }
    if (lcb_respexists_is_found(resp)) {
        uint64_t cas;
        lcb_respexists_cas(resp, &cas);
        fprintf(stderr, "%-20s FOUND, CAS=0x%" PRIx64 "\n", key.c_str(), cas);
    } else {
        fprintf(stderr, "%-20s NOT FOUND\n", key.c_str());
    }
}

static void unlock_callback(lcb_INSTANCE *, lcb_CALLBACK_TYPE, const lcb_RESPUNLOCK *resp)
{
    const char *p;
    size_t n;

    lcb_respunlock_key(resp, &p, &n);
    string key(p, n);

    lcb_STATUS rc = lcb_respunlock_status(resp);
    if (rc != LCB_SUCCESS) {
        const lcb_KEY_VALUE_ERROR_CONTEXT *ctx;
        lcb_respunlock_error_context(resp, &ctx);
        printKeyError(rc, ctx);
        return;
    }
    fprintf(stderr, "%-20s Unlocked\n", key.c_str());
}

static void remove_callback(lcb_INSTANCE *, lcb_CALLBACK_TYPE, const lcb_RESPREMOVE *resp)
{
    const char *p;
    size_t n;

    lcb_respremove_key(resp, &p, &n);
    string key(p, n);

    lcb_STATUS rc = lcb_respremove_status(resp);
    if (rc != LCB_SUCCESS) {
        const lcb_KEY_VALUE_ERROR_CONTEXT *ctx;
        lcb_respremove_error_context(resp, &ctx);
        printKeyError(rc, ctx);
        return;
    }
    fprintf(stderr, "%-20s Deleted\n", key.c_str());
}

static void touch_callback(lcb_INSTANCE *, lcb_CALLBACK_TYPE, const lcb_RESPTOUCH *resp)
{
    const char *p;
    size_t n;

    lcb_resptouch_key(resp, &p, &n);
    string key(p, n);

    lcb_STATUS rc = lcb_resptouch_status(resp);
    if (rc != LCB_SUCCESS) {
        const lcb_KEY_VALUE_ERROR_CONTEXT *ctx;
        lcb_resptouch_error_context(resp, &ctx);
        printKeyError(rc, ctx);
        return;
    }
    fprintf(stderr, "%-20s Touch\n", key.c_str());
}

static void observe_callback(lcb_INSTANCE *, lcb_CALLBACK_TYPE, const lcb_RESPOBSERVE *resp)
{
    if (resp->ctx.key.empty()) {
        return;
    }

    string key = resp->ctx.key;
    if (resp->ctx.rc == LCB_SUCCESS) {
        fprintf(stderr, "%-20s [%s] Status=0x%x, CAS=0x%" PRIx64 "\n", key.c_str(),
                resp->ismaster ? "Master" : "Replica", resp->status, resp->ctx.cas);
    } else {
        fprintf(stderr, "%-20s %s\n", key.c_str(), lcb_strerror_short(resp->ctx.rc));
    }
}

static void obseqno_callback(lcb_INSTANCE *, lcb_CALLBACK_TYPE, const lcb_RESPOBSEQNO *resp)
{
    int ix = resp->server_index;
    if (resp->ctx.rc != LCB_SUCCESS) {
        fprintf(stderr, "[%d] ERROR %s\n", ix, lcb_strerror_long(resp->ctx.rc));
        return;
    }
    lcb_U64 uuid, seq_disk, seq_mem;
    if (resp->old_uuid) {
        seq_disk = seq_mem = resp->old_seqno;
        uuid = resp->old_uuid;
    } else {
        uuid = resp->cur_uuid;
        seq_disk = resp->persisted_seqno;
        seq_mem = resp->mem_seqno;
    }
    fprintf(stderr, "[%d] UUID=0x%" PRIx64 ", Cache=%" PRIu64 ", Disk=%" PRIu64, ix, uuid, seq_mem, seq_disk);
    if (resp->old_uuid) {
        fprintf(stderr, "\n");
        fprintf(stderr, "    FAILOVER. New: UUID=%" PRIx64 ", Cache=%" PRIu64 ", Disk=%" PRIu64, resp->cur_uuid,
                resp->mem_seqno, resp->persisted_seqno);
    }
    fprintf(stderr, "\n");
}

static void stats_callback(lcb_INSTANCE *, lcb_CALLBACK_TYPE, const lcb_RESPSTATS *resp)
{
    lcb_STATUS rc = lcb_respstats_status(resp);
    if (rc != LCB_SUCCESS) {
        fprintf(stderr, "ERROR %s\n", lcb_strerror_short(rc));
        return;
    }
    const char *server;
    size_t server_len;
    lcb_respstats_server(resp, &server, &server_len);

    const char *key;
    size_t key_len;
    lcb_respstats_key(resp, &key, &key_len);

    if (server == nullptr || server_len == 0 || key == nullptr || key_len == 0) {
        return;
    }

    const char *value;
    size_t value_len;
    lcb_respstats_value(resp, &value, &value_len);

    fprintf(stdout, "%.*s\t%.*s", (int)server_len, server, (int)key_len, key);
    if (value && value_len > 0) {
        bool *is_keystats;
        lcb_respstats_cookie(resp, (void **)&is_keystats);
        if (*is_keystats && key_len == 9 && strncmp(key, "key_flags", key_len) == 0) {
            // Is keystats
            // Flip the bits so the display formats correctly
            unsigned flags_u = 0;
            sscanf(value, "%u", &flags_u);
            flags_u = htonl(flags_u);
            fprintf(stdout, "\t%u (cbc: converted via htonl)", flags_u);
        } else {
            fprintf(stdout, "\t%.*s", (int)value_len, value);
        }
    }
    fprintf(stdout, "\n");
}

static void watch_callback(lcb_INSTANCE *, lcb_CALLBACK_TYPE, const lcb_RESPSTATS *resp)
{
    lcb_STATUS rc = lcb_respstats_status(resp);
    if (rc != LCB_SUCCESS) {
        fprintf(stderr, "ERROR %s\n", lcb_strerror_short(rc));
        return;
    }
    const char *server;
    size_t server_len;
    lcb_respstats_server(resp, &server, &server_len);

    const char *key;
    size_t key_len;
    lcb_respstats_key(resp, &key, &key_len);

    if (server == nullptr || server_len == 0 || key == nullptr || key_len == 0) {
        return;
    }

    const char *value;
    size_t value_len;
    lcb_respstats_value(resp, &value, &value_len);

    string key_str(key, key_len);

    if (value && value_len > 0) {
        char *nptr = nullptr;
        uint64_t val =
#ifdef _WIN32
            _strtoi64
#else
            strtoll
#endif
            (value, &nptr, 10);
        if (nptr != value) {
            map<string, int64_t> *entry;
            lcb_respstats_cookie(resp, (void **)&entry);
            (*entry)[key_str] += val;
        }
    }
}

static void ping_callback(lcb_INSTANCE *, int, const lcb_RESPPING *resp)
{
    lcb_STATUS rc = lcb_respping_status(resp);
    if (rc != LCB_SUCCESS) {
        fprintf(stderr, "failed: %s\n", lcb_strerror_short(rc));
    } else {
        const char *json;
        size_t njson;
        lcb_respping_value(resp, &json, &njson);
        while (njson > 1 && json[njson - 1] == '\n') {
            njson--;
        }
        if (njson) {
            printf("%.*s", (int)njson, json);
        }
    }
}

struct PingServiceRow {
    std::string type{};
    std::string id{};
    std::string status{};
    std::int64_t latency_us{};
    std::string remote{};
    std::string local{};
};

bool by_id(const PingServiceRow &lhs, const PingServiceRow &rhs)
{
    return lhs.id < rhs.id;
}

bool by_type(const PingServiceRow &lhs, const PingServiceRow &rhs)
{
    return lhs.type < rhs.type;
}

static void ping_table_callback(lcb_INSTANCE *, int, const lcb_RESPPING *resp)
{
    lcb_STATUS rc = lcb_respping_status(resp);
    if (rc != LCB_SUCCESS) {
        fprintf(stderr, "failed: %s\n", lcb_strerror_short(rc));
    } else {
        const char *json;
        size_t njson = 0;
        lcb_respping_value(resp, &json, &njson);
        if (njson == 0) {
            return;
        }
        std::string report_json(json, njson);
        Json::Value report;
        if (!Json::Reader().parse(report_json, report)) {
            return;
        }
        Json::Value services = report.get("services", Json::nullValue);
        if (services.isObject() && !services.empty()) {
            std::array<std::string, 6> column_headers{{"type", "id", "status", "latency, us", "remote", "local"}};
            std::array<std::size_t, 6> column_widths{};
            std::size_t col_idx = 0;
            for (const auto &header : column_headers) {
                column_widths[col_idx++] = header.size();
            }
            std::vector<PingServiceRow> rows;
            auto service_types = services.getMemberNames();
            for (const auto &type : service_types) {
                Json::Value service_entries = services.get(type, Json::nullValue);
                if (service_entries.isNull()) {
                    continue;
                }
                column_widths[0] = std::max(column_widths[0], type.size());
                for (const auto &service : service_entries) {
                    PingServiceRow row;
                    row.type = type;
                    Json::Value field = service.get("id", Json::nullValue);
                    if (field.isString()) {
                        row.id = field.asString();
                        column_widths[1] = std::max(column_widths[1], row.id.size());
                    }
                    field = service.get("status", Json::nullValue);
                    if (field.isString()) {
                        row.status = field.asString();
                        column_widths[2] = std::max(column_widths[2], row.status.size());
                    }
                    field = service.get("latency_us", Json::nullValue);
                    if (field.isNumeric()) {
                        row.latency_us = field.asInt64();
                        column_widths[3] = std::max(column_widths[3], std::to_string(row.latency_us).size());
                    }
                    field = service.get("remote", Json::nullValue);
                    if (field.isString()) {
                        row.remote = field.asString();
                        column_widths[4] = std::max(column_widths[4], row.remote.size());
                    }
                    field = service.get("local", Json::nullValue);
                    if (field.isString()) {
                        row.local = field.asString();
                        column_widths[5] = std::max(column_widths[5], row.local.size());
                    }
                    rows.emplace_back(row);
                }
            }
            std::stable_sort(rows.begin(), rows.end(), by_id);
            std::stable_sort(rows.begin(), rows.end(), by_type);
            size_t total_width = 1;
            for (col_idx = 0; col_idx < column_widths.size(); ++col_idx) {
                total_width += column_widths[col_idx] + 3;
            }

            std::stringstream out;
            for (size_t i = 0; i < total_width; ++i) {
                out << "-";
            }
            out << "\n";
            out << "|";
            col_idx = 0;
            for (const auto &header : column_headers) {
                out << " " << std::left << std::setw(column_widths[col_idx++]) << header << " |";
            }
            out << "\n";
            for (size_t i = 0; i < total_width; ++i) {
                out << "-";
            }
            out << "\n";
            for (const auto &row : rows) {
                out << "|";
                out << " " << std::left << std::setw(column_widths[0]) << row.type << " |";
                out << " " << std::left << std::setw(column_widths[1]) << row.id << " |";
                out << " " << std::left << std::setw(column_widths[2]) << row.status << " |";
                out << " " << std::right << std::setw(column_widths[3]) << row.latency_us << " |";
                out << " " << std::left << std::setw(column_widths[4]) << row.remote << " |";
                out << " " << std::left << std::setw(column_widths[5]) << row.local << " |";
                out << "\n";
            }
            for (size_t i = 0; i < total_width; ++i) {
                out << "-";
            }
            out << "\n";
            std::string table = out.str();
            fprintf(stderr, "%s\n", table.c_str());
        }
    }
}

static void arithmetic_callback(lcb_INSTANCE *, lcb_CALLBACK_TYPE, const lcb_RESPCOUNTER *resp)
{
    const char *p;
    size_t n;
    lcb_respcounter_key(resp, &p, &n);
    string key(p, n);
    lcb_STATUS rc = lcb_respcounter_status(resp);
    if (rc != LCB_SUCCESS) {
        const lcb_KEY_VALUE_ERROR_CONTEXT *ctx;
        lcb_respcounter_error_context(resp, &ctx);
        printKeyError(rc, ctx);
    } else {
        uint64_t value;
        lcb_respcounter_value(resp, &value);
        fprintf(stderr, "%-20s Current value is %" PRIu64 ".", key.c_str(), value);
        uint64_t cas;
        lcb_respcounter_cas(resp, &cas);
        fprintf(stderr, " CAS=0x%" PRIx64 "\n", cas);
        lcb_MUTATION_TOKEN token = {0};
        lcb_respcounter_mutation_token(resp, &token);
        if (lcb_mutation_token_is_valid(&token)) {
            fprintf(stderr, "%-20s SYNCTOKEN=%u,%" PRIu64 ",%" PRIu64 "\n", "", token.vbid_, token.uuid_, token.seqno_);
        }
    }
}

static void http_callback(lcb_INSTANCE *, int, const lcb_RESPHTTP *resp)
{
    HttpBaseHandler *ctx = nullptr;
    lcb_resphttp_cookie(resp, (void **)&ctx);
    ctx->maybeInvokeStatus(resp);

    const char *body;
    size_t nbody;
    lcb_resphttp_body(resp, &body, &nbody);
    if (nbody) {
        ctx->onChunk(body, nbody);
    }
    if (lcb_resphttp_is_final(resp)) {
        ctx->onDone();
    }
}

static void view_callback(lcb_INSTANCE *, int, const lcb_RESPVIEW *resp)
{
    if (lcb_respview_is_final(resp)) {
        fprintf(stderr, "---> View response finished\n");
    }

    lcb_STATUS rc = lcb_respview_status(resp);
    if (rc) {
        fprintf(stderr, "---> View failed with library code %s\n", lcb_strerror_short(rc));

        if (rc == LCB_ERR_HTTP) {
            const lcb_RESPHTTP *http;
            lcb_respview_http_response(resp, &http);
            if (http != nullptr) {
                HttpReceiver receiver;
                receiver.maybeInvokeStatus(http);
                const char *body;
                size_t nbody;
                lcb_resphttp_body(http, &body, &nbody);
                if (nbody) {
                    fprintf(stderr, "%.*s", (int)nbody, body);
                }
            }
        }
    }

    if (lcb_respview_is_final(resp)) {
        const char *value;
        size_t nvalue;
        lcb_respview_row(resp, &value, &nvalue);
        if (value) {
            fprintf(stderr, "Non-row data: %.*s\n", (int)nvalue, value);
        }
        const lcb_VIEW_ERROR_CONTEXT *ctx;
        lcb_respview_error_context(resp, &ctx);
        const char *ddoc, *view;
        size_t nddoc, nview;
        lcb_errctx_view_design_document(ctx, &ddoc, &nddoc);
        lcb_errctx_view_view(ctx, &view, &nview);
        fprintf(stderr, "---> View: %.*s/%.*s\n", (int)nddoc, ddoc, (int)nview, view);
        uint32_t code;
        lcb_errctx_view_http_response_code(ctx, &code);
        fprintf(stderr, "---> HTTP response code: %d\n", code);
        const char *err_code, *err_msg;
        size_t nerr_code, nerr_msg;
        lcb_errctx_view_first_error_code(ctx, &err_code, &nerr_code);
        if (nerr_code != 0) {
            fprintf(stderr, "---> First error code: %.*s\n", (int)nerr_code, err_code);
        }
        lcb_errctx_view_first_error_message(ctx, &err_msg, &nerr_msg);
        if (nerr_msg != 0) {
            fprintf(stderr, "---> First error message: %.*s\n", (int)nerr_msg, err_msg);
        }
        return;
    }

    const char *p;
    size_t n;

    lcb_respview_key(resp, &p, &n);
    printf("KEY: %.*s\n", (int)n, p);
    lcb_respview_row(resp, &p, &n);
    printf("     VALUE: %.*s\n", (int)n, p);
    lcb_respview_doc_id(resp, &p, &n);
    printf("     DOCID: %.*s\n", (int)n, p);
    const lcb_RESPGET *doc = nullptr;
    lcb_respview_document(resp, &doc);
    if (doc) {
        get_callback(nullptr, LCB_CALLBACK_GET, doc);
    }
}
}

Handler::Handler(const char *name) : parser(name)
{
    if (name != nullptr) {
        cmdname = name;
    }
}

Handler::~Handler()
{
    if (params.shouldDump()) {
        lcb_dump(instance, stderr, LCB_DUMP_ALL);
    }
    if (instance) {
        lcb_destroy(instance);
    }
}

void Handler::execute(int argc, char **argv)
{
    addOptions();
    parser.default_settings.argstring = usagestr();
    parser.default_settings.shortdesc = description();
    parser.parse(argc, argv, true);
    run();
    if (instance != nullptr && params.useTimings()) {
        fprintf(stderr, "Output command timings as requested (--timings)\n");
        hg.write();
    }
}

void Handler::addOptions()
{
    params.addToParser(parser);
}

void Handler::run()
{
    lcb_CREATEOPTS *cropts = nullptr;
    params.fillCropts(cropts);
    lcb_STATUS err;
    err = lcb_create(&instance, cropts);
    lcb_createopts_destroy(cropts);
    if (err != LCB_SUCCESS) {
        throw LcbError(err, "Failed to create instance");
    }
    params.doCtls(instance);
    err = lcb_connect(instance);
    if (err != LCB_SUCCESS) {
        throw LcbError(err, "Failed to connect instance");
    }
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    err = lcb_get_bootstrap_status(instance);
    if (err != LCB_SUCCESS) {
        throw LcbError(err, "Failed to bootstrap instance");
    }

    if (params.useTimings()) {
        hg.install(instance, stdout);
    }
}

const string &Handler::getLoneArg(bool required)
{
    static string empty;

    const vector<string> &args = parser.getRestArgs();
    if (args.empty() || args.size() != 1) {
        if (required) {
            throw std::runtime_error("Command requires single argument");
        }
        return empty;
    }
    return args[0];
}

void GetHandler::addOptions()
{
    Handler::addOptions();
    o_exptime.abbrev('e');
    if (isLock()) {
        o_exptime.description("Time the lock should be held for");
    } else {
        o_exptime.description("Update the expiration time for the item");
        o_replica.abbrev('r');
        o_replica.description("Read from replica. Possible values are 'first': read from first available replica. "
                              "'all': read from all replicas, and <N>, where 0 < N < nreplicas");
        parser.addOption(o_replica);
    }
    parser.addOption(o_exptime);
    parser.addOption(o_scope);
    parser.addOption(o_collection);
    parser.addOption(o_durability);
}

void GetHandler::run()
{
    Handler::run();
    lcb_install_callback(instance, LCB_CALLBACK_GET, (lcb_RESPCALLBACK)get_callback);
    lcb_install_callback(instance, LCB_CALLBACK_GETREPLICA, (lcb_RESPCALLBACK)getreplica_callback);
    const vector<string> &keys = parser.getRestArgs();
    std::string replica_mode = o_replica.result();
    std::string s = o_scope.result();
    std::string c = o_collection.result();

    lcb_sched_enter(instance);
    for (const auto &key : keys) {
        lcb_STATUS err;
        if (o_replica.passed()) {
            lcb_REPLICA_MODE mode;
            if (replica_mode == "first" || replica_mode == "any") {
                mode = LCB_REPLICA_MODE_ANY;
            } else if (replica_mode == "all") {
                mode = LCB_REPLICA_MODE_ALL;
            } else {
                switch (std::atoi(replica_mode.c_str())) {
                    case 0:
                        mode = LCB_REPLICA_MODE_IDX0;
                        break;
                    case 1:
                        mode = LCB_REPLICA_MODE_IDX1;
                        break;
                    case 2:
                        mode = LCB_REPLICA_MODE_IDX2;
                        break;
                    default:
                        throw LcbError(LCB_ERR_INVALID_ARGUMENT, "invalid replica mode");
                }
            }
            lcb_CMDGETREPLICA *cmd;
            lcb_cmdgetreplica_create(&cmd, mode);
            lcb_cmdgetreplica_key(cmd, key.c_str(), key.size());
            if (o_collection.passed()) {
                lcb_cmdgetreplica_collection(cmd, s.c_str(), s.size(), c.c_str(), c.size());
            }
            err = lcb_getreplica(instance, this, cmd);
        } else {
            lcb_CMDGET *cmd;

            lcb_cmdget_create(&cmd);
            lcb_cmdget_key(cmd, key.c_str(), key.size());
            if (o_collection.passed()) {
                lcb_cmdget_collection(cmd, s.c_str(), s.size(), c.c_str(), c.size());
            }
            if (o_exptime.passed()) {
                if (isLock()) {
                    lcb_cmdget_locktime(cmd, o_exptime.result());
                } else {
                    lcb_cmdget_expiry(cmd, o_exptime.result());
                }
            }
            err = lcb_get(instance, this, cmd);
            lcb_cmdget_destroy(cmd);
        }
        if (err != LCB_SUCCESS) {
            throw LcbError(err);
        }
    }
    lcb_sched_leave(instance);
    lcb_wait(instance, LCB_WAIT_DEFAULT);
}

void TouchHandler::addOptions()
{
    Handler::addOptions();
    parser.addOption(o_exptime);
    parser.addOption(o_durability);
}

void TouchHandler::run()
{
    Handler::run();
    lcb_install_callback(instance, LCB_CALLBACK_TOUCH, (lcb_RESPCALLBACK)touch_callback);
    const vector<string> &keys = parser.getRestArgs();
    lcb_STATUS err;
    lcb_sched_enter(instance);
    for (const auto &key : keys) {
        lcb_CMDTOUCH *cmd;
        lcb_cmdtouch_create(&cmd);
        lcb_cmdtouch_key(cmd, key.c_str(), key.size());
        lcb_cmdtouch_expiry(cmd, o_exptime.result());
        err = lcb_touch(instance, this, cmd);
        lcb_cmdtouch_destroy(cmd);
        if (err != LCB_SUCCESS) {
            throw LcbError(err);
        }
    }
    lcb_sched_leave(instance);
    lcb_wait(instance, LCB_WAIT_DEFAULT);
}

void SetHandler::addOptions()
{
    Handler::addOptions();
    parser.addOption(o_mode);
    parser.addOption(o_flags);
    parser.addOption(o_exp);
    parser.addOption(o_add);
    parser.addOption(o_persist);
    parser.addOption(o_replicate);
    if (!hasFileList()) {
        parser.addOption(o_value);
    }
    parser.addOption(o_json);
    parser.addOption(o_scope);
    parser.addOption(o_collection);
    parser.addOption(o_durability);
}

lcb_STORE_OPERATION SetHandler::mode()
{
    if (o_add.passed()) {
        return LCB_STORE_INSERT;
    }

    string s = o_mode.const_result();
    std::transform(s.begin(), s.end(), s.begin(), ::tolower);
    if (s == "upsert") {
        return LCB_STORE_UPSERT;
    } else if (s == "replace") {
        return LCB_STORE_REPLACE;
    } else if (s == "insert") {
        return LCB_STORE_INSERT;
    } else if (s == "append") {
        return LCB_STORE_APPEND;
    } else if (s == "prepend") {
        return LCB_STORE_PREPEND;
    } else {
        throw BadArg(string("Mode must be one of upsert, insert, replace. Got ") + s);
        return LCB_STORE_UPSERT;
    }
}

void SetHandler::storeItem(const string &key, const char *value, size_t nvalue)
{
    lcb_STATUS err;
    lcb_CMDSTORE *cmd;
    std::string s = o_scope.result();
    std::string c = o_collection.result();

    lcb_cmdstore_create(&cmd, mode());
    lcb_cmdstore_key(cmd, key.c_str(), key.size());
    if (o_collection.passed()) {
        lcb_cmdstore_collection(cmd, s.c_str(), s.size(), c.c_str(), c.size());
    }
    lcb_cmdstore_value(cmd, value, nvalue);

    if (o_json.result()) {
        lcb_cmdstore_datatype(cmd, LCB_VALUE_F_JSON);
    }
    if (o_exp.passed()) {
        lcb_cmdstore_expiry(cmd, o_exp.result());
    }
    if (o_flags.passed()) {
        lcb_cmdstore_flags(cmd, o_flags.result());
    }
    if (o_persist.passed() || o_replicate.passed()) {
        lcb_cmdstore_durability_observe(cmd, o_persist.result(), o_replicate.result());
    } else if (o_durability.passed()) {
        lcb_cmdstore_durability(cmd, durability());
    }
    err = lcb_store(instance, nullptr, cmd);
    lcb_cmdstore_destroy(cmd);
    if (err != LCB_SUCCESS) {
        throw LcbError(err);
    }
}

void SetHandler::storeItem(const string &key, FILE *input)
{
    char tmpbuf[4096];
    vector<char> vbuf;
    size_t nr;
    while ((nr = fread(tmpbuf, 1, sizeof tmpbuf, input))) {
        vbuf.insert(vbuf.end(), tmpbuf, &tmpbuf[nr]);
    }
    storeItem(key, &vbuf[0], vbuf.size());
}

void SetHandler::run()
{
    Handler::run();
    lcb_install_callback(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)store_callback);
    lcb_install_callback(instance, LCB_CALLBACK_STOREDUR, (lcb_RESPCALLBACK)store_callback);
    const vector<string> &keys = parser.getRestArgs();

    lcb_sched_enter(instance);

    if (hasFileList()) {
        for (const auto &key : keys) {
            FILE *fp = fopen(key.c_str(), "rb");
            if (fp == nullptr) {
                perror(key.c_str());
                continue;
            }
            storeItem(key, fp);
            fclose(fp);
        }
    } else if (keys.size() > 1 || keys.empty()) {
        throw BadArg("create must be passed a single key");
    } else {
        const string &key = keys[0];
        if (o_value.passed()) {
            const string &value = o_value.const_result();
            storeItem(key, value.c_str(), value.size());
        } else {
            storeItem(key, stdin);
        }
    }

    lcb_sched_leave(instance);
    lcb_wait(instance, LCB_WAIT_DEFAULT);
}

void HashHandler::run()
{
    Handler::run();

    lcbvb_CONFIG *vbc;
    lcb_STATUS err;
    err = lcb_cntl(instance, LCB_CNTL_GET, LCB_CNTL_VBCONFIG, &vbc);
    if (err != LCB_SUCCESS) {
        throw LcbError(err);
    }

    const vector<string> &args = parser.getRestArgs();
    for (const auto &key : args) {
        const void *vkey = (const void *)key.c_str();
        int vbid, srvix;
        lcbvb_map_key(vbc, vkey, key.size(), &vbid, &srvix);
        fprintf(stderr, "%s: [vBucket=%d, Index=%d]", key.c_str(), vbid, srvix);
        if (srvix != -1) {
            fprintf(stderr, " Server: %s", lcbvb_get_hostport(vbc, srvix, LCBVB_SVCTYPE_DATA, LCBVB_SVCMODE_PLAIN));
            const char *vapi = lcbvb_get_capibase(vbc, srvix, LCBVB_SVCMODE_PLAIN);
            if (vapi) {
                fprintf(stderr, ", CouchAPI: %s", vapi);
            }
        }
        fprintf(stderr, "\n");

        for (size_t jj = 0; jj < lcbvb_get_nreplicas(vbc); jj++) {
            int rix = lcbvb_vbreplica(vbc, vbid, jj);
            const char *rname = nullptr;
            if (rix >= 0) {
                rname = lcbvb_get_hostport(vbc, rix, LCBVB_SVCTYPE_DATA, LCBVB_SVCMODE_PLAIN);
            }
            if (rname == nullptr) {
                rname = "N/A";
            }
            fprintf(stderr, "Replica #%d: Index=%d, Host=%s\n", (int)jj, rix, rname);
        }
    }
}

void ObserveHandler::run()
{
    Handler::run();
    lcb_install_callback(instance, LCB_CALLBACK_OBSERVE, (lcb_RESPCALLBACK)observe_callback);
    const vector<string> &keys = parser.getRestArgs();
    lcb_MULTICMD_CTX *mctx = lcb_observe3_ctxnew(instance);
    if (mctx == nullptr) {
        throw std::bad_alloc();
    }

    lcb_STATUS err;
    for (const auto &key : keys) {
        lcb_CMDOBSERVE cmd = {0};
        LCB_KREQ_SIMPLE(&cmd.key, key.c_str(), key.size());
        err = mctx->add_observe(mctx, &cmd);
        if (err != LCB_SUCCESS) {
            throw LcbError(err);
        }
    }

    lcb_sched_enter(instance);
    err = mctx->done(mctx, nullptr);
    if (err == LCB_SUCCESS) {
        lcb_sched_leave(instance);
        lcb_wait(instance, LCB_WAIT_DEFAULT);
    } else {
        lcb_sched_fail(instance);
        throw LcbError(err);
    }
}

void ObserveSeqnoHandler::run()
{
    Handler::run();
    lcb_install_callback(instance, LCB_CALLBACK_OBSEQNO, (lcb_RESPCALLBACK)obseqno_callback);
    const vector<string> &infos = parser.getRestArgs();
    lcb_CMDOBSEQNO cmd = {0};
    lcbvb_CONFIG *vbc;
    lcb_STATUS rc;

    rc = lcb_cntl(instance, LCB_CNTL_GET, LCB_CNTL_VBCONFIG, &vbc);
    if (rc != LCB_SUCCESS) {
        throw LcbError(rc);
    }

    lcb_sched_enter(instance);

    for (const auto &cur : infos) {
        unsigned vbid;
        unsigned long long uuid;
        int rv = sscanf(cur.c_str(), "%u,%llu", &vbid, &uuid);
        if (rv != 2) {
            throw BadArg("Must pass sequences of base10 vbid and base16 uuids");
        }
        cmd.uuid = uuid;
        cmd.vbid = vbid;
        for (size_t jj = 0; jj < lcbvb_get_nreplicas(vbc) + 1; ++jj) {
            int ix = lcbvb_vbserver(vbc, vbid, jj);
            if (ix < 0) {
                fprintf(stderr, "Server %d unavailable (skipping)\n", ix);
            }
            cmd.server_index = ix;
            rc = lcb_observe_seqno3(instance, nullptr, &cmd);
            if (rc != LCB_SUCCESS) {
                throw LcbError(rc);
            }
        }
    }
    lcb_sched_leave(instance);
    lcb_wait(instance, LCB_WAIT_DEFAULT);
}

void ExistsHandler::run()
{
    Handler::run();
    lcb_install_callback(instance, LCB_CALLBACK_EXISTS, (lcb_RESPCALLBACK)exists_callback);
    const vector<string> &args = parser.getRestArgs();
    std::string s = o_scope.result();
    std::string c = o_collection.result();

    lcb_sched_enter(instance);
    for (const auto &key : args) {
        lcb_CMDEXISTS *cmd;
        lcb_cmdexists_create(&cmd);
        lcb_cmdexists_key(cmd, key.c_str(), key.size());
        if (o_collection.passed()) {
            lcb_cmdexists_collection(cmd, s.c_str(), s.size(), c.c_str(), c.size());
        }
        lcb_STATUS err = lcb_exists(instance, nullptr, cmd);
        lcb_cmdexists_destroy(cmd);
        if (err != LCB_SUCCESS) {
            throw LcbError(err);
        }
    }
    lcb_sched_leave(instance);
    lcb_wait(instance, LCB_WAIT_DEFAULT);
}

void UnlockHandler::run()
{
    Handler::run();
    lcb_install_callback(instance, LCB_CALLBACK_UNLOCK, (lcb_RESPCALLBACK)unlock_callback);
    const vector<string> &args = parser.getRestArgs();

    if (args.size() % 2) {
        throw BadArg("Expect key-cas pairs. Argument list must be even");
    }

    lcb_sched_enter(instance);
    for (size_t ii = 0; ii < args.size(); ii += 2) {
        const string &key = args[ii];
        uint64_t cas;
        int rv;
        rv = sscanf(args[ii + 1].c_str(), "0x%" PRIx64, &cas);
        if (rv != 1) {
            throw BadArg("CAS must be formatted as a hex string beginning with '0x'");
        }

        lcb_CMDUNLOCK *cmd;
        lcb_cmdunlock_create(&cmd);
        lcb_cmdunlock_key(cmd, key.c_str(), key.size());
        lcb_cmdunlock_cas(cmd, cas);
        lcb_STATUS err = lcb_unlock(instance, nullptr, cmd);
        lcb_cmdunlock_destroy(cmd);
        if (err != LCB_SUCCESS) {
            throw LcbError(err);
        }
    }
    lcb_sched_leave(instance);
    lcb_wait(instance, LCB_WAIT_DEFAULT);
}

static const char *iops_to_string(lcb_io_ops_type_t type)
{
    switch (type) {
        case LCB_IO_OPS_LIBEV:
            return "libev";
        case LCB_IO_OPS_LIBEVENT:
            return "libevent";
        case LCB_IO_OPS_LIBUV:
            return "libuv";
        case LCB_IO_OPS_SELECT:
            return "select";
        case LCB_IO_OPS_WINIOCP:
            return "iocp";
        case LCB_IO_OPS_INVALID:
            return "user-defined";
        default:
            return "invalid";
    }
}

void VersionHandler::run()
{
    const char *changeset;
    lcb_STATUS err;
    err = lcb_cntl(nullptr, LCB_CNTL_GET, LCB_CNTL_CHANGESET, (void *)&changeset);
    if (err != LCB_SUCCESS) {
        changeset = "UNKNOWN";
    }
    printf("cbc:\n");
    printf("  Runtime: Version=%s, Changeset=%s\n", lcb_get_version(nullptr), changeset);
    printf("  Headers: Version=%s, Changeset=%s\n", LCB_VERSION_STRING, LCB_VERSION_CHANGESET);
    printf("  Build Timestamp: %s\n", LCB_BUILD_TIMESTAMP);
#ifdef CMAKE_BUILD_TYPE
    printf("  CMake Build Type: %s\n", CMAKE_BUILD_TYPE);
#endif

    if (LCB_LIBDIR[0] == '/') {
        printf("  Default plugin directory: %s\n", LCB_LIBDIR);
    }
    struct lcb_cntl_iops_info_st info {
    };
    memset(&info, 0, sizeof info);
    err = lcb_cntl(nullptr, LCB_CNTL_GET, LCB_CNTL_IOPS_DEFAULT_TYPES, &info);
    if (err == LCB_SUCCESS) {
        printf("  IO: Default=%s, Current=%s, Accessible=", iops_to_string(info.v.v0.os_default),
               iops_to_string(info.v.v0.effective));
    }
    {
        size_t ii;
        char buf[256] = {0}, *p = buf;
        lcb_io_ops_type_t known_io[] = {LCB_IO_OPS_WINIOCP, LCB_IO_OPS_LIBEVENT, LCB_IO_OPS_LIBUV, LCB_IO_OPS_LIBEV,
                                        LCB_IO_OPS_SELECT};

        for (ii = 0; ii < sizeof(known_io) / sizeof(known_io[0]); ii++) {
            struct lcb_create_io_ops_st cio = {0};
            lcb_io_opt_t io = nullptr;

            cio.v.v0.type = known_io[ii];
            if (lcb_create_io_ops(&io, &cio) == LCB_SUCCESS) {
                p += sprintf(p, "%s,", iops_to_string(known_io[ii]));
                lcb_destroy_io_ops(io);
            }
        }
        *(--p) = '\n';
        printf("%s", buf);
    }

    if (lcb_supports_feature(LCB_SUPPORTS_SSL)) {
#ifdef LCB_NO_SSL
        printf("  SSL: SUPPORTED\n");
#else
#if defined(OPENSSL_VERSION)
        printf("  SSL Runtime: %s\n", OpenSSL_version(OPENSSL_VERSION));
#elif defined(SSLEAY_VERSION)
        printf("  SSL Runtime: %s\n", SSLeay_version(SSLEAY_VERSION));
#endif
        printf("  SSL Headers: %s\n", OPENSSL_VERSION_TEXT);
#endif
        printf("  HAVE_PKCS5_PBKDF2_HMAC: "
#ifdef HAVE_PKCS5_PBKDF2_HMAC
               "yes"
#else
               "no"
#endif
               "\n");
    } else {
        printf("  SSL: NOT SUPPORTED\n");
    }
    if (lcb_supports_feature(LCB_SUPPORTS_SNAPPY)) {
#define EXPAND(VAR) VAR##1
#define IS_EMPTY(VAR) EXPAND(VAR)

#if defined(SNAPPY_MAJOR) && (IS_EMPTY(SNAPPY_MAJOR) != 1)
        printf("  Snappy: %d.%d.%d\n", SNAPPY_MAJOR, SNAPPY_MINOR, SNAPPY_PATCHLEVEL);
#else
        printf("  Snappy: unknown\n");
#endif
    } else {
        printf("  Snappy: NOT SUPPORTED\n");
    }
    printf("  Tracing: %sSUPPORTED\n", lcb_supports_feature(LCB_SUPPORTS_TRACING) ? "" : "NOT ");
    printf("  System: %s; %s\n", LCB_SYSTEM, LCB_SYSTEM_PROCESSOR);
    printf("  CC: %s; %s\n", LCB_C_COMPILER, LCB_C_FLAGS);
    printf("  CXX: %s; %s\n", LCB_CXX_COMPILER, LCB_CXX_FLAGS);
}

void RemoveHandler::run()
{
    Handler::run();
    const vector<string> &keys = parser.getRestArgs();
    lcb_sched_enter(instance);
    lcb_install_callback(instance, LCB_CALLBACK_REMOVE, (lcb_RESPCALLBACK)remove_callback);
    for (const auto &key : keys) {
        lcb_CMDREMOVE *cmd;
        lcb_cmdremove_create(&cmd);
        lcb_cmdremove_key(cmd, key.c_str(), key.size());
        lcb_STATUS err = lcb_remove(instance, nullptr, cmd);
        lcb_cmdremove_destroy(cmd);
        if (err != LCB_SUCCESS) {
            throw LcbError(err);
        }
    }
    lcb_sched_leave(instance);
    lcb_wait(instance, LCB_WAIT_DEFAULT);
}

void StatsHandler::run()
{
    Handler::run();
    lcb_install_callback(instance, LCB_CALLBACK_STATS, (lcb_RESPCALLBACK)stats_callback);
    vector<string> keys = parser.getRestArgs();
    if (keys.empty()) {
        keys.emplace_back("");
    }
    lcb_sched_enter(instance);
    for (const auto &key : keys) {
        lcb_CMDSTATS *cmd;
        lcb_cmdstats_create(&cmd);
        if (!key.empty()) {
            lcb_cmdstats_key(cmd, key.c_str(), key.size());
            if (o_keystats.result()) {
                lcb_cmdstats_is_keystats(cmd, true);
            }
        }
        bool is_keystats = o_keystats.result();
        lcb_STATUS err = lcb_stats(instance, &is_keystats, cmd);
        lcb_cmdstats_destroy(cmd);
        if (err != LCB_SUCCESS) {
            throw LcbError(err);
        }
    }
    lcb_sched_leave(instance);
    lcb_wait(instance, LCB_WAIT_DEFAULT);
}

void WatchHandler::run()
{
    Handler::run();
    lcb_install_callback(instance, LCB_CALLBACK_STATS, (lcb_RESPCALLBACK)watch_callback);
    vector<string> keys = parser.getRestArgs();
    if (keys.empty()) {
        keys.emplace_back("cmd_total_ops");
        keys.emplace_back("cmd_total_gets");
        keys.emplace_back("cmd_total_sets");
    }
    int interval = o_interval.result();

    map<string, int64_t> prev;

    bool first = true;
    while (true) {
        map<string, int64_t> entry;
        lcb_sched_enter(instance);
        lcb_CMDSTATS *cmd;
        lcb_cmdstats_create(&cmd);
        lcb_STATUS err = lcb_stats(instance, (void *)&entry, cmd);
        lcb_cmdstats_destroy(cmd);
        if (err != LCB_SUCCESS) {
            throw LcbError(err);
        }
        lcb_sched_leave(instance);
        lcb_wait(instance, LCB_WAIT_DEFAULT);
        if (first) {
            for (const auto &key : keys) {
                fprintf(stderr, "%s: %" PRId64 "\n", key.c_str(), entry[key]);
            }
            first = false;
        } else {
#ifndef _WIN32
            if (isatty(STDERR_FILENO)) {
                fprintf(stderr, "\033[%dA", (int)keys.size());
            }
#endif
            for (const auto &key : keys) {
                fprintf(stderr, "%s: %" PRId64 "%20s\n", key.c_str(), (entry[key] - prev[key]) / interval, "");
            }
        }
        prev = entry;
        sleep(interval);
    }
}

static void collection_dump_manifest_callback(lcb_INSTANCE *, int, const lcb_RESPGETMANIFEST *resp)
{
    lcb_STATUS rc = lcb_respgetmanifest_status(resp);
    if (rc != LCB_SUCCESS) {
        fprintf(stderr, "Failed to get collection manifest: %s\n", lcb_strerror_short(rc));
    } else {
        const char *value;
        size_t nvalue;
        lcb_respgetmanifest_value(resp, &value, &nvalue);
        fwrite(value, 1, nvalue, stdout);
        fflush(stdout);
        fprintf(stderr, "\n");
    }
}

void CollectionGetManifestHandler::run()
{
    Handler::run();

    lcb_install_callback(instance, LCB_CALLBACK_COLLECTIONS_GET_MANIFEST,
                         (lcb_RESPCALLBACK)collection_dump_manifest_callback);

    lcb_STATUS err;
    lcb_CMDGETMANIFEST *cmd;
    lcb_cmdgetmanifest_create(&cmd);
    lcb_sched_enter(instance);
    err = lcb_getmanifest(instance, nullptr, cmd);
    lcb_cmdgetmanifest_destroy(cmd);
    if (err != LCB_SUCCESS) {
        throw LcbError(err);
    }
    lcb_sched_leave(instance);
    lcb_wait(instance, LCB_WAIT_DEFAULT);
}

static void getcid_callback(lcb_INSTANCE *, int, const lcb_RESPGETCID *resp)
{
    lcb_STATUS rc = lcb_respgetcid_status(resp);
    const char *key;
    size_t nkey;
    lcb_respgetcid_scoped_collection(resp, &key, &nkey);
    if (rc != LCB_SUCCESS) {
        fprintf(stderr, "%-20.*s Failed to get collection ID: %s\n", (int)nkey, (char *)key, lcb_strerror_short(rc));
    } else {
        uint64_t manifest_id;
        uint32_t collection_id;
        lcb_respgetcid_manifest_id(resp, &manifest_id);
        lcb_respgetcid_collection_id(resp, &collection_id);
        printf("%-20.*s ManifestId=0x%02" PRIx64 ", CollectionId=0x%02x\n", (int)nkey, (char *)key, manifest_id,
               collection_id);
    }
}

void CollectionGetCIDHandler::run()
{
    Handler::run();

    lcb_install_callback(instance, LCB_CALLBACK_GETCID, (lcb_RESPCALLBACK)getcid_callback);

    std::string scope = o_scope.result();

    const vector<string> &collections = parser.getRestArgs();
    lcb_sched_enter(instance);
    for (const auto &collection : collections) {
        lcb_STATUS err;
        lcb_CMDGETCID *cmd;
        lcb_cmdgetcid_create(&cmd);
        lcb_cmdgetcid_scope(cmd, scope.c_str(), scope.size());
        lcb_cmdgetcid_collection(cmd, collection.c_str(), collection.size());
        err = lcb_getcid(instance, nullptr, cmd);
        lcb_cmdgetcid_destroy(cmd);
        if (err != LCB_SUCCESS) {
            throw LcbError(err);
        }
    }
    lcb_sched_leave(instance);
    lcb_wait(instance, LCB_WAIT_DEFAULT);
}

void KeygenHandler::run()
{
    Handler::run();

    lcbvb_CONFIG *vbc;
    lcb_STATUS err;
    err = lcb_cntl(instance, LCB_CNTL_GET, LCB_CNTL_VBCONFIG, &vbc);
    if (err != LCB_SUCCESS) {
        throw LcbError(err);
    }

    unsigned num_vbuckets = lcbvb_get_nvbuckets(vbc);
    if (num_vbuckets == 0) {
        throw LcbError(LCB_ERR_INVALID_ARGUMENT, "the configuration does not contain any vBuckets");
    }
    unsigned num_keys_per_vbucket = o_keys_per_vbucket.result();
    vector<vector<string>> keys(num_vbuckets);
#define MAX_KEY_SIZE 16
    char buf[MAX_KEY_SIZE] = {0};
    unsigned i = 0;
    unsigned left = num_keys_per_vbucket * num_vbuckets;
    while (left > 0 && i < UINT_MAX) {
        int nbuf = snprintf(buf, MAX_KEY_SIZE, "key_%010u", i++);
        if (nbuf <= 0) {
            throw LcbError(LCB_ERR_GENERIC, "unable to render new key into buffer");
        }
        int vbid, srvix;
        lcbvb_map_key(vbc, buf, nbuf, &vbid, &srvix);
        if (keys[vbid].size() < num_keys_per_vbucket) {
            keys[vbid].push_back(buf);
            left--;
        }
    }
    for (i = 0; i < num_vbuckets; i++) {
        for (const auto &key : keys[i]) {
            printf("%s %u\n", key.c_str(), i);
        }
    }
    if (left > 0) {
        fprintf(stderr, "some vBuckets don't have enough keys\n");
    }
}

void PingHandler::run()
{
    Handler::run();

    if (o_table.result()) {
        lcb_install_callback(instance, LCB_CALLBACK_PING, (lcb_RESPCALLBACK)ping_table_callback);
    } else {
        lcb_install_callback(instance, LCB_CALLBACK_PING, (lcb_RESPCALLBACK)ping_callback);
    }
    lcb_STATUS err;
    lcb_CMDPING *cmd;
    lcb_cmdping_create(&cmd);
    lcb_cmdping_all(cmd);
    lcb_cmdping_encode_json(cmd, true, !o_minify.result(), o_details.passed());
    int interval = o_interval.result();
    if (o_count.passed()) {
        int count = o_count.result();
        printf("[\n");
        while (count > 0) {
            err = lcb_ping(instance, nullptr, cmd);
            if (err != LCB_SUCCESS) {
                throw LcbError(err);
            }
            lcb_wait(instance, LCB_WAIT_DEFAULT);
            count--;
            if (count > 0) {
                printf(",\n");
            }
            sleep(interval);
        }
        printf("\n]\n");
    } else {
        while (true) {
            err = lcb_ping(instance, nullptr, cmd);
            if (err != LCB_SUCCESS) {
                throw LcbError(err);
            }
            lcb_wait(instance, LCB_WAIT_DEFAULT);
            if (!o_table.result()) {
                printf("\n");
            }
            sleep(interval);
        }
    }
    lcb_cmdping_destroy(cmd);
}

extern "C" {
static void cbFlushCb(lcb_INSTANCE *, int, const lcb_RESPCBFLUSH *resp)
{
    if (resp->rc == LCB_SUCCESS) {
        fprintf(stderr, "Flush OK\n");
    } else {
        fprintf(stderr, "Flush failed: %s\n", lcb_strerror_short(resp->rc));
    }
}
}
void BucketFlushHandler::run()
{
    Handler::run();
    lcb_CMDCBFLUSH cmd = {0};
    lcb_STATUS err;
    lcb_install_callback(instance, LCB_CALLBACK_CBFLUSH, (lcb_RESPCALLBACK)cbFlushCb);
    err = lcb_cbflush3(instance, nullptr, &cmd);
    if (err != LCB_SUCCESS) {
        throw LcbError(err);
    } else {
        lcb_wait(instance, LCB_WAIT_DEFAULT);
    }
}

void ArithmeticHandler::run()
{
    Handler::run();

    const vector<string> &keys = parser.getRestArgs();
    lcb_install_callback(instance, LCB_CALLBACK_COUNTER, (lcb_RESPCALLBACK)arithmetic_callback);
    lcb_sched_enter(instance);
    std::string s = o_scope.result();
    std::string c = o_collection.result();
    for (const auto &key : keys) {
        lcb_CMDCOUNTER *cmd;
        lcb_cmdcounter_create(&cmd);
        lcb_cmdcounter_key(cmd, key.c_str(), key.size());
        if (o_collection.passed()) {
            lcb_cmdcounter_collection(cmd, s.c_str(), s.size(), c.c_str(), c.size());
        }
        if (o_initial.passed()) {
            lcb_cmdcounter_initial(cmd, o_initial.result());
        }
        if (o_delta.result() > static_cast<uint64_t>(std::numeric_limits<int64_t>::max())) {
            throw BadArg("Delta too big");
        }
        auto delta = static_cast<int64_t>(o_delta.result());
        if (shouldInvert()) {
            delta *= -1;
        }
        lcb_cmdcounter_delta(cmd, delta);
        lcb_cmdcounter_expiry(cmd, o_expiry.result());
        lcb_STATUS err = lcb_counter(instance, nullptr, cmd);
        lcb_cmdcounter_destroy(cmd);
        if (err != LCB_SUCCESS) {
            throw LcbError(err);
        }
    }
    lcb_sched_leave(instance);
    lcb_wait(instance, LCB_WAIT_DEFAULT);
}

void ViewsHandler::run()
{
    Handler::run();

    const string &s = getRequiredArg();
    size_t pos = s.find('/');
    if (pos == string::npos) {
        throw BadArg("View must be in the format of design/view");
    }

    string ddoc = s.substr(0, pos);
    string view = s.substr(pos + 1);
    string opts = o_params.result();

    lcb_CMDVIEW *cmd;
    lcb_cmdview_create(&cmd);
    lcb_cmdview_design_document(cmd, ddoc.c_str(), ddoc.size());
    lcb_cmdview_view_name(cmd, view.c_str(), view.size());
    lcb_cmdview_option_string(cmd, opts.c_str(), opts.size());
    lcb_cmdview_callback(cmd, view_callback);
    if (o_incdocs) {
        lcb_cmdview_include_docs(cmd, true);
    }

    lcb_STATUS rc;
    rc = lcb_view(instance, nullptr, cmd);
    lcb_cmdview_destroy(cmd);
    if (rc != LCB_SUCCESS) {
        throw LcbError(rc);
    }
    lcb_wait(instance, LCB_WAIT_DEFAULT);
}

static void splitKvParam(const string &src, string &key, string &value)
{
    size_t pp = src.find('=');
    if (pp == string::npos) {
        throw BadArg("Param must be in the form of key=value");
    }

    key = src.substr(0, pp);
    value = src.substr(pp + 1);
}

extern "C" {
static void n1qlCallback(lcb_INSTANCE *, int, const lcb_RESPQUERY *resp)
{
    const char *row;
    size_t nrow;
    lcb_respquery_row(resp, &row, &nrow);

    if (lcb_respquery_is_final(resp)) {
        lcb_STATUS rc = lcb_respquery_status(resp);
        fprintf(stderr, "---> Query response finished\n");
        if (rc != LCB_SUCCESS) {
            fprintf(stderr, "---> Query failed with library code %s\n", lcb_strerror_short(rc));

            const lcb_QUERY_ERROR_CONTEXT *ctx;
            lcb_respquery_error_context(resp, &ctx);
            uint32_t code;
            lcb_errctx_query_http_response_code(ctx, &code);
            fprintf(stderr, "---> HTTP response code: %d\n", code);
            const char *client_id;
            size_t nclient_id;
            lcb_errctx_query_client_context_id(ctx, &client_id, &nclient_id);
            fprintf(stderr, "---> Client context ID: %.*s\n", (int)nclient_id, client_id);
            uint32_t err;
            const char *errmsg;
            size_t nerrmsg;
            lcb_errctx_query_first_error_message(ctx, &errmsg, &nerrmsg);
            lcb_errctx_query_first_error_code(ctx, &err);
            fprintf(stderr, "---> First query error: %d (%.*s)\n", err, (int)nerrmsg, errmsg);
        }
        if (row) {
            printf("%.*s\n", (int)nrow, row);
        }
    } else {
        printf("%.*s,\n", (int)nrow, row);
    }
}
}

void N1qlHandler::run()
{
    Handler::run();
    const string &qstr = getRequiredArg();
    lcb_STATUS rc;

    lcb_CMDQUERY *cmd;
    lcb_cmdquery_create(&cmd);

    rc = lcb_cmdquery_statement(cmd, qstr.c_str(), qstr.size());
    if (rc != LCB_SUCCESS) {
        throw LcbError(rc);
    }

    for (const auto &arg : o_args.const_result()) {
        string key, value;
        splitKvParam(arg, key, value);
        rc = lcb_cmdquery_named_param(cmd, key.c_str(), key.size(), value.c_str(), value.size());
        if (rc != LCB_SUCCESS) {
            throw LcbError(rc);
        }
    }

    for (const auto &opt : o_opts.const_result()) {
        string key, value;
        splitKvParam(opt, key, value);
        rc = lcb_cmdquery_option(cmd, key.c_str(), key.size(), value.c_str(), value.size());
        if (rc != LCB_SUCCESS) {
            throw LcbError(rc);
        }
    }
    lcb_cmdquery_adhoc(cmd, !o_prepare.passed());
    lcb_cmdquery_callback(cmd, n1qlCallback);

    const char *payload;
    size_t npayload;
    lcb_cmdquery_encoded_payload(cmd, &payload, &npayload);
    fprintf(stderr, "---> Encoded query: %.*s\n", (int)npayload, payload);

    rc = lcb_query(instance, nullptr, cmd);
    lcb_cmdquery_destroy(cmd);
    if (rc != LCB_SUCCESS) {
        throw LcbError(rc);
    }
    lcb_wait(instance, LCB_WAIT_DEFAULT);
}

extern "C" {
static void analyticsCallback(lcb_INSTANCE *, int, const lcb_RESPANALYTICS *resp)
{
    const char *row;
    size_t nrow;
    lcb_respanalytics_row(resp, &row, &nrow);

    if (lcb_respanalytics_is_final(resp)) {
        lcb_STATUS rc = lcb_respanalytics_status(resp);
        fprintf(stderr, "---> Query response finished\n");
        if (rc != LCB_SUCCESS) {
            fprintf(stderr, "---> Query failed with library code %s\n", lcb_strerror_short(rc));

            const lcb_ANALYTICS_ERROR_CONTEXT *ctx;
            lcb_respanalytics_error_context(resp, &ctx);
            uint32_t code;
            lcb_errctx_analytics_http_response_code(ctx, &code);
            fprintf(stderr, "---> HTTP response code: %d\n", code);
            const char *client_id;
            size_t nclient_id;
            lcb_errctx_analytics_client_context_id(ctx, &client_id, &nclient_id);
            fprintf(stderr, "---> Client context ID: %.*s\n", (int)nclient_id, client_id);
            const char *errmsg;
            size_t nerrmsg;
            uint32_t err;
            lcb_errctx_analytics_first_error_message(ctx, &errmsg, &nerrmsg);
            lcb_errctx_analytics_first_error_code(ctx, &err);
            fprintf(stderr, "---> First query error: %d (%.*s)\n", err, (int)nerrmsg, errmsg);
        }
        if (row) {
            printf("%.*s\n", (int)nrow, row);
        }
    } else {
        printf("%.*s,\n", (int)nrow, row);
    }
}
}

void AnalyticsHandler::run()
{
    Handler::run();
    const string &qstr = getRequiredArg();
    lcb_STATUS rc;

    lcb_CMDANALYTICS *cmd;
    lcb_cmdanalytics_create(&cmd);

    rc = lcb_cmdanalytics_statement(cmd, qstr.c_str(), qstr.size());
    if (rc != LCB_SUCCESS) {
        throw LcbError(rc);
    }

    for (const auto &arg : o_args.const_result()) {
        string key, value;
        splitKvParam(arg, key, value);
        rc = lcb_cmdanalytics_named_param(cmd, key.c_str(), key.size(), value.c_str(), value.size());
        if (rc != LCB_SUCCESS) {
            throw LcbError(rc);
        }
    }

    for (const auto &opt : o_opts.const_result()) {
        string key, value;
        splitKvParam(opt, key, value);
        rc = lcb_cmdanalytics_option(cmd, key.c_str(), key.size(), value.c_str(), value.size());
        if (rc != LCB_SUCCESS) {
            throw LcbError(rc);
        }
    }
    lcb_cmdanalytics_callback(cmd, analyticsCallback);

    const char *payload;
    size_t npayload;
    lcb_cmdanalytics_encoded_payload(cmd, &payload, &npayload);
    fprintf(stderr, "---> Encoded query: %.*s\n", (int)npayload, payload);

    rc = lcb_analytics(instance, nullptr, cmd);
    lcb_cmdanalytics_destroy(cmd);
    if (rc != LCB_SUCCESS) {
        throw LcbError(rc);
    }
    lcb_wait(instance, LCB_WAIT_DEFAULT);
}

extern "C" {
static void ftsCallback(lcb_INSTANCE *, int, const lcb_RESPSEARCH *resp)
{
    const char *row;
    size_t nrow;
    lcb_respsearch_row(resp, &row, &nrow);

    if (lcb_respsearch_is_final(resp)) {
        lcb_STATUS rc = lcb_respsearch_status(resp);
        fprintf(stderr, "---> Query response finished\n");
        if (rc != LCB_SUCCESS) {
            fprintf(stderr, "---> Query failed with library code %s\n", lcb_strerror_short(rc));

            const lcb_SEARCH_ERROR_CONTEXT *ctx;
            lcb_respsearch_error_context(resp, &ctx);
            uint32_t code;
            lcb_errctx_search_http_response_code(ctx, &code);
            fprintf(stderr, "---> HTTP response code: %d\n", code);
            const char *errmsg;
            size_t nerrmsg;
            lcb_errctx_search_error_message(ctx, &errmsg, &nerrmsg);
            fprintf(stderr, "---> Query error message: %.*s\n", (int)nerrmsg, errmsg);
        }
        if (row) {
            printf("%.*s\n", (int)nrow, row);
        }
    } else {
        printf("%.*s,\n", (int)nrow, row);
    }
}
}

void SearchHandler::run()
{
    Handler::run();
    const string &qstr = getRequiredArg();
    lcb_STATUS rc;

    Json::Value query;
    query["query"] = qstr;
    for (const auto &opt : o_opts.const_result()) {
        string key, value;
        splitKvParam(opt, key, value);
        query[key] = value;
    }
    Json::Value payload;
    payload["indexName"] = o_index.result();
    payload["query"] = query;
    std::string payload_str = Json::FastWriter().write(payload);
    fprintf(stderr, "---> Encoded query: %.*s\n", (int)payload_str.size(), payload_str.c_str());

    lcb_CMDSEARCH *cmd;
    lcb_cmdsearch_create(&cmd);
    lcb_cmdsearch_callback(cmd, ftsCallback);
    rc = lcb_cmdsearch_payload(cmd, payload_str.c_str(), payload_str.size());
    if (rc != LCB_SUCCESS) {
        throw LcbError(rc);
    }

    rc = lcb_search(instance, nullptr, cmd);
    lcb_cmdsearch_destroy(cmd);
    if (rc != LCB_SUCCESS) {
        throw LcbError(rc);
    }
    lcb_wait(instance, LCB_WAIT_DEFAULT);
}

void HttpReceiver::install(lcb_INSTANCE *instance)
{
    lcb_install_callback(instance, LCB_CALLBACK_HTTP, (lcb_RESPCALLBACK)http_callback);
}

void HttpReceiver::maybeInvokeStatus(const lcb_RESPHTTP *resp)
{
    if (statusInvoked) {
        return;
    }

    statusInvoked = true;
    const char *const *hdr;
    lcb_resphttp_headers(resp, &hdr);
    if (hdr) {
        for (const char *const *cur = hdr; *cur; cur += 2) {
            string key = cur[0];
            string value = cur[1];
            headers[key] = value;
        }
    }
    uint16_t status;
    lcb_resphttp_http_status(resp, &status);
    handleStatus(lcb_resphttp_status(resp), status);
}

void HttpBaseHandler::run()
{
    Handler::run();
    install(instance);
    lcb_CMDHTTP *cmd;
    string uri = getURI();
    const string &body = getBody();

    lcb_cmdhttp_create(&cmd, isAdmin() ? LCB_HTTP_TYPE_MANAGEMENT : LCB_HTTP_TYPE_VIEW);
    lcb_cmdhttp_method(cmd, getMethod());
    lcb_cmdhttp_path(cmd, uri.c_str(), uri.size());
    if (!body.empty()) {
        lcb_cmdhttp_body(cmd, body.c_str(), body.size());
    }
    string ctype = getContentType();
    if (!ctype.empty()) {
        lcb_cmdhttp_content_type(cmd, ctype.c_str(), ctype.size());
    }
    lcb_cmdhttp_streaming(cmd, true);

    lcb_STATUS err;
    err = lcb_http(instance, this, cmd);
    lcb_cmdhttp_destroy(cmd);

    if (err != LCB_SUCCESS) {
        throw LcbError(err);
    }

    lcb_wait(instance, LCB_WAIT_DEFAULT);
}

lcb_HTTP_METHOD HttpBaseHandler::getMethod()
{
    string smeth = o_method.result();
    if (smeth == "GET") {
        return LCB_HTTP_METHOD_GET;
    } else if (smeth == "POST") {
        return LCB_HTTP_METHOD_POST;
    } else if (smeth == "DELETE") {
        return LCB_HTTP_METHOD_DELETE;
    } else if (smeth == "PUT") {
        return LCB_HTTP_METHOD_PUT;
    } else {
        throw BadArg("Unrecognized method string");
    }
}

const string &HttpBaseHandler::getBody()
{
    if (!body_cached.empty()) {
        return body_cached;
    }
    lcb_HTTP_METHOD meth = getMethod();
    if (meth == LCB_HTTP_METHOD_GET || meth == LCB_HTTP_METHOD_DELETE) {
        return body_cached; // empty
    }

    char buf[4096];
    size_t nr;
    while ((nr = fread(buf, 1, sizeof buf, stdin)) != 0) {
        body_cached.append(buf, nr);
    }
    return body_cached;
}

void HttpBaseHandler::handleStatus(lcb_STATUS err, int code)
{
    if (err != LCB_SUCCESS) {
        fprintf(stderr, "ERROR: %s ", lcb_strerror_short(err));
    }
    fprintf(stderr, "%d\n", code);
    map<string, string>::const_iterator ii = headers.begin();
    for (; ii != headers.end(); ii++) {
        fprintf(stderr, "  %s: %s\n", ii->first.c_str(), ii->second.c_str());
    }
}

string AdminHandler::getURI()
{
    return getRequiredArg();
}

void AdminHandler::run()
{
    fprintf(stderr, "Requesting %s\n", getURI().c_str());
    HttpBaseHandler::run();
    printf("%s\n", resbuf.c_str());
}

void BucketCreateHandler::run()
{
    const string &name = getRequiredArg();
    const string &btype = o_btype.const_result();
    stringstream ss;

    if (btype != "couchbase" && btype != "membase" && btype != "memcached") {
        throw BadArg("Unrecognized bucket type: " + btype);
    }

    ss << "name=" << name;
    ss << "&bucketType=" << btype;
    ss << "&ramQuotaMB=" << o_ramquota.result();
    ss << "&replicaNumber=" << o_replicas.result();
    body_s = ss.str();

    AdminHandler::run();
}

void RbacHandler::run()
{
    fprintf(stderr, "Requesting %s\n", getURI().c_str());
    HttpBaseHandler::run();
    if (o_raw.result()) {
        printf("%s\n", resbuf.c_str());
    } else {
        format();
    }
}

void RoleListHandler::format()
{
    Json::Value json;
    if (!Json::Reader().parse(resbuf, json)) {
        fprintf(stderr, "Failed to parse response as JSON, falling back to raw mode\n");
        printf("%s\n", resbuf.c_str());
    }

    std::map<string, string> roles;
    size_t max_width = 0;
    for (auto role : json) {
        string role_id = role["role"].asString() + ": ";
        roles[role_id] = role["desc"].asString();
        if (max_width < role_id.size()) {
            max_width = role_id.size();
        }
    }
    for (auto &role : roles) {
        std::cout << std::left << std::setw(max_width) << role.first << role.second << std::endl;
    }
}

void UserListHandler::format()
{
    Json::Value json;
    if (!Json::Reader().parse(resbuf, json)) {
        fprintf(stderr, "Failed to parse response as JSON, falling back to raw mode\n");
        printf("%s\n", resbuf.c_str());
    }

    map<string, map<string, string>> users;
    size_t max_width = 0;
    for (auto user : json) {
        string domain = user["domain"].asString();
        string user_id = user["id"].asString();
        string user_name = user["name"].asString();
        if (!user_name.empty()) {
            user_id += " (" + user_name + "): ";
        }
        stringstream roles;
        for (auto role : user["roles"]) {
            roles << "\n   - " << role["role"].asString();
            if (!role["bucket_name"].empty()) {
                roles << "[" << role["bucket_name"].asString() << "]";
            }
        }
        if (max_width < user_id.size()) {
            max_width = user_id.size();
        }
        users[domain][user_id] = roles.str();
    }
    if (!users["local"].empty()) {
        std::cout << "Local users:" << std::endl;
        int j = 1;
        for (auto i = users["local"].begin(); i != users["local"].end(); i++, j++) {
            std::cout << j << ". " << std::left << std::setw(max_width) << i->first << i->second << std::endl;
        }
    }
    if (!users["external"].empty()) {
        std::cout << "External users:" << std::endl;
        int j = 1;
        for (auto i = users["external"].begin(); i != users["external"].end(); i++, j++) {
            std::cout << j << ". " << std::left << std::setw(max_width) << i->first << i->second << std::endl;
        }
    }
}

void UserUpsertHandler::run()
{
    stringstream ss;

    name = getRequiredArg();
    domain = o_domain.result();
    if (domain != "local" && domain != "external") {
        throw BadArg("Unrecognized domain type");
    }
    if (!o_roles.passed()) {
        throw BadArg("At least one role has to be specified");
    }
    std::vector<std::string> roles = o_roles.result();
    std::string roles_param;
    for (const auto &role : roles) {
        if (roles_param.empty()) {
            roles_param += role;
        } else {
            roles_param += std::string(",") + role;
        }
    }
    ss << "roles=" << roles_param;
    if (o_full_name.passed()) {
        ss << "&name=" << o_full_name.result();
    }
    if (o_password.passed()) {
        ss << "&password=" << o_password.result();
    }
    body = ss.str();

    AdminHandler::run();
}

struct HostEnt {
    string protostr;
    string hostname;
    HostEnt(const std::string &host, const char *proto) : protostr(proto), hostname(host) {}

    HostEnt(const std::string &host, const char *proto, int port) : protostr(proto), hostname(host)
    {
        stringstream ss;
        ss << std::dec << port;
        hostname += ":";
        hostname += ss.str();
    }
};

void ConnstrHandler::run()
{
    const string &connstr_s = getRequiredArg();
    lcb_STATUS err;
    const char *errmsg;
    lcb::Connspec spec;
    err = spec.parse(connstr_s.c_str(), connstr_s.size(), &errmsg);
    if (err != LCB_SUCCESS) {
        throw BadArg(errmsg);
    }

    printf("Bucket: %s\n", spec.bucket().c_str());
    printf("Implicit port: %d\n", spec.default_port());
    string sslOpts;
    if (spec.sslopts() & LCB_SSL_ENABLED) {
        sslOpts = "ENABLED";
        if (spec.sslopts() & LCB_SSL_NOVERIFY) {
            sslOpts += "|NOVERIFY";
        }
    } else {
        sslOpts = "DISABLED";
    }
    printf("SSL: %s\n", sslOpts.c_str());

    printf("Boostrap Protocols: ");
    string bsStr;
    if (spec.is_bs_cccp()) {
        bsStr += "CCCP, ";
    }
    if (spec.is_bs_http()) {
        bsStr += "HTTP, ";
    }
    if (bsStr.empty()) {
        bsStr = "CCCP,HTTP";
    } else {
        bsStr.erase(bsStr.size() - 1, 1);
    }
    printf("%s\n", bsStr.c_str());
    printf("Hosts:\n");
    vector<HostEnt> hosts;

    for (auto &dh : spec.hosts()) {
        lcb_U16 port = dh.port;
        if (!port) {
            port = spec.default_port();
        }

        if (dh.type == LCB_CONFIG_MCD_PORT) {
            hosts.emplace_back(dh.hostname, "memcached", port);
        } else if (dh.type == LCB_CONFIG_MCD_SSL_PORT) {
            hosts.emplace_back(dh.hostname, "memcached+ssl", port);
        } else if (dh.type == LCB_CONFIG_HTTP_PORT) {
            hosts.emplace_back(dh.hostname, "restapi", port);
        } else if (dh.type == LCB_CONFIG_HTTP_SSL_PORT) {
            hosts.emplace_back(dh.hostname, "restapi+ssl", port);
        } else {
            if (spec.sslopts()) {
                hosts.emplace_back(dh.hostname, "memcached+ssl", LCB_CONFIG_MCD_SSL_PORT);
                hosts.emplace_back(dh.hostname, "restapi+ssl", LCB_CONFIG_HTTP_SSL_PORT);
            } else {
                hosts.emplace_back(dh.hostname, "memcached", LCB_CONFIG_MCD_PORT);
                hosts.emplace_back(dh.hostname, "restapi", LCB_CONFIG_HTTP_PORT);
            }
        }
    }
    for (const auto &ent : hosts) {
        string protostr = "[" + ent.protostr + "]";
        printf("  %-20s%s\n", protostr.c_str(), ent.hostname.c_str());
    }

    printf("Options: \n");
    for (const auto &it : spec.options()) {
        printf("  %s=%s\n", it.first.c_str(), it.second.c_str());
    }
}

void WriteConfigHandler::run()
{
    lcb_CREATEOPTS *cropts = nullptr;
    params.fillCropts(cropts);
    string outname = getLoneArg(false);
    if (outname.empty()) {
        outname = ConnParams::getConfigfileName();
    }
    // Generate the config
    params.writeConfig(outname);
    lcb_createopts_destroy(cropts);
}

static map<string, Handler *> handlers;
static map<string, Handler *> handlers_s;
static const char *optionsOrder[] = {"help",
                                     "cat",
                                     "create",
                                     "touch",
                                     "observe",
                                     "observe-seqno",
                                     "incr",
                                     "decr",
                                     "hash",
                                     "lock",
                                     "unlock",
                                     "cp",
                                     "rm",
                                     "stats",
                                     "version",
                                     "view",
                                     "query",
                                     "analytics",
                                     "search",
                                     "admin",
                                     "bucket-create",
                                     "bucket-delete",
                                     "bucket-flush",
                                     "role-list",
                                     "user-list",
                                     "user-upsert",
                                     "user-delete",
                                     "connstr",
                                     "write-config",
                                     "strerror",
                                     "ping",
                                     "watch",
                                     "keygen",
                                     "collection-manifest",
                                     "collection-id",
                                     nullptr};

class HelpHandler : public Handler
{
  public:
    HelpHandler() : Handler("help") {}
    HANDLER_DESCRIPTION("Show help")
  protected:
    void run() override
    {
        fprintf(stderr, "Usage: cbc <command> [options]\n");
        fprintf(stderr, "command may be:\n");
        for (const char **cur = optionsOrder; *cur; cur++) {
            const Handler *handler = handlers[*cur];
            fprintf(stderr, "   %-20s", *cur);
            fprintf(stderr, " %s\n", handler->description());
        }
    }
};

class StrErrorHandler : public Handler
{
  public:
    StrErrorHandler() : Handler("strerror") {}
    HANDLER_DESCRIPTION("Decode library error code")
    HANDLER_USAGE("HEX OR DECIMAL CODE")
  protected:
    void run() override
    {
        std::string nn = getRequiredArg();
        // Try to parse it as a hexadecimal number
        unsigned errcode;
        int rv = sscanf(nn.c_str(), "0x%x", &errcode);
        if (rv != 1) {
            rv = sscanf(nn.c_str(), "%u", &errcode);
            if (rv != 1) {
                throw BadArg("Need decimal or hex code!");
            }
        }

#define X(cname, code, cat, flags, desc)                                                                               \
    if (code == errcode) {                                                                                             \
        fprintf(stderr, "%s (%d)\n", #cname, (int)cname);                                                              \
        fprintf(stderr, "  Type: %s (%d)\n", #cat, (int)cat);                                                          \
        fprintf(stderr, "  Flags: 0x%04x\n", (unsigned int)flags);                                                     \
        fprintf(stderr, "  Description: %s\n", desc);                                                                  \
        return;                                                                                                        \
    }

        LCB_XERROR(X)
#undef X

        fprintf(stderr, "-- Error code not found in header. Trying runtime..\n");
        fprintf(stderr, "%s\n", lcb_strerror_short((lcb_STATUS)errcode));
        fprintf(stderr, "%s\n", lcb_strerror_long((lcb_STATUS)errcode));
    }
};

static void setupHandlers()
{
    handlers_s["get"] = new GetHandler();
    handlers_s["create"] = new SetHandler();
    handlers_s["hash"] = new HashHandler();
    handlers_s["help"] = new HelpHandler();
    handlers_s["lock"] = new GetHandler("lock");
    handlers_s["observe"] = new ObserveHandler();
    handlers_s["unlock"] = new UnlockHandler();
    handlers_s["version"] = new VersionHandler();
    handlers_s["rm"] = new RemoveHandler();
    handlers_s["cp"] = new SetHandler("cp");
    handlers_s["stats"] = new StatsHandler();
    handlers_s["watch"] = new WatchHandler();
    handlers_s["ping"] = new PingHandler();
    handlers_s["incr"] = new IncrHandler();
    handlers_s["decr"] = new DecrHandler();
    handlers_s["admin"] = new AdminHandler();
    handlers_s["bucket-create"] = new BucketCreateHandler();
    handlers_s["bucket-delete"] = new BucketDeleteHandler();
    handlers_s["bucket-flush"] = new BucketFlushHandler();
    handlers_s["view"] = new ViewsHandler();
    handlers_s["query"] = new N1qlHandler();
    handlers_s["analytics"] = new AnalyticsHandler();
    handlers_s["search"] = new SearchHandler();
    handlers_s["connstr"] = new ConnstrHandler();
    handlers_s["write-config"] = new WriteConfigHandler();
    handlers_s["strerror"] = new StrErrorHandler();
    handlers_s["observe-seqno"] = new ObserveSeqnoHandler();
    handlers_s["touch"] = new TouchHandler();
    handlers_s["role-list"] = new RoleListHandler();
    handlers_s["user-list"] = new UserListHandler();
    handlers_s["user-upsert"] = new UserUpsertHandler();
    handlers_s["user-delete"] = new UserDeleteHandler();
    handlers_s["keygen"] = new KeygenHandler();
    handlers_s["collection-manifest"] = new CollectionGetManifestHandler();
    handlers_s["collection-id"] = new CollectionGetCIDHandler();
    handlers_s["exists"] = new ExistsHandler();

    map<string, Handler *>::iterator ii;
    for (ii = handlers_s.begin(); ii != handlers_s.end(); ++ii) {
        handlers[ii->first] = ii->second;
    }

    handlers["cat"] = handlers["get"];
    handlers["n1ql"] = handlers["query"];
}

#if _POSIX_VERSION >= 200112L
#include <libgen.h>
#define HAVE_BASENAME
#endif

static void parseCommandname(string &cmdname, int &, char **&argv)
{
#ifdef HAVE_BASENAME
    cmdname = basename(argv[0]);
    size_t dashpos;

    if (cmdname.find("cbc") != 0) {
        cmdname.clear();
        // Doesn't start with cbc
        return;
    }

    if ((dashpos = cmdname.find('-')) != string::npos && cmdname.find("cbc") != string::npos &&
        dashpos + 1 < cmdname.size()) {

        // Get the actual command name
        cmdname = cmdname.substr(dashpos + 1);
        return;
    }
#else
    (void)argv;
#endif
    cmdname.clear();
}

static void wrapExternalBinary(int argc, char **argv, const std::string &name)
{
#ifdef _POSIX_VERSION
    vector<char *> args;
    string exePath(argv[0]);
    size_t cbc_pos = exePath.find("cbc");

    if (cbc_pos == string::npos) {
        fprintf(stderr, "Failed to invoke %s (%s)\n", name.c_str(), exePath.c_str());
        exit(EXIT_FAILURE);
    }

    exePath.replace(cbc_pos, 3, name);
    args.push_back((char *)exePath.c_str());

    // { "cbc", "name" }
    argv += 2;
    argc -= 2;
    for (int ii = 0; ii < argc; ii++) {
        args.push_back(argv[ii]);
    }
    args.push_back((char *)nullptr);
    execvp(exePath.c_str(), &args[0]);
    fprintf(stderr, "Failed to execute execute %s (%s): %s\n", name.c_str(), exePath.c_str(), strerror(errno));
#else
    fprintf(stderr, "Can't wrap around %s on non-POSIX environments", name.c_str());
#endif
    exit(EXIT_FAILURE);
}

static void cleanupHandlers()
{
    for (auto &handler : handlers_s) {
        delete handler.second;
    }
}

int main(int argc, char *argv[])
{

    // Wrap external binaries immediately
    if (argc >= 2) {
        if (strcmp(argv[1], "pillowfight") == 0) {
            wrapExternalBinary(argc, argv, "cbc-pillowfight");
        } else if (strcmp(argv[1], "n1qlback") == 0) {
            wrapExternalBinary(argc, argv, "cbc-n1qlback");
        } else if (strcmp(argv[1], "subdoc") == 0) {
            wrapExternalBinary(argc, argv, "cbc-subdoc");
        } else if (strcmp(argv[1], "proxy") == 0) {
            wrapExternalBinary(argc, argv, "cbc-proxy");
        }
    }

    setupHandlers();
    std::atexit(cleanupHandlers);

    string cmdname;
    parseCommandname(cmdname, argc, argv);

    if (cmdname.empty()) {
        if (argc < 2) {
            fprintf(stderr, "Must provide an option name\n");
            try {
                HelpHandler().execute(argc, argv);
            } catch (const std::exception &exc) {
                std::cerr << exc.what() << std::endl;
            }
            exit(EXIT_FAILURE);
        } else {
            cmdname = argv[1];
            argv++;
            argc--;
        }
    }

    Handler *handler = handlers[cmdname];
    if (handler == nullptr) {
        fprintf(stderr, "Unknown command %s\n", cmdname.c_str());
        HelpHandler().execute(argc, argv);
        exit(EXIT_FAILURE);
    }

    try {
        handler->execute(argc, argv);

    } catch (const std::exception &err) {
        std::cerr << err.what() << std::endl;
        exit(EXIT_FAILURE);
    }
}
