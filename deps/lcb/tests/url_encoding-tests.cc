/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2012 Couchbase, Inc.
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
#include "url_encoding.h"

class UrlEncoding : public ::testing::Test
{
};

TEST_F(UrlEncoding, plainTextTests)
{
    char *out;
    lcb_size_t nout;

    std::string input("abcdef");
    std::string exp("abcdef");

    EXPECT_EQ(LCB_SUCCESS, lcb_urlencode_path(input.data(), input.length(),
                                              &out, &nout));
    std::string output(out, nout);

    EXPECT_EQ(exp, output);
    free(out);
}

TEST_F(UrlEncoding, plainTextWithSlashTests)
{
    char *out;
    lcb_size_t nout;

    std::string input("a/b/c/d/e/f/g/h/i/j");

    EXPECT_EQ(LCB_SUCCESS, lcb_urlencode_path(input.data(), input.length(),
                                              &out, &nout));
    std::string output(out, nout);

    EXPECT_EQ(input, output);
    free(out);
}

TEST_F(UrlEncoding, plainTextWithSpaceTests)
{
    char *out;
    lcb_size_t nout;

    std::string input("a b c d e f g");
    std::string exp("a%20b%20c%20d%20e%20f%20g");

    EXPECT_EQ(LCB_SUCCESS, lcb_urlencode_path(input.data(), input.length(),
                                              &out, &nout));
    std::string output(out, nout);

    EXPECT_EQ(exp, output);
    free(out);
}

TEST_F(UrlEncoding, encodedTextWithPlusAsApaceTests)
{
    char *out;
    lcb_size_t nout;

    std::string input("a+b+c+d+e+g+h");

    EXPECT_EQ(LCB_SUCCESS, lcb_urlencode_path(input.data(), input.length(),
                                              &out, &nout));
    std::string output(out, nout);

    EXPECT_EQ(input, output);
    free(out);
}

TEST_F(UrlEncoding, encodedTextWithPlusAndHexAsApaceTests)
{
    char *out;
    lcb_size_t nout;

    std::string input("a+b%20c%20d+e+g+h");

    EXPECT_EQ(LCB_SUCCESS, lcb_urlencode_path(input.data(), input.length(),
                                              &out, &nout));
    std::string output(out, nout);

    EXPECT_EQ(input, output);
    free(out);
}

TEST_F(UrlEncoding, mixedLegalTextTests)
{
    char *out;
    lcb_size_t nout;

    std::string input("a/b/c/d/e f g+32%20");
    std::string exp("a/b/c/d/e%20f%20g+32%20");

    EXPECT_EQ(LCB_SUCCESS, lcb_urlencode_path(input.data(), input.length(),
                                              &out, &nout));
    std::string output(out, nout);


    EXPECT_EQ(exp, output);
    free(out);
}

TEST_F(UrlEncoding, mixedIllegalEncodingTextTests)
{
    char *out;
    lcb_size_t nout;

    std::string input("a+ ");

    EXPECT_EQ(LCB_INVALID_CHAR, lcb_urlencode_path(input.data(),
                                                   input.length(),
                                                   &out, &nout));
}

TEST_F(UrlEncoding, internationalTest)
{
    char *out;
    lcb_size_t nout;
    std::string input("_design/beer/_view/all?startkey=\"\xc3\xb8l\"");
    std::string exp("_design/beer/_view/all?startkey=%22%C3%B8l%22");
    EXPECT_EQ(LCB_SUCCESS, lcb_urlencode_path(input.data(), input.length(),
                                              &out, &nout));
    std::string output(out, nout);

    EXPECT_EQ(exp, output);
    free(out);
}

TEST_F(UrlEncoding, internationalEncodedTest)
{
    char *out;
    lcb_size_t nout;
    std::string input("_design/beer/_view/all?startkey=%22%C3%B8l%22");
    std::string exp("_design/beer/_view/all?startkey=%22%C3%B8l%22");
    EXPECT_EQ(LCB_SUCCESS, lcb_urlencode_path(input.data(), input.length(),
                                              &out, &nout));
    std::string output(out, nout);

    EXPECT_EQ(exp, output);
    free(out);
}
