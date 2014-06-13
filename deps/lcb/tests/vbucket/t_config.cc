#include <libcouchbase/couchbase.h>
#include <libcouchbase/vbucket.h>
#include <gtest/gtest.h>
#include <sstream>
#include <iostream>
#include <fstream>

using std::string;

static string getConfigFile(const char *fname)
{
    // Determine where the file is located?
    string base = "";
    const char *prefix;

    // Locate source directory
    if ((prefix = getenv("CMAKE_CURRENT_SOURCE_DIR"))) {
        base = prefix;
    } else if ((prefix = getenv("srcdir"))) {
        base = prefix;
    } else {
        base = "./../";
    }
    base += "/tests/vbucket/confdata/";
    base += fname;

    // Open the file
    std::ifstream ifs;
    ifs.open(base.c_str());
    if (!ifs.is_open()) {
        std::cerr << "Couldn't open " << base << std::endl;
    }
    EXPECT_TRUE(ifs.is_open());
    std::stringstream ss;
    ss << ifs.rdbuf();
    return ss.str();
}

class ConfigTest : public ::testing::Test {
protected:
    void testConfig(const char *fname, bool checkNew = false);
};


void
ConfigTest::testConfig(const char *fname, bool checkNew)
{
    string testData = getConfigFile(fname);
    lcbvb_CONFIG *vbc = lcbvb_create();
    ASSERT_TRUE(vbc != NULL);
    int rv = lcbvb_load_json(vbc, testData.c_str());
    ASSERT_EQ(0, rv);
    ASSERT_GT(vbc->nsrv, 0);

    if (vbc->dtype == LCBVB_DIST_VBUCKET) {
        ASSERT_GT(vbc->nvb, 0);

        for (unsigned ii = 0; ii < vbc->nvb; ii++) {
            lcbvb_vbmaster(vbc, ii);
            for (unsigned jj = 0; jj < vbc->nrepl; jj++) {
                lcbvb_vbreplica(vbc, ii, jj);
            }
        }
    }

    for (unsigned ii = 0; ii < vbc->nsrv; ++ii) {
        lcbvb_SERVER *srv = LCBVB_GET_SERVER(vbc, ii);
        ASSERT_TRUE(srv->authority != NULL);
        ASSERT_TRUE(srv->hostname != NULL);
        ASSERT_GT(srv->svc.data, 0);
        ASSERT_GT(srv->svc.mgmt, 0);
        if (vbc->dtype == LCBVB_DIST_VBUCKET) {
            ASSERT_GT(srv->svc.views, 0);
            if (checkNew) {
                ASSERT_GT(srv->svc_ssl.views, 0);
            }
        }
        if (checkNew) {
            ASSERT_GT(srv->svc_ssl.data, 0);
            ASSERT_GT(srv->svc_ssl.mgmt, 0);
        }
    }
    if (checkNew) {
        ASSERT_FALSE(NULL == vbc->buuid);
        ASSERT_GT(vbc->revid, -1);
    }

    const char *k = "Hello";
    size_t nk = strlen(k);
    // map the key
    int srvix, vbid;
    lcbvb_map_key(vbc, k, nk, &vbid, &srvix);
    if (vbc->dtype == LCBVB_DIST_KETAMA) {
        ASSERT_EQ(0, vbid);
    } else {
        ASSERT_NE(0, vbid);
    }
    lcbvb_destroy(vbc);
}

TEST_F(ConfigTest, testBasicConfigs)
{
    testConfig("full_25.json");
    testConfig("terse_25.json");
    testConfig("memd_25.json");
    testConfig("terse_30.json", true);
    testConfig("memd_30.json", true);
}

TEST_F(ConfigTest, testGeneration)
{
    lcbvb_CONFIG *cfg = lcbvb_create();
    lcbvb_genconfig(cfg, 4, 1, 1024);
    char *js = lcbvb_save_json(cfg);
    lcbvb_destroy(cfg);

    cfg = lcbvb_create();
    int rv = lcbvb_load_json(cfg, js);
    ASSERT_EQ(0, rv);
    ASSERT_EQ(4, cfg->nsrv);
    ASSERT_EQ(1, cfg->nrepl);
    ASSERT_EQ(LCBVB_DIST_VBUCKET, cfg->dtype);
    ASSERT_EQ(1024, cfg->nvb);
    lcbvb_destroy(cfg);
    free(js);
}
