/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2014 Couchbase, Inc.
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

#define DEFINE_DUMMY_CALLBACK(name, resptype) \
    static void name(lcb_t i, const void *c, lcb_error_t e, const resptype *r) \
    { (void)i;(void)e;(void)c;(void)r; }

static void dummy_error_callback(lcb_t instance,lcb_error_t error, const char *errinfo) {
    lcb_breakout(instance);
    (void)error;
    (void)errinfo;
}

static void dummy_store_callback(lcb_t instance, const void *cookie,
    lcb_storage_t operation, lcb_error_t error, const lcb_store_resp_t *resp) {
    (void)instance; (void)cookie; (void)operation; (void)error; (void)resp;
}


static void dummy_http_callback(lcb_http_request_t request, lcb_t instance,
    const void *cookie, lcb_error_t error, const lcb_http_resp_t *resp) {
    (void)request;(void)instance;(void)cookie;(void)error; (void)resp;
}

static void dummy_configuration_callback(lcb_t instance, lcb_configuration_t val) {
    (void)instance; (void)val;
}

static void dummy_bootstrap_callback(lcb_t instance, lcb_error_t err) {
    (void)instance; (void)err;
}

static void dummy_pktfwd_callback(lcb_t instance, const void *cookie,
    lcb_error_t err, lcb_PKTFWDRESP *resp) {
    (void)instance;(void)cookie;(void)err;(void)resp;
}
static void dummy_pktflushed_callback(lcb_t instance, const void *cookie) {
    (void)instance;(void)cookie;
}

DEFINE_DUMMY_CALLBACK(dummy_stat_callback, lcb_server_stat_resp_t)
DEFINE_DUMMY_CALLBACK(dummy_version_callback, lcb_server_version_resp_t)
DEFINE_DUMMY_CALLBACK(dummy_verbosity_callback, lcb_verbosity_resp_t)
DEFINE_DUMMY_CALLBACK(dummy_get_callback, lcb_get_resp_t)
DEFINE_DUMMY_CALLBACK(dummy_arithmetic_callback, lcb_arithmetic_resp_t)
DEFINE_DUMMY_CALLBACK(dummy_remove_callback, lcb_remove_resp_t)
DEFINE_DUMMY_CALLBACK(dummy_touch_callback, lcb_touch_resp_t)
DEFINE_DUMMY_CALLBACK(dummy_flush_callback, lcb_flush_resp_t)
DEFINE_DUMMY_CALLBACK(dummy_unlock_callback, lcb_unlock_resp_t)
DEFINE_DUMMY_CALLBACK(dummy_observe_callback, lcb_observe_resp_t)
DEFINE_DUMMY_CALLBACK(dummy_durability_callback, lcb_durability_resp_t)

typedef union {
    lcb_RESPBASE base;
    lcb_RESPGET get;
    lcb_RESPSTORE store;
    lcb_RESPUNLOCK unlock;
    lcb_RESPCOUNTER arith;
    lcb_RESPREMOVE del;
    lcb_RESPENDURE endure;
    lcb_RESPUNLOCK unl;
    lcb_RESPFLUSH flush;
    lcb_RESPSTATS stats;
    lcb_RESPMCVERSION mcversion;
    lcb_RESPVERBOSITY verbosity;
    lcb_RESPOBSERVE observe;
    lcb_RESPHTTP http;
} uRESP;

static void
compat_default_callback(lcb_t instance, int cbtype, const lcb_RESPBASE *r3base)
{
    const uRESP *r3 = (uRESP *)r3base;
    const void *cookie = r3base->cookie;
    lcb_error_t err = r3base->rc;

    #define FILL_KVC(dst) \
        (dst)->v.v0.key = r3base->key; \
        (dst)->v.v0.nkey = r3base->nkey; \
        (dst)->v.v0.cas = r3base->cas;

    switch (cbtype) {
    case LCB_CALLBACK_GET:
    case LCB_CALLBACK_GETREPLICA: {
        lcb_get_resp_t r2 = { 0 };
        FILL_KVC(&r2)
        r2.v.v0.bytes = r3->get.value;
        r2.v.v0.nbytes = r3->get.nvalue;
        r2.v.v0.flags = r3->get.itmflags;
        r2.v.v0.datatype = r3->get.datatype;
        instance->callbacks.get(instance, cookie, err, &r2);
        break;
    }
    case LCB_CALLBACK_STORE: {
        lcb_store_resp_t r2 = { 0 };
        FILL_KVC(&r2)
        r2.v.v0.mutation_token = lcb_resp_get_mutation_token(cbtype, r3base);
        instance->callbacks.store(instance, cookie, r3->store.op, err, &r2);
        break;
    }
    case LCB_CALLBACK_COUNTER: {
        lcb_arithmetic_resp_t r2 = { 0 };
        FILL_KVC(&r2);
        r2.v.v0.value = r3->arith.value;
        r2.v.v0.mutation_token = lcb_resp_get_mutation_token(cbtype, r3base);
        instance->callbacks.arithmetic(instance, cookie, err, &r2);
        break;
    }
    case LCB_CALLBACK_REMOVE: {
        lcb_remove_resp_t r2 = { 0 };
        FILL_KVC(&r2)
        r2.v.v0.mutation_token = lcb_resp_get_mutation_token(cbtype, r3base);
        instance->callbacks.remove(instance, cookie, err, &r2);
        break;
    }
    case LCB_CALLBACK_TOUCH: {
        lcb_touch_resp_t r2 = { 0 };
        FILL_KVC(&r2)
        instance->callbacks.touch(instance, cookie, err, &r2);
        break;
    }
    case LCB_CALLBACK_UNLOCK: {
        lcb_unlock_resp_t r2 = { 0 };
        r2.v.v0.key = r3->unl.key;
        r2.v.v0.nkey = r3->unl.nkey;
        instance->callbacks.unlock(instance, cookie, err, &r2);
        break;
    }
    case LCB_CALLBACK_FLUSH: {
        lcb_flush_resp_t r2 = { 0 };
        r2.v.v0.server_endpoint = r3->flush.server;
        instance->callbacks.flush(instance, cookie, err, &r2);
        break;
    }
    case LCB_CALLBACK_VERSIONS: {
        lcb_server_version_resp_t r2 = { 0 };
        r2.v.v0.server_endpoint = r3->mcversion.server;
        r2.v.v0.vstring = r3->mcversion.mcversion;
        r2.v.v0.nvstring = r3->mcversion.nversion;
        instance->callbacks.version(instance, cookie, err, &r2);
        break;
    }
    case LCB_CALLBACK_VERBOSITY: {
        lcb_verbosity_resp_t r2 = { 0 };
        r2.v.v0.server_endpoint = r3->verbosity.server;
        instance->callbacks.verbosity(instance, cookie, err, &r2);
        break;
    }
    case LCB_CALLBACK_STATS: {
        lcb_server_stat_resp_t r2 = { 0 };
        r2.v.v0.key = r3->stats.key;
        r2.v.v0.nkey = r3->stats.nkey;
        r2.v.v0.bytes = r3->stats.value;
        r2.v.v0.nbytes = r3->stats.nvalue;
        r2.v.v0.server_endpoint = r3->stats.server;
        instance->callbacks.stat(instance, cookie, err, &r2);
        break;
    }
    case LCB_CALLBACK_OBSERVE: {
        lcb_observe_resp_t r2 = { 0 };
        FILL_KVC(&r2);
        r2.v.v0.status = r3->observe.status;
        r2.v.v0.from_master = r3->observe.ismaster;
        r2.v.v0.ttp = r3->observe.ttp;
        r2.v.v0.ttr = r3->observe.ttr;
        instance->callbacks.observe(instance, cookie, err, &r2);
        break;
    }
    case LCB_CALLBACK_ENDURE: {
        lcb_durability_resp_t r2 = { 0 };
        FILL_KVC(&r2);
        r2.v.v0.err = r3->endure.rc;
        r2.v.v0.exists_master = r3->endure.exists_master;
        r2.v.v0.persisted_master = r3->endure.persisted_master;
        r2.v.v0.npersisted = r3->endure.npersisted;
        r2.v.v0.nreplicated = r3->endure.nreplicated;
        r2.v.v0.nresponses = r3->endure.nresponses;
        if (err == LCB_SUCCESS) {
            err = r3->endure.rc;
        }
        instance->callbacks.durability(instance, cookie, err, &r2);
        break;
    }
    case LCB_CALLBACK_HTTP: {
        lcb_http_res_callback target;
        lcb_http_resp_t r2 = { 0 };
        r2.v.v0.path = r3->http.key;
        r2.v.v0.npath = r3->http.nkey;
        r2.v.v0.bytes = r3->http.body;
        r2.v.v0.nbytes = r3->http.nbody;
        r2.v.v0.status = r3->http.htstatus;
        r2.v.v0.headers = r3->http.headers;
        if (!(r3base->rflags & LCB_RESP_F_FINAL)) {
            target = instance->callbacks.http_data;
        } else {
            target = instance->callbacks.http_complete;
        }
        target(r3->http._htreq, instance, cookie, err, &r2);
        break;
    }

    default:
        break;
    }
}

void lcb_initialize_packet_handlers(lcb_t instance)
{
    instance->callbacks.get = dummy_get_callback;
    instance->callbacks.store = dummy_store_callback;
    instance->callbacks.arithmetic = dummy_arithmetic_callback;
    instance->callbacks.remove = dummy_remove_callback;
    instance->callbacks.touch = dummy_touch_callback;
    instance->callbacks.error = dummy_error_callback;
    instance->callbacks.stat = dummy_stat_callback;
    instance->callbacks.version = dummy_version_callback;
    instance->callbacks.http_complete = dummy_http_callback;
    instance->callbacks.http_data = dummy_http_callback;
    instance->callbacks.flush = dummy_flush_callback;
    instance->callbacks.unlock = dummy_unlock_callback;
    instance->callbacks.configuration = dummy_configuration_callback;
    instance->callbacks.observe = dummy_observe_callback;
    instance->callbacks.verbosity = dummy_verbosity_callback;
    instance->callbacks.durability = dummy_durability_callback;
    instance->callbacks.errmap = lcb_errmap_default;
    instance->callbacks.bootstrap = dummy_bootstrap_callback;
    instance->callbacks.pktflushed = dummy_pktflushed_callback;
    instance->callbacks.pktfwd = dummy_pktfwd_callback;
    instance->callbacks.v3callbacks[LCB_CALLBACK_DEFAULT] = compat_default_callback;
}

#define CALLBACK_ACCESSOR(name, cbtype, field) \
LIBCOUCHBASE_API \
cbtype name(lcb_t instance, cbtype cb) { \
    cbtype ret = instance->callbacks.field; \
    if (cb != NULL) { \
        instance->callbacks.field = cb; \
    } \
    return ret; \
}

LIBCOUCHBASE_API
lcb_destroy_callback
lcb_set_destroy_callback(lcb_t instance, lcb_destroy_callback cb)
{
    lcb_destroy_callback ret = LCBT_SETTING(instance, dtorcb);
    if (cb) {
        LCBT_SETTING(instance, dtorcb) = cb;
    }
    return ret;
}

CALLBACK_ACCESSOR(lcb_set_get_callback, lcb_get_callback, get)
CALLBACK_ACCESSOR(lcb_set_store_callback, lcb_store_callback, store)
CALLBACK_ACCESSOR(lcb_set_arithmetic_callback, lcb_arithmetic_callback, arithmetic)
CALLBACK_ACCESSOR(lcb_set_observe_callback, lcb_observe_callback, observe)
CALLBACK_ACCESSOR(lcb_set_remove_callback, lcb_remove_callback, remove)
CALLBACK_ACCESSOR(lcb_set_touch_callback, lcb_touch_callback, touch)
CALLBACK_ACCESSOR(lcb_set_stat_callback, lcb_stat_callback, stat)
CALLBACK_ACCESSOR(lcb_set_version_callback, lcb_version_callback, version)
CALLBACK_ACCESSOR(lcb_set_error_callback, lcb_error_callback, error)
CALLBACK_ACCESSOR(lcb_set_flush_callback, lcb_flush_callback, flush)
CALLBACK_ACCESSOR(lcb_set_http_complete_callback, lcb_http_complete_callback, http_complete)
CALLBACK_ACCESSOR(lcb_set_http_data_callback, lcb_http_data_callback, http_data)
CALLBACK_ACCESSOR(lcb_set_unlock_callback, lcb_unlock_callback, unlock)
CALLBACK_ACCESSOR(lcb_set_configuration_callback, lcb_configuration_callback, configuration)
CALLBACK_ACCESSOR(lcb_set_verbosity_callback, lcb_verbosity_callback, verbosity)
CALLBACK_ACCESSOR(lcb_set_durability_callback, lcb_durability_callback, durability)
CALLBACK_ACCESSOR(lcb_set_errmap_callback, lcb_errmap_callback, errmap)
CALLBACK_ACCESSOR(lcb_set_bootstrap_callback, lcb_bootstrap_callback, bootstrap)
CALLBACK_ACCESSOR(lcb_set_pktfwd_callback, lcb_pktfwd_callback, pktfwd)
CALLBACK_ACCESSOR(lcb_set_pktflushed_callback, lcb_pktflushed_callback, pktflushed)

LIBCOUCHBASE_API
lcb_RESPCALLBACK
lcb_install_callback3(lcb_t instance, int cbtype, lcb_RESPCALLBACK cb)
{
    lcb_RESPCALLBACK ret;
    if (cbtype >= LCB_CALLBACK__MAX) {
        return NULL;
    }

    ret = instance->callbacks.v3callbacks[cbtype];
    instance->callbacks.v3callbacks[cbtype] = cb;
    return ret;
}

LIBCOUCHBASE_API
lcb_RESPCALLBACK
lcb_get_callback3(lcb_t instance, int cbtype)
{
    if (cbtype >= LCB_CALLBACK__MAX) {
        return NULL;
    }
    return instance->callbacks.v3callbacks[cbtype];
}

LIBCOUCHBASE_API
const char *
lcb_strcbtype(int cbtype)
{
    switch (cbtype) {
    case LCB_CALLBACK_GET:
        return "GET";
    case LCB_CALLBACK_STORE:
        return "STORE";
    case LCB_CALLBACK_COUNTER:
        return "COUNTER";
    case LCB_CALLBACK_TOUCH:
        return "TOUCH";
    case LCB_CALLBACK_REMOVE:
        return "REMOVE";
    case LCB_CALLBACK_UNLOCK:
        return "UNLOCK";
    case LCB_CALLBACK_STATS:
        return "STATS";
    case LCB_CALLBACK_VERSIONS:
        return "VERSIONS";
    case LCB_CALLBACK_VERBOSITY:
        return "VERBOSITY";
    case LCB_CALLBACK_FLUSH:
        return "FLUSH";
    case LCB_CALLBACK_OBSERVE:
        return "OBSERVE";
    case LCB_CALLBACK_GETREPLICA:
        return "GETREPLICA";
    case LCB_CALLBACK_ENDURE:
        return "ENDURE";
    case LCB_CALLBACK_HTTP:
        return "HTTP";
    case LCB_CALLBACK_CBFLUSH:
        return "CBFLUSH";
    case LCB_CALLBACK_OBSEQNO:
        return "OBSEQNO";
    case LCB_CALLBACK_STOREDUR:
        return "STOREDUR";
    case LCB_CALLBACK_SDMUTATE:
        return "SDMUTATE";
    case LCB_CALLBACK_SDLOOKUP:
        return "SDLOOKUP";
    case LCB_CALLBACK_NOOP:
        return "NOOP";
    default:
        return "UNKNOWN";
    }
}

static void
nocb_fallback(lcb_t instance, int type, const lcb_RESPBASE *response)
{
    (void)instance; (void)type; (void)response;
}
lcb_RESPCALLBACK
lcb_find_callback(lcb_t instance, lcb_CALLBACKTYPE cbtype)
{
    lcb_RESPCALLBACK ret = instance->callbacks.v3callbacks[cbtype];
    if (!ret) {
        ret = instance->callbacks.v3callbacks[LCB_CALLBACK_DEFAULT];
        if (!ret) {
            ret = nocb_fallback;
        }
    }
    return ret;
}
