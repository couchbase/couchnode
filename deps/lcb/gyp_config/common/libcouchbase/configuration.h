/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2010-2012 Couchbase, Inc.
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

#ifndef LIBCOUCHBASE_CONFIGURATION_H
#define LIBCOUCHBASE_CONFIGURATION_H 1

/**
 * @file
 * Build and version information for the library
 *
 * @ingroup LCB_PUBAPI
 * @defgroup LCB_BUILDINFO Build and version information for the library
 * These functions and macros may be used to conditionally compile features
 * depending on the version of the library being used. They may also be used
 * to employ various features at runtime and to retrieve the version for
 * informational purposes.
 * @addtogroup LCB_BUILDINFO
 * @{
 */

/** @brief libcouchbase version string */
#define LCB_VERSION_STRING "3.1.0-njs"

/**@brief libcouchbase hex version
 *
 * This number contains the hexadecimal representation of the library version.
 * It is in a format of `0xXXYYZZ` where `XX` is the two digit major version
 * (e.g. `02`), `YY` is the minor version (e.g. `05`) and `ZZ` is the patch
 * version (e.g. `24`).
 *
 * For example:
 *
 * String	|Hex
 * ---------|---------
 * 2.0.0	| 0x020000
 * 2.1.3	| 0x020103
 * 3.0.15	| 0x030015
 */
#define LCB_VERSION 0x030100

/**@brief The SCM revision ID
 * @see LCB_CNTL_CHANGESET
 */
#define LCB_VERSION_CHANGESET "ed8b57e731e04e2749393c8bed8f9eb88d5d663d"

/**@brief The client ID
 */
#define LCB_CLIENT_ID "libcouchbase/" LCB_VERSION_STRING

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Get the version of the library.
 *
 * @param version where to store the numeric representation of the
 *         version (or NULL if you don't care)
 *
 * @return the textual description of the version ('\0'
 *          terminated). Do <b>not</b> try to release this string.
 *
 */
LIBCOUCHBASE_API
const char *lcb_get_version(lcb_uint32_t *version);
#ifdef __cplusplus
}
#endif
/**@}*/
#endif
