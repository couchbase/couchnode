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

#ifndef SRC_CONFIG_H
#define SRC_CONFIG_H 1

#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include <assert.h>

#ifdef _WIN32
#include <windows.h>
typedef unsigned __int8 cbsasl_uint8_t;
typedef unsigned __int16 cbsasl_uint16_t;
typedef unsigned __int32 cbsasl_uint32_t;
#else
#include <unistd.h>
#include <stdint.h>
typedef uint8_t cbsasl_uint8_t;
typedef uint16_t cbsasl_uint16_t;
typedef uint32_t cbsasl_uint32_t;
#endif

#endif /* SRC_CONFIG_H */
