/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2011-2013 Couchbase, Inc.
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

/**
 * This file contains the implementation of the method(s) needed to
 * convert an error constant to a textual representation.
 *
 * @author Trond Norbye
 * @todo Localize the function..
 */

#include "internal.h"

LIBCOUCHBASE_API
const char *lcb_strerror(lcb_t instance, lcb_error_t error)
{
    (void)instance;
    switch (error) {
    case LCB_SUCCESS:
        return "Success";
    case LCB_KEY_ENOENT:
        return "No such key";
    case LCB_E2BIG:
        return "Object too big";
    case LCB_ENOMEM:
        return "Out of memory";
    case LCB_KEY_EEXISTS:
        return "Key exists (with a different CAS value)";
    case LCB_EINVAL:
        return "Invalid arguments";
    case LCB_NOT_STORED:
        return "Not stored";
    case LCB_DELTA_BADVAL:
        return "Not a number";
    case LCB_NOT_MY_VBUCKET:
        return "The vbucket is not located on this server";
    case LCB_AUTH_ERROR:
        return "Authentication error";
    case LCB_AUTH_CONTINUE:
        return "Continue authentication";
    case LCB_ERANGE:
        return "Invalid range";
    case LCB_UNKNOWN_COMMAND:
        return "Unknown command";
    case LCB_NOT_SUPPORTED:
        return "Not supported";
    case LCB_EINTERNAL:
        return "Internal error";
    case LCB_EBUSY:
        return "Too busy. Try again later";
    case LCB_ETMPFAIL:
        return "Temporary failure. Try again later";
    case LCB_DLOPEN_FAILED:
        return "Failed to open shared object";
    case LCB_DLSYM_FAILED:
        return "Failed to locate the requested symbol in the shared object";
    case LCB_NETWORK_ERROR:
        return "Network error";
    case LCB_UNKNOWN_HOST:
        return "Unknown host";
    case LCB_ERROR:
        return "Generic error";
    case LCB_PROTOCOL_ERROR:
        return "Protocol error";
    case LCB_ETIMEDOUT:
        return "Operation timed out";
    case LCB_CONNECT_ERROR:
        return "Connection failure";
    case LCB_BUCKET_ENOENT:
        return "No such bucket";
    case LCB_CLIENT_ENOMEM:
        return "Out of memory on the client";
    case LCB_CLIENT_ETMPFAIL:
        return "Temporary failure on the client. Try again later";
    case LCB_EBADHANDLE:
        return "Invalid handle type. The requested operation isn't allowed for given type.";
    case LCB_SERVER_BUG:
        return "Unexpected usage of the server protocol, like unexpected"
               " response. Please record your steps and file an issue at"
               " http://www.couchbase.com/issues/browse/MB";
    case LCB_PLUGIN_VERSION_MISMATCH:
        return "The plugin used for IO operations cannot be loaded due to"
               " a version mismatch";
    case LCB_INVALID_HOST_FORMAT:
        return "One of the hostnames specified use invalid characters"
               " or an unsupported format";
    case LCB_INVALID_CHAR:
        return "An invalid character is used";
    case LCB_DURABILITY_ETOOMANY:
        return "Durability constraints requires more "
               "nodes/replicas than the cluster configuration allows. "
               "Durability constraints will never be satisfied";
    case LCB_DUPLICATE_COMMANDS:
        return "The same key was specified more than once in the command list";
    case LCB_NO_MATCHING_SERVER:
        return "No node was found for servicing this key. This may be a "
               "result of a nonexistent/stale cluster configuration";

    case LCB_BAD_ENVIRONMENT:
        return "An environment variable recognized by libcouchbase was "
               "specified in an invalid format or has missing items";

    case LCB_BUSY:
        return "An operation was not completed yet";

    case LCB_INVALID_USERNAME:
        return "The administration user cannot be used for authenticating to the bucket, or did you just misspell the username?";

    case LCB_CONFIG_CACHE_INVALID:
        return "The contents of the configuration cache file were invalid. "
                "Will attempt to grab configuration from the network";

    case LCB_SASLMECH_UNAVAILABLE:
        return "The user-defined authentication mechanism is not supported "
                "by the server. Either upgrade your server or change the "
                "authentication requirements";

    case LCB_TOO_MANY_REDIRECTS:
        return "Maximum allowed number redirects reached. See "
               "lcb_cntl(3) manpage for LCB_CNTL_MAX_REDIRECTS option to "
               "get or set this limit.";

    default:
        if (error > LCB_MAX_ERROR) {
            return "Unknown error";
        } else {
            return "Unknown error. This code exceeds reserved limit for libcouchbase";
        }
    }
}
