/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
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
#ifndef TOOLS_CBC_UTIL_H
#define TOOLS_CBC_UTIL_H 1

void sendIt(const lcb_uint8_t *ptr, lcb_size_t size);
bool readIt(lcb_uint8_t *ptr, lcb_size_t size);

#ifdef _WIN32
void setBinaryIO(void);
#else
#define setBinaryIO()
#endif

#endif
