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

#ifndef LIBCOUCHBASE_CAPI_STATS_HH
#define LIBCOUCHBASE_CAPI_STATS_HH

#include <cstddef>
#include <cstdint>

#include "key_value_error_context.hh"

/**
 * @private
 */
struct lcb_CMDSTATS_ {
    /**Common flags for the command. These modify the command itself. Currently
     the lower 16 bits of this field are reserved, and the higher 16 bits are
     used for individual commands.*/
    lcb_U32 cmdflags;

    /**Specify the expiration time. This is either an absolute Unix time stamp
     or a relative offset from now, in seconds. If the value of this number
     is greater than the value of thirty days in seconds, then it is a Unix
     timestamp.

     This field is used in mutation operations (lcb_store3()) to indicate
     the lifetime of the item. It is used in lcb_get3() with the lcb_CMDGET::lock
     option to indicate the lock expiration itself. */
    lcb_U32 exptime;

    /**The known CAS of the item. This is passed to mutation to commands to
     ensure the item is only changed if the server-side CAS value matches the
     one specified here. For other operations (such as lcb_CMDENDURE) this
     is used to ensure that the item has been persisted/replicated to a number
     of servers with the value specified here. */
    lcb_U64 cas;

    /**< Collection ID */
    lcb_U32 cid;
    const char *scope;
    size_t nscope;
    const char *collection;
    size_t ncollection;
    /**The key for the document itself. This should be set via LCB_CMD_SET_KEY() */
    lcb_KEYBUF key;

    /** Operation timeout (in microseconds). When zero, the library will use default value. */
    lcb_U32 timeout;
    /** Parent tracing span */
    lcbtrace_SPAN *pspan;
};

/**
 * The key is a stored item for which statistics should be retrieved. This
 * invokes the 'keystats' semantics. Note that when using _keystats_, a key
 * must be present, and must not have any spaces in it.
 */
#define LCB_CMDSTATS_F_KV (1 << 16)

/**
 * @private
 */
struct lcb_RESPSTATS_ {
    lcb_KEY_VALUE_ERROR_CONTEXT ctx{};
    /**
     Application-defined pointer passed as the `cookie` parameter when
     scheduling the command.
     */
    void *cookie;
    /** Response specific flags. see ::lcb_RESPFLAGS */
    lcb_U16 rflags;
    /** String containing the `host:port` of the server which sent this response */
    const char *server;
    const char *value; /**< The value, if any, for the given statistic */
    lcb_SIZE nvalue;   /**< Length of value */
};

#endif // LIBCOUCHBASE_CAPI_STATS_HH
