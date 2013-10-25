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
#ifndef CBSASL_VISIBILITY_H
#define CBSASL_VISIBILITY_H 1

#ifdef CBSASL_STATIC
#define CBSASL_PUBLIC_API
#else

#ifdef BUILDING_CBSASL

#if defined (__SUNPRO_C) && (__SUNPRO_C >= 0x550)
#define CBSASL_PUBLIC_API __global
#elif defined __GNUC__
#define CBSASL_PUBLIC_API __attribute__ ((visibility("default")))
#elif defined(_MSC_VER)
#define CBSASL_PUBLIC_API extern __declspec(dllexport)
#else
/* unknown compiler */
#define CBSASL_PUBLIC_API
#endif

#else

#if defined(_MSC_VER)
#define CBSASL_PUBLIC_API extern __declspec(dllimport)
#else
#define CBSASL_PUBLIC_API
#endif

#endif

#endif

#endif /* CBSASL_VISIBILITY_H */
