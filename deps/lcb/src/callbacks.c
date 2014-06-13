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
