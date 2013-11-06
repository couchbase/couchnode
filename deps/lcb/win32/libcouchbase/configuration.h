/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2010-2013 Couchbase, Inc.
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
 * Settings detected at "configure" time that the source needs to be
 * aware of (on the client installation).
 *
 * @author Trond Norbye
 */
#ifndef LIBCOUCHBASE_CONFIGURATION_H
#define LIBCOUCHBASE_CONFIGURATION_H 1

#ifndef LIBCOUCHBASE_COUCHBASE_H
#error "Include libcouchbase/couchbase.h instead"
#endif

#include <stddef.h>

#define LCB_VERSION_STRING "2.2.0"
#define LCB_VERSION 0x020200
#define LCB_VERSION_CHANGESET "unknown"
#define PACKAGE_STRING "libcouchbase 2.2.0"

#include <winsock2.h>
#include <basetsd.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef SIZE_T lcb_size_t;
typedef SSIZE_T lcb_ssize_t;
typedef __int64 lcb_int64_t;
typedef __int32 lcb_int32_t;
typedef unsigned __int8 lcb_uint8_t;
typedef unsigned __int16 lcb_vbucket_t;
typedef unsigned __int16 lcb_uint16_t;
typedef unsigned __int32 lcb_uint32_t;
typedef unsigned __int64 lcb_cas_t;
typedef unsigned __int64 lcb_uint64_t;
typedef unsigned __int32 lcb_time_t;

#ifdef __cplusplus
}
#endif

#endif
