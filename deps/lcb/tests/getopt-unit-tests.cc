/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2011-2012 Couchbase, Inc.
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
#include <iostream>
#include <getopt.h>
#include <vector>
#include <sstream>

class CommandLineOption
{
public:
    CommandLineOption(char s, const char *l, bool arg) :
        shortopt(s), longopt(strdup(l)), hasArgument(arg), found(false),
        argument(NULL) {}

    ~CommandLineOption() {
        free(longopt);
    }

    char shortopt;
    char *longopt;
    bool hasArgument;
    bool found;
    char *argument;
};

class Getopt
{
public:
    Getopt() {
        verbose = getenv("LCB_VERBOSE_TESTS") != 0;
    }

    Getopt &addOption(CommandLineOption *option) {
        options.push_back(option);
        return *this;
    }

    int populateArgv(const std::vector<std::string> &argv, char **av) {
        std::vector<std::string>::const_iterator it;
        av[0] = const_cast<char *>("getopt-test");
        int ii = 1;

        if (verbose) {
            std::cout << "parse: { ";
        }
        bool needcomma = false;

        for (it = argv.begin(); it != argv.end(); ++it, ++ii) {
            av[ii] = const_cast<char *>(it->c_str());
            if (verbose) {
                if (needcomma) {
                    std::cout << ", ";
                }
                std::cout << it->c_str();
            }
            needcomma = true;
        }
        if (verbose) {
            std::cout << " }" << std::endl;
        }
        return ii;
    }

    bool parse(const std::vector<std::string> &argv) {
        optind = 0;
        optarg = NULL;
        if (argv.size() > 256) {
            return false;
        }
        struct option opts[256];
        char *av[256] = {};
        int argc = populateArgv(argv, av);
        memset(opts, 0, 256 * sizeof(*opts));
        std::stringstream ss;
        std::vector<CommandLineOption *>::iterator iter;
        int ii = 0;
        for (iter = options.begin(); iter != options.end(); ++iter, ++ii) {
            opts[ii].name = (*iter)->longopt;
            opts[ii].has_arg = (*iter)->hasArgument ? required_argument : no_argument;
            opts[ii].val = (*iter)->shortopt;
            ss << (*iter)->shortopt;
            if ((*iter)->hasArgument) {
                ss << ":";
            }
        }

        optarg = NULL;
        optind = 0;
        std::string shortopts = ss.str();
        int c;
        while ((c = getopt_long(argc, av, shortopts.c_str(), opts, NULL)) != -1) {
            for (iter = options.begin(); iter != options.end(); ++iter, ++ii) {
                if ((*iter)->shortopt == c) {
                    (*iter)->found = true;
                    (*iter)->argument = optarg;
                    break;
                }
            }
            if (iter == options.end()) {
                return false;
            }
        }

        return true;
    }

    bool verbose;
    std::vector<CommandLineOption *> options;
};


class GetoptUnitTests : public ::testing::Test
{
protected:
};

class OptionContainer
{
public:
    CommandLineOption optAlpha;
    CommandLineOption optBravo;
    CommandLineOption optCharlie;

    OptionContainer(Getopt &getopt) :
        optAlpha(CommandLineOption('a', "alpha", true)),
        optBravo(CommandLineOption('b', "bravo", false)),
        optCharlie(CommandLineOption('c', "charlie", false))

    {
        setup(getopt);
    }

    void setup(Getopt &getopt) {
        getopt.addOption(&optAlpha).
        addOption(&optBravo).
        addOption(&optCharlie);
    }

    ~OptionContainer() { }
};


// Verify that we allow no options and that the option array is empty
TEST_F(GetoptUnitTests, testParseEmptyNoOptions)
{
    std::vector<std::string> argv;
    Getopt getopt;
    ASSERT_TRUE(getopt.parse(argv));
    ASSERT_EQ(0, getopt.options.size());
    ASSERT_EQ(getopt.options.end(), getopt.options.begin());
}

// Verify that we allow no options and that the option array is empty
TEST_F(GetoptUnitTests, testParseEmpty)
{
    std::vector<std::string> argv;
    Getopt getopt;
    OptionContainer oc(getopt);
    ASSERT_TRUE(getopt.parse(argv));
    EXPECT_NE(getopt.options.end(), getopt.options.begin());

    // validate that none of the options is set
    std::vector<CommandLineOption *>::const_iterator iter;
    for (iter = getopt.options.begin(); iter != getopt.options.end(); ++iter) {
        EXPECT_FALSE((*iter)->found);
    }
}

TEST_F(GetoptUnitTests, testParseOnlyArguments)
{
    std::vector<std::string> argv;
    argv.push_back("foo");
    argv.push_back("bar");
    Getopt getopt;
    OptionContainer oc(getopt);
    ASSERT_TRUE(getopt.parse(argv));

    // validate that none of the options is set
    std::vector<CommandLineOption *>::const_iterator iter;
    for (iter = getopt.options.begin(); iter != getopt.options.end(); ++iter) {
        ASSERT_FALSE((*iter)->found);
    }

    ASSERT_EQ(1, optind);
}

TEST_F(GetoptUnitTests, testParseOnlyArgumentsWithSeparatorInThere)
{
    std::vector<std::string> argv;
    argv.push_back("foo");
    argv.push_back("--");
    argv.push_back("bar");
    Getopt getopt;
    OptionContainer oc(getopt);
    ASSERT_TRUE(getopt.parse(argv));

    // validate that none of the options is set
    std::vector<CommandLineOption *>::const_iterator iter;
    for (iter = getopt.options.begin(); iter != getopt.options.end(); ++iter) {
        EXPECT_FALSE((*iter)->found);
    }
}

TEST_F(GetoptUnitTests, testParseSingleLongoptWithoutArgument)
{
    std::vector<std::string> argv;
    argv.push_back("--bravo");
    Getopt getopt;
    OptionContainer oc(getopt);
    ASSERT_TRUE(getopt.parse(argv));

    // validate that --bravo is set
    std::vector<CommandLineOption *>::const_iterator iter;
    for (iter = getopt.options.begin(); iter != getopt.options.end(); ++iter) {
        if ((*iter)->shortopt == 'b') {
            EXPECT_TRUE((*iter)->found);
        } else {
            EXPECT_FALSE((*iter)->found);
        }
    }
}

TEST_F(GetoptUnitTests, testParseSingleLongoptWithoutRequiredArgument)
{
    std::vector<std::string> argv;
    argv.push_back("--alpha");
    Getopt getopt;
    OptionContainer oc(getopt);
    ASSERT_FALSE(getopt.parse(argv));
}

TEST_F(GetoptUnitTests, testParseSingleLongoptWithRequiredArgument)
{
    std::vector<std::string> argv;
    argv.push_back("--alpha=foo");
    Getopt getopt;
    OptionContainer oc(getopt);
    ASSERT_TRUE(getopt.parse(argv));

    // validate that --alpha is set
    std::vector<CommandLineOption *>::const_iterator iter;
    for (iter = getopt.options.begin(); iter != getopt.options.end(); ++iter) {
        if ((*iter)->shortopt == 'a') {
            EXPECT_TRUE((*iter)->found);
            EXPECT_STREQ("foo", (*iter)->argument);
        } else {
            EXPECT_FALSE((*iter)->found);
        }
    }
}

TEST_F(GetoptUnitTests, testParseSingleLongoptWithRequiredArgument1)
{
    std::vector<std::string> argv;
    argv.push_back("--alpha");
    argv.push_back("foo");
    Getopt getopt;
    OptionContainer oc(getopt);
    ASSERT_TRUE(getopt.parse(argv));

    // validate that --alpha is set
    std::vector<CommandLineOption *>::const_iterator iter;
    for (iter = getopt.options.begin(); iter != getopt.options.end(); ++iter) {
        if ((*iter)->shortopt == 'a') {
            EXPECT_TRUE((*iter)->found);
            EXPECT_STREQ("foo", (*iter)->argument);
        } else {
            EXPECT_FALSE((*iter)->found);
        }
    }
}

TEST_F(GetoptUnitTests, testParseMulipleLongoptWithArgumentsAndOptions)
{
    std::vector<std::string> argv;
    argv.push_back("--alpha=foo");
    argv.push_back("--bravo");
    argv.push_back("--charlie");
    argv.push_back("foo");
    Getopt getopt;
    OptionContainer oc(getopt);
    ASSERT_TRUE(getopt.parse(argv));

    // validate that --alpha, bravo and charlie is set
    std::vector<CommandLineOption *>::const_iterator iter;
    for (iter = getopt.options.begin(); iter != getopt.options.end(); ++iter) {
        EXPECT_TRUE((*iter)->found);
        if ((*iter)->shortopt == 'a') {
            ASSERT_STREQ("foo", (*iter)->argument);
        }
    }

    ASSERT_EQ(4, optind);
}

TEST_F(GetoptUnitTests, testParseMulipleLongoptWithArgumentsAndOptionsAndSeparator)
{

    std::vector<std::string> argv;
    argv.push_back("--alpha=foo");
    argv.push_back("--");
    argv.push_back("--bravo");
    argv.push_back("--charlie");
    argv.push_back("foo");
    Getopt getopt;
    OptionContainer oc(getopt);
    ASSERT_TRUE(getopt.parse(argv));

    std::vector<CommandLineOption *>::const_iterator iter;
    for (iter = getopt.options.begin(); iter != getopt.options.end(); ++iter) {
        if ((*iter)->shortopt == 'a') {
            EXPECT_TRUE((*iter)->found);
            EXPECT_STREQ("foo", (*iter)->argument);
        } else {
            EXPECT_FALSE((*iter)->found);
        }
    }
    ASSERT_EQ(3, optind);
}

TEST_F(GetoptUnitTests, testParseMulipleLongoptWithArgumentsAndOptionsAndSeparator1)
{

    std::vector<std::string> argv;
    argv.push_back("--alpha");
    argv.push_back("foo");
    argv.push_back("--");
    argv.push_back("--bravo");
    argv.push_back("--charlie");
    argv.push_back("foo");
    Getopt getopt;
    OptionContainer oc(getopt);
    ASSERT_TRUE(getopt.parse(argv));

    std::vector<CommandLineOption *>::const_iterator iter;
    for (iter = getopt.options.begin(); iter != getopt.options.end(); ++iter) {
        if ((*iter)->shortopt == 'a') {
            EXPECT_TRUE((*iter)->found);
            EXPECT_STREQ("foo", (*iter)->argument);
        } else {
            EXPECT_FALSE((*iter)->found);
        }
    }
    ASSERT_EQ(4, optind);
}

TEST_F(GetoptUnitTests, testParseSingleShortoptWithoutArgument)
{
    std::vector<std::string> argv;
    argv.push_back("-b");
    Getopt getopt;
    OptionContainer oc(getopt);
    ASSERT_TRUE(getopt.parse(argv));

    // validate that -b is set
    std::vector<CommandLineOption *>::const_iterator iter;
    for (iter = getopt.options.begin(); iter != getopt.options.end(); ++iter) {
        if ((*iter)->shortopt == 'b') {
            EXPECT_TRUE((*iter)->found);
        } else {
            EXPECT_FALSE((*iter)->found);
        }
    }
}

TEST_F(GetoptUnitTests, testParseSingleShortoptWithoutRequiredArgument)
{
    std::vector<std::string> argv;
    argv.push_back("-a");
    Getopt getopt;
    OptionContainer oc(getopt);
    ASSERT_FALSE(getopt.parse(argv));

    // validate that none is set
    std::vector<CommandLineOption *>::const_iterator iter;
    for (iter = getopt.options.begin(); iter != getopt.options.end(); ++iter) {
        EXPECT_FALSE((*iter)->found);
    }
}

TEST_F(GetoptUnitTests, testParseSingleShortoptWithRequiredArgument)
{
    std::vector<std::string> argv;
    argv.push_back("-a");
    argv.push_back("foo");
    Getopt getopt;
    OptionContainer oc(getopt);
    ASSERT_TRUE(getopt.parse(argv));

    // validate that none is set
    std::vector<CommandLineOption *>::const_iterator iter;
    for (iter = getopt.options.begin(); iter != getopt.options.end(); ++iter) {
        if ((*iter)->shortopt == 'a') {
            EXPECT_TRUE((*iter)->found);
            EXPECT_STREQ("foo", (*iter)->argument);
        } else {
            EXPECT_FALSE((*iter)->found);
        }
    }
}

TEST_F(GetoptUnitTests, testParseMulipleShortoptWithArgumentsAndOptions)
{
    std::vector<std::string> argv;
    argv.push_back("-a");
    argv.push_back("foo");
    argv.push_back("-b");
    argv.push_back("-c");
    argv.push_back("foo");

    Getopt getopt;
    OptionContainer oc(getopt);
    ASSERT_TRUE(getopt.parse(argv));
    std::vector<CommandLineOption *>::const_iterator iter;
    for (iter = getopt.options.begin(); iter != getopt.options.end(); ++iter) {
        EXPECT_TRUE((*iter)->found);
        if ((*iter)->shortopt == 'a') {
            EXPECT_STREQ("foo", (*iter)->argument);
        }
    }

    ASSERT_EQ(5, optind);
}

TEST_F(GetoptUnitTests, testParseMulipleShortoptWithArgumentsAndOptionsAndSeparator)
{
    std::vector<std::string> argv;
    argv.push_back("-a");
    argv.push_back("foo");
    argv.push_back("--");
    argv.push_back("-b");
    argv.push_back("-c");
    argv.push_back("foo");

    Getopt getopt;
    OptionContainer oc(getopt);
    ASSERT_TRUE(getopt.parse(argv));
    std::vector<CommandLineOption *>::const_iterator iter;
    for (iter = getopt.options.begin(); iter != getopt.options.end(); ++iter) {
        if ((*iter)->shortopt == 'a') {
            EXPECT_TRUE((*iter)->found);
            EXPECT_STREQ("foo", (*iter)->argument);
        } else {
            EXPECT_FALSE((*iter)->found);
        }
    }

    ASSERT_EQ(4, optind);
}

TEST_F(GetoptUnitTests, testParseMix)
{
    std::vector<std::string> argv;
    argv.push_back("-alpha");
    argv.push_back("foo");
    argv.push_back("-a");
    argv.push_back("bar");
    argv.push_back("-c");
    argv.push_back("--bravo");
    argv.push_back("-bc");
    argv.push_back("foo");

    Getopt getopt;
    OptionContainer oc(getopt);

#ifdef _WIN32
    ASSERT_FALSE(getopt.parse(argv));
#else
    ASSERT_TRUE(getopt.parse(argv));
    std::vector<CommandLineOption *>::const_iterator iter;
    for (iter = getopt.options.begin(); iter != getopt.options.end(); ++iter) {
        EXPECT_TRUE((*iter)->found);
        if ((*iter)->shortopt == 'a') {
            // the second -a overrides the first
            EXPECT_STREQ("bar", (*iter)->argument);
        }
    }

    ASSERT_EQ(7, optind);
#endif
}
