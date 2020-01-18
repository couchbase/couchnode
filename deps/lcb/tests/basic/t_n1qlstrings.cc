/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2015-2020 Couchbase, Inc.
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

#include "config.h"
#include <gtest/gtest.h>
#include <libcouchbase/couchbase.h>
#include "n1ql/n1ql-internal.h"

class N1qLStringTests : public ::testing::Test
{
};

TEST_F(N1qLStringTests, testParseTimeout)
{
    ASSERT_EQ(1500000, lcb_n1qlreq_parsetmo("1.5s"));
    ASSERT_EQ(1500000, lcb_n1qlreq_parsetmo("1500ms"));
    ASSERT_EQ(1500000, lcb_n1qlreq_parsetmo("1500000us"));
    ASSERT_EQ(0, lcb_n1qlreq_parsetmo("blahblah"));
    ASSERT_EQ(0, lcb_n1qlreq_parsetmo("124"));
    ASSERT_EQ(0, lcb_n1qlreq_parsetmo("99z"));
}
