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

#ifndef LIBCOUCHBASE_CAPI_HTTP_HH
#define LIBCOUCHBASE_CAPI_HTTP_HH

#include <cstddef>
#include <cstdint>

/**
 * Command flag for HTTP to indicate that the callback is to be invoked
 * multiple times for each new chunk of incoming data. Once the entire body
 * have been received, the callback will be invoked once more with the
 * LCB_RESP_F_FINAL flag (in lcb_RESPHTTP::rflags) and an empty content.
 *
 * To use streaming requests, this flag should be set in the
 * lcb_CMDHTTP::cmdflags field
 */
#define LCB_CMDHTTP_F_STREAM (1 << 16)

/**
 * @internal
 * If specified, the lcb_CMDHTTP::cas field becomes the timeout for this
 * specific request.
 */
#define LCB_CMDHTTP_F_CASTMO (1 << 17)

/**
 * @internal
 * Do not inject authentication header into the request.
 */
#define LCB_CMDHTTP_F_NOUPASS (1 << 18)

/**
 * Structure for performing an HTTP request.
 * Note that the key and nkey fields indicate the _path_ for the API
 */
struct lcb_CMDHTTP_ {
    void set_header(const std::string &name, const std::string &value)
    {
        headers_.emplace(name, value);
    }

    /**Common flags for the command. These modify the command itself. Currently
     the lower 16 bits of this field are reserved, and the higher 16 bits are
     used for individual commands.*/
    std::uint32_t cmdflags;

    /**Specify the expiration time. This is either an absolute Unix time stamp
     or a relative offset from now, in seconds. If the value of this number
     is greater than the value of thirty days in seconds, then it is a Unix
     timestamp.

     This field is used in mutation operations (lcb_store3()) to indicate
     the lifetime of the item. It is used in lcb_get3() with the lcb_CMDGET::lock
     option to indicate the lock expiration itself. */
    std::uint32_t exptime;

    /**The known CAS of the item. This is passed to mutation to commands to
     ensure the item is only changed if the server-side CAS value matches the
     one specified here. For other operations (such as lcb_CMDENDURE) this
     is used to ensure that the item has been persisted/replicated to a number
     of servers with the value specified here. */
    std::uint64_t cas;

    /**< Collection ID */
    std::uint32_t cid;
    const char *scope;
    std::size_t nscope;
    const char *collection;
    std::size_t ncollection;
    /**The key for the document itself. This should be set via LCB_CMD_SET_KEY() */
    lcb_KEYBUF key;

    /** Operation timeout (in microseconds). When zero, the library will use default value. */
    std::uint32_t timeout;
    /** Parent tracing span */
    lcbtrace_SPAN *pspan;

    /**Type of request to issue. LCB_HTTP_TYPE_VIEW will issue a request
     * against a random node's view API. LCB_HTTP_TYPE_MANAGEMENT will issue
     * a request against a random node's administrative API, and
     * LCB_HTTP_TYPE_RAW will issue a request against an arbitrary host. */
    lcb_HTTP_TYPE type;
    lcb_HTTP_METHOD method; /**< HTTP Method to use */

    /** If the request requires a body (e.g. `PUT` or `POST`) then it will
     * go here. Be sure to indicate the length of the body too. */
    const char *body;

    /** Length of the body for the request */
    std::size_t nbody;

    /** If non-NULL, will be assigned a handle which may be used to
     * subsequently cancel the request */
    lcb_HTTP_HANDLE **reqhandle;

    /** For views, set this to `application/json` */
    const char *content_type;

    /** Username to authenticate with, if left empty, will use the credentials
     * passed to lcb_create() */
    const char *username;

    /** Password to authenticate with, if left empty, will use the credentials
     * passed to lcb_create() */
    const char *password;

    /** If set, this must be a string in the form of `http://host:port`. Should
     * only be used for raw requests. */
    const char *host;

    std::map<std::string, std::string> headers_{};
};

/**
 * Structure for HTTP responses.
 * Note that #rc being `LCB_SUCCESS` does not always indicate that the HTTP
 * request itself was successful. It only indicates that the outgoing request
 * was submitted to the server and the client received a well-formed HTTP
 * response. Check the #hstatus field to see the actual HTTP-level status
 * code received.
 */
struct lcb_RESPHTTP_ {
    lcb_HTTP_ERROR_CONTEXT ctx;
    void *cookie;
    std::uint16_t rflags;

    /**List of key-value headers. This field itself may be `NULL`. The list
     * is terminated by a `NULL` pointer to indicate no more headers. */
    const char *const *headers;

    /**@internal*/
    lcb_HTTP_HANDLE *_htreq;
};

#endif // LIBCOUCHBASE_CAPI_HTTP_HH
