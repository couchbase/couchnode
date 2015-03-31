/*
 *     Copyright 2015 Couchbase, Inc.
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
 * Implementation of dynamic arrays or strings suitable for one or more than
 * one element. If only a single element is used, extra memory is not allocated
 * via malloc.
 */

#include "simplestring.h"

#define LCB_SSOBUF_DECLARE(T) \
    struct { \
        unsigned count; \
        union { \
            lcb_string alloc; \
            T single; \
        } u;\
    } \

#define LCB_SSOBUF_ALLOC(p, o, T) do { \
    if ((o)->count == 0) { /* Only allocate a single element */ \
        *(p) = &(o)->u.single; \
        (o)->count++; \
    } else if ((o)->count == 1) { /* Switch over to malloc */ \
        T ssobuf__tmp = (o)->u.single; \
        (o)->u.alloc.nused = 0; \
        (o)->u.alloc.nalloc = 0; \
        (o)->u.alloc.base = NULL; \
        if (-1 == lcb_string_reserve(&(o)->u.alloc, sizeof(T) * 2)) { \
            *(p) = NULL; \
        } else { \
            memcpy((o)->u.alloc.base, &ssobuf__tmp, sizeof(T)); \
            lcb_string_added(&(o)->u.alloc, sizeof(T)); \
            *(p) = (T*) ((o)->u.alloc.base + (o)->u.alloc.nused); \
            lcb_string_added(&(o)->u.alloc, sizeof(T)); \
        } \
        (o)->count++; \
    } else if (-1 == lcb_string_reserve(&(o)->u.alloc, sizeof(T))) { \
        *(p) = NULL; \
    } else { \
        *(p) = (T*) ((o)->u.alloc.base + (o)->u.alloc.nused); \
        lcb_string_added(&(o)->u.alloc, sizeof(T)); \
        (o)->count++; \
    } \
} while (0);

#define LCB_SSOBUF_ALLOC_N(p, o, T, n) do { \
    if (n == 1) { \
        LCB_SSOBUF_ALLOC(p, o, T); \
    } else if (n > 1) { \
        if (-1 == lcb_string_reserve(&(o)->u.alloc, sizeof(T) * (n) )) { \
            *(p) = NULL; \
        } else { \
            lcb_string_added(&(o)->u.alloc, sizeof(T) * (n) ); \
            *(p) = (T*)(o)->u.alloc.base; \
            (o)->count = n; \
        } \
    } \
} while (0);

#define LCB_SSOBUF_CLEAN(o) do { \
    if ((o)->count > 1) { \
        lcb_string_release(&(o)->u.alloc); \
    } \
} while (0);

#define LCB_SSOBUF_ARRAY(o, t) \
    ((o)->count > 1 ? ((t*)(o)->u.alloc.base) : &(o)->u.single)
