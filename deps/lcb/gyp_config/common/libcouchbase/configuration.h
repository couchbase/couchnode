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

#define LCB_VERSION_STRING "2.2.0"
#define LCB_VERSION 0x020200
#define LCB_VERSION_CHANGESET "unknown"
#define PACKAGE_STRING "libcouchbase 2.2.0"
#endif
