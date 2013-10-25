/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2010-2011 Couchbase, Inc.
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
 * AFAIK Microsoft doesn't have a compiler with support for C99, so
 * this file just help us reduce the number of #ifdefs in the code.
 *
 * @author Trond Norbye <trond.norbye@gmail.com>
 */
#ifndef STDBOOL_H
#define STDBOOL_H

#include <inttypes.h>

typedef uint8_t bool;
#define true 1
#define false 0

#endif
