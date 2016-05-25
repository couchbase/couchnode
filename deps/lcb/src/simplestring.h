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
#include <stdarg.h>

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
typedef struct lcb_string_st {
    /** Buffer that's allocated */
    char *base;

    /** Number of bytes allocated */
    lcb_size_t nalloc;

    /** Number of bytes used */
    lcb_size_t nused;
#ifdef __cplusplus
    typedef char *iterator;
    typedef const char *const_iterator;

    iterator begin() { return base; };
    iterator end() { return base + nused; }
    const_iterator begin() const { return base; }
    const_iterator end() const { return base + nused; }
    size_t size() const { return nused; }
    size_t capacity() const { return nalloc; }
    const char *c_str() const { return base; }

    inline void insert(iterator p, const char *first, const char *last);
#endif
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
 * @param str the string to append to
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
 * Appends a list of pointer-length pairs. Useful if you need to concatenate
 * many small buffers
 * @param str The string to append to. This should be followed by a list of
 * `pointer, size` arguments (where `size` is `size_t`). If the length is
 * `-1` then `strlen(pointer)` will be called to determine the length.
 *
 * A terminal `NULL` should be placed at the end of the argument list
 *
 * @return 0 if appended, nonzero on memory error
 */
int lcb_string_appendv(lcb_string *str, ...);

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

/**
 * Inserts a string at a given position
 * @param str the string object
 * @param at position at which to insert
 * @param src the string to insert
 * @param len length of string to insert
 */
int lcb_string_insert(lcb_string *str, size_t at, const char *src, size_t len);

#define lcb_string_tail(str) ((str)->base + (str)->nused)

#ifdef __cplusplus
}

#include <stdexcept>
#include <new>
void
lcb_string_st::insert(iterator p, const char *first, const char *last) {
    size_t at = p - base;
    size_t n = last - first;
    if (lcb_string_insert(this, at, first, n) != 0) {
        throw std::bad_alloc();
    }
}

namespace lcb {
class AutoString : public lcb_string_st {
public:
    AutoString() {
        lcb_string_init(this);
    }
    ~AutoString() {
        lcb_string_release(this);
    }

    char *take(size_t& len, size_t& cap) {
        char *ret = base;
        len = nused;
        cap = nalloc;

        base = NULL;
        nalloc = 0;
        nused = 0;
        return ret;
    }
    char *take(size_t& len) {
        size_t dummy;
        return take(len, dummy);
    }
    char *take() {
        size_t dummy;
        return take(dummy, dummy);
    }

private:
    AutoString(lcb_string_st&);
    AutoString(const lcb_string_st&);
};
}

#endif /** __cplusplus */
#endif /* LCB_STRING_H */
