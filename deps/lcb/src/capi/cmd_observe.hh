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

#ifndef LIBCOUCHBASE_CAPI_OBSERVE_HH
#define LIBCOUCHBASE_CAPI_OBSERVE_HH

#include <cstddef>
#include <cstdint>

#include "key_value_error_context.hh"

/**Set this bit in the cmdflags field to indicate that only the master node
 * should be contacted*/
#define LCB_CMDOBSERVE_F_MASTER_ONLY (1 << 16)

/**@brief Structure for an observe request.
 * To request the status from _only_ the master node of the key, set the
 * LCB_CMDOBSERVE_F_MASTERONLY bit inside the lcb_CMDOBSERVE::cmdflags field
 */
struct lcb_CMDOBSERVE_ {
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

    /**For internal use: This determines the servers the command should be
     * routed to. Each entry is an index within the server. */
    const std::uint16_t *servers_;
    std::size_t nservers_;
};

/**
 * @brief Possible statuses for keys in OBSERVE response
 */
typedef enum {
    /** The item found in the memory, but not yet on the disk */
    LCB_OBSERVE_FOUND = 0x00,
    /** The item hit the disk */
    LCB_OBSERVE_PERSISTED = 0x01,
    /** The item missing on the disk and the memory */
    LCB_OBSERVE_NOT_FOUND = 0x80,
    /** No knowledge of the key :) */
    LCB_OBSERVE_LOGICALLY_DELETED = 0x81,

    LCB_OBSERVE_MAX = 0x82
} lcb_observe_t;

/**@brief Response structure for an observe command.
 * Note that the lcb_RESPOBSERVE::cas contains the CAS of the item as it is
 * stored within that specific server. The CAS may be incorrect or stale
 * unless lcb_RESPOBSERVE::ismaster is true.
 */
struct lcb_RESPOBSERVE_ {
    lcb_KEY_VALUE_ERROR_CONTEXT ctx{};
    /**
     Application-defined pointer passed as the `cookie` parameter when
     scheduling the command.
     */
    void *cookie;
    /** Response specific flags. see ::lcb_RESPFLAGS */
    std::uint16_t rflags;

    std::uint8_t status;   /**<Bit set of flags */
    std::uint8_t ismaster; /**< Set to true if this response came from the master node */
    std::uint32_t ttp;     /**<Unused. For internal requests, contains the server index */
    std::uint32_t ttr;     /**<Unused */
};

#endif // LIBCOUCHBASE_CAPI_OBSERVE_HH
