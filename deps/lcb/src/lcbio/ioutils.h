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

#ifndef LCBIO_UTILS_H
#define LCBIO_UTILS_H

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @file
 * @brief Various I/O-related utilities
 */

typedef enum {
    LCBIO_CSERR_BUSY, /* request pending */
    LCBIO_CSERR_INTR, /* eintr */
    LCBIO_CSERR_EINVAL, /* einval */
    LCBIO_CSERR_EFAIL, /* hard failure */
    LCBIO_CSERR_CONNECTED /* connection established */
} lcbio_CSERR;

/**
 * Convert the system errno (indicated by 'syserr')
 * @param syserr system error code
 * @return a status code simplifying the error
 */
lcbio_CSERR
lcbio_mkcserr(int syserr);

/**
 * Assigns the target error code if it indicates a 'fatal' or 'relevant' error
 * code.
 *
 * @param in Error code to inspect
 * @param[out] out target pointer
 */
void
lcbio_mksyserr(lcbio_OSERR in, lcbio_OSERR *out);

/**
 * Convert a system error code into one suitable for returning to the user
 * @param in The code received. This can be 0, for graceful shutdown
 * @param settings The settings for the library
 * @return An error code.
 */
lcb_error_t
lcbio_mklcberr(lcbio_OSERR in, const lcb_settings *settings);

/**
 * Traverse the addrinfo structure and return a socket.
 * @param io the iotable structure used to create the socket
 * @param[in,out] ai an addrinfo structure
 * @param[out] connerr an error if a socket could not be established.
 * @return a new socket, or INVALID_SOCKET
 *
 * The ai structure should be considered as an opaque iterator. This function
 * will look at the first entry in the list and attempt to create a socket.
 * It will traverse through each entry and break when either a socket has
 * been successfully created, or no more addrinfo entries remain.
 */
lcb_socket_t
lcbio_E_ai2sock(lcbio_pTABLE io, struct addrinfo **ai, int *connerr);

lcb_sockdata_t *
lcbio_C_ai2sock(lcbio_pTABLE io, struct addrinfo **ai, int *conerr);

struct lcbio_NAMEINFO {
    char local[NI_MAXHOST + NI_MAXSERV + 2];
    char remote[NI_MAXHOST + NI_MAXSERV + 2];
};

int
lcbio_get_nameinfo(lcbio_SOCKET *sock, struct lcbio_NAMEINFO *nistrs);

/** Basic wrapper around the @ref lcb_ioE_chkclosed_fn family */
int
lcbio_is_netclosed(lcbio_SOCKET *sock, int flags);

/** Disable Nagle's algorithm on the socket */
lcb_error_t
lcbio_disable_nagle(lcbio_SOCKET *s);

void
lcbio__load_socknames(lcbio_SOCKET *sock);

#ifdef _WIN32
#define lcbio_syserrno GetLastError()
#else
#define lcbio_syserrno errno
#endif


/**
 * @addtogroup lcbio
 * @{
 *
 * @name Pending Requests
 * @{
 *
 * The lcbio_CONNREQ structure may contain various forms of pending requests
 * which are _cancellable_. This is useful to act as an abstraction over the
 * various helper functions which may be employed to initiate a new connection
 * or negotiate an existing one.
 *
 * The semantics of a _cancellable_ request are:
 *
 * <ul>
 * <li>They represent a pending operation</li>
 * <li>When cancelled, the pending operation is invalidated. This means that
 * any callbacks scheduled as a result of the operation will not be invoked.
 * </li>
 *
 * <li>If the pending operation has completed, the request is invalidated. This
 * means the pointer for the request is considered invalid once the operation
 * has completed
 * </li>
 * </ul>
 */

/**
 * @brief Container object for various forms of cancellable requests.
 */
typedef struct {
    int type; /**< One of the LCBIO_CONNREQ_* constants */
    #define LCBIO_CONNREQ_RAW 1
    #define LCBIO_CONNREQ_POOLED 2
    #define LCBIO_CONNREQ_GENERIC 3
    union {
        struct lcbio_CONNSTART *cs; /**< from lcbio_connect() */
        struct lcbio_MGRREQ *preq; /**< from lcbio_mgr_get() */
        void *p_generic; /**< Generic pointer. Destroyed via the dtor field */
    } u;
    void (*dtor)(void *);
} lcbio_CONNREQ;

/** @brief Clear an existing request, setting the pointer to NULL */
#define LCBIO_CONNREQ_CLEAR(req) (req)->u.p_generic = NULL

/**
 * @brief Initialize a connreq with an lcbio_pCONNSTART handle
 * @param req the request to initialize
 * @param cs the lcbio_pCONNSTART returned by lcbio_connect()
 */
#define LCBIO_CONNREQ_MKRAW(req, cs) do { \
    (req)->u.cs = cs; \
    (req)->type = LCBIO_CONNREQ_RAW; \
} while (0);

/**
 * @brief Initialize a connreq with an lcbio_pMGRREQ
 * @param req The request to initialize
 * @param sreq the lcbio_pMGRREQ returned by lcbio_mgr_get()
 */
#define LCBIO_CONNREQ_MKPOOLED(req, sreq) do { \
    (req)->u.preq = sreq; \
    (req)->type = LCBIO_CONNREQ_POOLED; \
} while (0);

/**
 * Initialize a connreq with a generic pointer.
 * @param req The request to initialize
 * @param p the pointer representing the request
 * @param dtorcb a callback invoked with `p` when the request has been cancelled
 */
#define LCBIO_CONNREQ_MKGENERIC(req, p, dtorcb) do { \
    (req)->u.p_generic = p; \
    (req)->type = LCBIO_CONNREQ_GENERIC; \
    (req)->dtor = (void (*)(void *))dtorcb; \
} while (0);

/**
 * @brief cancels a pending request, if not yet cancelled.
 *
 * Cancels a pending request. If the request has already been cancelled (by
 * calling this function), then this function does nothing
 * @param req The request to cancel
 */
void
lcbio_connreq_cancel(lcbio_CONNREQ *req);

/**@}*/
/**@}*/

#ifdef __cplusplus
}
#endif
#endif
