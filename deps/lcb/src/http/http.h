#ifndef LCB_HTTPAPI_H
#define LCB_HTTPAPI_H

/* This file contains the internal API for HTTP requests. This allows us to
 * change the internals without exposing the object structure to the rest
 * of the library
 */

#ifdef __cplusplus
extern "C" {
#endif

void
lcb_htreq_setcb(lcb_http_request_t, lcb_RESPCALLBACK);

void
lcb_htreq_pause(lcb_http_request_t);

void
lcb_htreq_resume(lcb_http_request_t);

void
lcb_htreq_finish(lcb_t, lcb_http_request_t, lcb_error_t);

/* Prevents the callback from being invoked. This is different than a full
 * destruction of the object. This is only called in lcb_destroy() to
 * prevent dereferencing the instance itself.
 */
void
lcb_htreq_block_callback(lcb_http_request_t);
#ifdef __cplusplus
}
#endif
#endif
