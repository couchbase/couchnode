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

#ifndef LCB_MCSERVER_NEGOTIATE_H
#define LCB_MCSERVER_NEGOTIATE_H
#include <libcouchbase/couchbase.h>
#include <lcbio/lcbio.h>
#ifdef __cplusplus
extern "C" {
#endif

/**
 * @file
 * @brief SASL Negotiation routines
 *
 * @defgroup lcb-sasl Server/SASL Negotiation
 * @details
 * This module contains routines to initialize a server and authenticate it
 * against a cluster. In the future this will also be used to handle things
 * such as TLS negotiation and the HELLO command
 * @addtogroup lcb-sasl
 * @{
 */

struct lcb_settings_st;
typedef struct mc_SESSREQ *mc_pSESSREQ;
typedef struct mc_SESSINFO *mc_pSESSINFO;

/**
 * @brief Start negotiation on a connected socket
 *
 * This will start negotiation on the socket. Once complete (or an error has
 * taken place) the `callback` will be invoked with the result.
 *
 * @param sock A connected socket to use. Its reference count will be increased
 * @param settings A settings structure. Used for auth information as well as
 * logging
 * @param tmo Time in microseconds to wait until the negotiation is done
 * @param callback A callback to invoke when a result has been received
 * @param data User-defined pointer passed to the callback
 * @return A new handle which may be cancelled via mc_sessreq_cancel(). As with
 * other cancellable requests, once this handle is cancelled a callback will
 * not be received for it, and once the callback is received the handle may not
 * be cancelled as it will point to invalid memory.
 *
 * Once the socket has been negotiated successfuly, you may then use the
 * mc_sess_get() function to query the socket about various negotiation aspects
 *
 * @code{.c}
 * lcbio_CONNREQ creq;
 * mc_pSASLREQ req;
 * req = mc_sasl_start(sock, settings, tmo, callback, data);
 * LCBIO_CONNREQ_MKGENERIC(req, mc_sasl_cancel);
 * @endcode
 *
 * @see lcbio_connreq_cancel()
 * @see LCBIO_CONNREQ_MKGENERIC
 */
mc_pSESSREQ
mc_sessreq_start(
        lcbio_SOCKET *sock, struct lcb_settings_st *settings,
        uint32_t tmo, lcbio_CONNDONE_cb callback, void *data);

/**
 * @brief Cancel a pending SASL negotiation request
 * @param handle The handle to cancel
 */
void
mc_sessreq_cancel(mc_pSESSREQ handle);

/**
 * @brief Get an opaque handle representing the negotiated state of the socket
 * @param sock The negotiated socket
 * @return the `SASLINFO` structure if the socket is negotiated, or `NULL` if
 * the socket has not been negotiated.
 *
 * @see mc_sasl_getmech()
 */
mc_pSESSINFO
mc_sess_get(lcbio_SOCKET *sock);

/**
 * @brief Get the mechanism employed for authentication
 * @param info pointer retrieved via mc_sasl_get()
 * @return A string indicating the mechanism used. This may be `PLAIN` or
 * `CRAM-MD5`.
 */
const char *
mc_sess_get_saslmech(mc_pSESSINFO info);

/**
 * @brief Determine if a specific protocol feature is supported on the server
 * @param info info pointer returned via mc_sasl_get()
 * @param feature A feature ID
 * @return true if supported, false otherwise
 */
int
mc_sess_chkfeature(mc_pSESSINFO info, lcb_U16 feature);

/**@}*/

#ifdef __cplusplus
}
#endif
#endif
