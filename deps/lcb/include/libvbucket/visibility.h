/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2010 NorthScale, Inc.
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
#ifndef LIBVBUCKET_VISIBILITY_H
#define LIBVBUCKET_VISIBILITY_H 1

#if defined(LIBCOUCHBASE_INTERNAL)

#ifdef __SUNPRO_C
#define LIBVBUCKET_PUBLIC_API __global
#elif defined(HAVE_VISIBILITY) && HAVE_VISIBILITY
#define LIBVBUCKET_PUBLIC_API __attribute__ ((visibility("default")))
#elif defined(_MSC_VER)
#define LIBVBUCKET_PUBLIC_API extern __declspec(dllexport)
#else
#define LIBVBUCKET_PUBLIC_API
#endif

#else

#ifdef _MSC_VER
#define LIBVBUCKET_PUBLIC_API extern __declspec(dllimport)
#else
#define LIBVBUCKET_PUBLIC_API
#endif

#endif

#endif /* LIBVBUCKET_VISIBILITY_H */
