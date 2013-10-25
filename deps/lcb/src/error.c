/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2011-2012 Couchbase, Inc.
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

/**
 * Project-wide error handling.
 *
 * @author William Bowers
 */

/**
 * Returns the last error that was seen within libcoubhase.
 *
 * @param instance the connection whose last error should be returned.
 */
LIBCOUCHBASE_API
lcb_error_t lcb_get_last_error(lcb_t instance)
{
    return instance->last_error;
}

/**
 * Called when an error occurs.
 *
 * This returns the error it was given so you can return it from a function
 * in 1 line:
 *
 *     return lcb_error_handler(instance, LCB_ERROR,
 *                                       "Something was wrong");
 *
 * rather than 3:
 *
 *     lcb_error_t error = LCB_ERROR;
 *     lcb_error_handler(instance, error, "Something was wrong");
 *     return error;
 *
 * @param instance the connection the error occurred on.
 * @param error the error that occurred.
 * @param errinfo the error description
 * @return the error that occurred.
 */
lcb_error_t lcb_error_handler(lcb_t instance, lcb_error_t error,
                              const char *errinfo)
{
    /* Set the last error value so it can be access without needing an
    ** error callback.
    */
    instance->last_error = error;

    /* TODO: Should we call the callback anyway, even if it's a SUCCESS? */
    if (error != LCB_SUCCESS) {
        /* Call the user's error callback. */
        instance->callbacks.error(instance, error, errinfo);
    }

    return error;
}
