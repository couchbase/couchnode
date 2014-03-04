/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2013 Couchbase, Inc.
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

#ifndef LCB_STRING_H
#define LCB_STRING_H

#include <libcouchbase/couchbase.h>
#include "config.h"
#include "assert.h"
#include "ringbuffer.h"

/**
 * Simple string type.
 *
 * This structure is designed mainly for ease of use when dealing with actual
 * "string" data - i.e. data which must be null-terminated and contiguous.
 *
 * This won't replace the ringbuffer structure as this string's removal and
 * copying operations are comparatively expensive.
 *
 * Note that all API functions which update the position of the buffer ALSO
 * add a trailing NUL byte at the end.
 */
typedef struct {
    /** Buffer that's allocated */
    char *base;

    /** Number of bytes allocated */
    lcb_size_t nalloc;

    /** Number of bytes used */
    lcb_size_t nused;
} lcb_string;

#ifdef __cplusplus
extern "C" {
#endif

int lcb_string_init(lcb_string *str);

/**
 * Free any storage associated with the string. The string's state will be
 * empty as if string_init() had just been called.
 */
void lcb_string_release(lcb_string *str);

/**
 * Clear the contents of the string, but don't free the underlying buffer
 */
void lcb_string_clear(lcb_string *str);


/**
 * Indicate that bytes have been added to the string. This is used in conjunction
 * with reserve(). As such, the number of bytes added should not exceed the
 * number of bytes passed to reserver.
 *
 * @param str the string
 * @param nbytes the number of bytes added
 */
void lcb_string_added(lcb_string *str, lcb_size_t nbytes);

/**
 * Reserve an amount of free bytes within the string. When this is done,
 * up to @c size bytes may be added to the string starting at @c base+str->nbytes
 */
int lcb_string_reserve(lcb_string *str, lcb_size_t size);


/**
 * Adds data to the string.
 * @param data the data to copy
 * @param size the size of data to copy
 */
int lcb_string_append(lcb_string *str, const void *data, lcb_size_t size);

/**
 * Adds a C-style string
 * @param str the target lcb_string
 * @param zstr a NUL-terminated string to add
 */
int lcb_string_appendz(lcb_string *str, const char *zstr);

/**
 * Adds a string from a ringbuffer structure. This copies the contents
 * of the ringbuffer into a string.
 * @param str the target string
 * @param rb the source ringbuffer
 * @param rbadvance whether to advance the ringbuffer's read head
 */
int lcb_string_rbappend(lcb_string *str, ringbuffer_t *rb, int rbadvance);

/**
 * Removes bytes from the end of the string. The resultant string will be
 * NUL-terminated
 * @param str the string to operate on
 * @param to_remove the number of bytes to trim from the end
 */
void lcb_string_erase_end(lcb_string *str, lcb_size_t to_remove);


/**
 * Removes bytes from the beginning of the string. The resultant string will
 * be NUL-terminated.
 * @param str the string to operate on
 * @param to_remove the number of bytes to remove from the beginning of
 * the string.
 */
void lcb_string_erase_beginning(lcb_string *str, lcb_size_t to_remove);

/**
 * Transfers ownership of the underlying buffer contained within the structure
 * 'to' to the structure 'from', as such, 'from' becomes a newly initialized
 * empty string structure and 'to' contains the existing buffer.
 *
 * @param from the string which contains the existing buffer
 * @param to a new string structure which contains no buffer. It will receive
 * from's buffer
 */
void lcb_string_transfer(lcb_string *from, lcb_string *to);

#define lcb_string_tail(str) ((str)->base + (str)->nused)

#ifdef __cplusplus
}
#endif /** __cplusplus */
#endif /* LCB_STRING_H */
