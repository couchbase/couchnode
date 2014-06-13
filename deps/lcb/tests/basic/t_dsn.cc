#include <gtest/gtest.h>
#include "dsn.h"
class DsnTest : public ::testing::Test
{
protected:
    lcb_DSNPARAMS params;
    const char *errmsg;
    void reinit() {
        lcb_dsn_clean(&params);
        SetUp();
    }
    void SetUp() {
        memset(&params, 0, sizeof params);
        lcb_list_init(&params.hosts);
    }
    void TearDown() {
        lcb_dsn_clean(&params);
    }
};

const lcb_DSNHOST*
findHost(const lcb_DSNPARAMS* params, const char* srch)
{
    lcb_list_t *llcur;
    LCB_LIST_FOR(llcur, &params->hosts) {
        const lcb_DSNHOST *cur = LCB_LIST_ITEM(llcur, lcb_DSNHOST, llnode);
        if (!strcmp(srch, cur->hostname)) {
            return cur;
        }
    }
    return NULL;
}

struct OptionPair {
    std::string key;
    std::string value;
};

bool findOption(const lcb_DSNPARAMS* params, const char *srch, OptionPair& op)
{
    int iter = 0;
    const char *key, *value;
    while ((lcb_dsn_next_option(params, &key, &value, &iter))) {
        if (!strcmp(key, srch)) {
            op.key = key;
            op.value = value;
            return true;
        }
    }
    return false;
}

size_t
countHosts(const lcb_DSNPARAMS *params)
{
    size_t ret = 0;
    lcb_list_t *llcur;
    LCB_LIST_FOR(llcur, &params->hosts) {
        ret++;
    }
    return ret;
}

TEST_F(DsnTest, testParseBasic)
{
    lcb_error_t err;
    err = lcb_dsn_parse("couchbase://1.2.3.4", &params, &errmsg);
    ASSERT_EQ(LCB_SUCCESS, err);

    const lcb_DSNHOST *tmphost;
    tmphost = findHost(&params, "1.2.3.4");
    ASSERT_EQ(1, countHosts(&params));
    ASSERT_FALSE(NULL == tmphost);
    ASSERT_EQ(0, tmphost->port);
    ASSERT_EQ(0, tmphost->type); // Nothing

    reinit();
    // test with bad scheme
    err = lcb_dsn_parse("blah://foo.com", &params, &errmsg);
    ASSERT_NE(LCB_SUCCESS, err) << "Error on bad scheme";

    reinit();
    err = lcb_dsn_parse("couchbase://", &params, &errmsg);
    ASSERT_EQ(LCB_SUCCESS, err) << "Ok with scheme only";

    reinit();
    err = lcb_dsn_parse("", &params, &errmsg);
    ASSERT_NE(LCB_SUCCESS, err) << "Error with empty string";

    reinit();
    err = lcb_dsn_parse("couchbase://?", &params, &errmsg);
    ASSERT_EQ(LCB_SUCCESS, err) << "Ok with only '?'";

    reinit();
    err = lcb_dsn_parse("couchbase://?&", &params, &errmsg);
    ASSERT_EQ(LCB_SUCCESS, err) << "Ok with only '?&'";

}

TEST_F(DsnTest, testParseHosts)
{
    lcb_error_t err;
    err = lcb_dsn_parse("couchbase://foo.com,bar.com,baz.com", &params, &errmsg);
    ASSERT_EQ(3, countHosts(&params));
    ASSERT_FALSE(NULL == findHost(&params, "foo.com"));
    ASSERT_FALSE(NULL == findHost(&params, "bar.com"));
    ASSERT_FALSE(NULL == findHost(&params, "baz.com"));

    // Parse with 'legacy' format
    reinit();
    err = lcb_dsn_parse("couchbase://foo.com:8091", &params, &errmsg);
    ASSERT_EQ(LCB_SUCCESS, err);
    const lcb_DSNHOST *dh = findHost(&params, "foo.com");
    ASSERT_FALSE(NULL == dh);
    ASSERT_STREQ("foo.com", dh->hostname);
    ASSERT_EQ(8091, dh->port);
    ASSERT_EQ(LCB_CONFIG_MCD_PORT, dh->type);

    // parse with invalid port, without specifying protocol
    reinit();
    err = lcb_dsn_parse("couchbase://foo.com:4444", &params, &errmsg);
    ASSERT_EQ(LCB_SUCCESS, err);
    dh = findHost(&params, "foo.com");
    ASSERT_EQ(4444, dh->port);
    ASSERT_TRUE(dh->isMCD());

    reinit();
    err = lcb_dsn_parse("couchbases://foo.com:4444", &params, &errmsg);
    ASSERT_EQ(LCB_SUCCESS, err);
    dh = findHost(&params, "foo.com");
    ASSERT_EQ(LCB_SSL_ENABLED, params.sslopts);
    ASSERT_EQ(4444, dh->port);
    ASSERT_TRUE(dh->isMCDS());

    // Parse with recognized format
    reinit();
    err = lcb_dsn_parse("couchbase://foo.com:4444=mcd", &params, &errmsg);
    ASSERT_EQ(LCB_SUCCESS, err);
    dh = findHost(&params, "foo.com");
    ASSERT_STREQ("foo.com", dh->hostname);
    ASSERT_EQ(4444, dh->port);
    ASSERT_TRUE(dh->isMCD());

    //Parse multiple hosts with ports
    reinit();
    err = lcb_dsn_parse("couchbase://foo.com:4444=mcd,bar.com:5555=mcd",
        &params, &errmsg);
    ASSERT_EQ(LCB_SUCCESS, err);

    dh = findHost(&params, "foo.com");
    ASSERT_FALSE(dh == NULL);
    ASSERT_STREQ("foo.com", dh->hostname);
    ASSERT_EQ(4444, dh->port);
    ASSERT_TRUE(dh->isMCD());

    dh = findHost(&params, "bar.com");
    ASSERT_FALSE(dh == NULL);
    ASSERT_STREQ("bar.com", dh->hostname);
    ASSERT_EQ(5555, dh->port);
    ASSERT_TRUE(dh->isMCD());

    reinit();
    err = lcb_dsn_parse("couchbase+explicit://foo.com,bar.com:4444=mcd", &params, &errmsg);
    ASSERT_NE(LCB_SUCCESS, err) << "Error with mixed portless hosts";

    reinit();
    err = lcb_dsn_parse("couchbase://foo.com,bar.com:4444", &params, &errmsg);
    ASSERT_EQ(LCB_SUCCESS, err);
    dh = findHost(&params, "bar.com");
    ASSERT_EQ(4444, dh->port);
    ASSERT_TRUE(dh->isMCD());
    dh = findHost(&params, "foo.com");
    ASSERT_TRUE(dh->isTypeless());

    reinit();
    err = lcb_dsn_parse("couchbase://foo.com;bar.com;baz.com", &params, &errmsg);
    ASSERT_EQ(LCB_SUCCESS, err) << "Can parse old-style semicolons";
    ASSERT_EQ(3, countHosts(&params));
    ASSERT_FALSE(NULL == findHost(&params, "foo.com"));
    ASSERT_FALSE(NULL == findHost(&params, "bar.com"));
    ASSERT_FALSE(NULL == findHost(&params, "baz.com"));
}

TEST_F(DsnTest, testParseBucket)
{
    lcb_error_t err;
    err = lcb_dsn_parse("couchbase://foo.com/user", &params, &errmsg);
    ASSERT_EQ(LCB_SUCCESS, err);
    ASSERT_STREQ("user", params.bucket) << "Basic bucket parse";

    reinit();
    err = lcb_dsn_parse("couchbase://foo.com/user/", &params, &errmsg);
    ASSERT_EQ(LCB_SUCCESS, err) << "Bucket can have a slash";
    // We can have a bucket using a slash

    reinit();
    err = lcb_dsn_parse("couchbase:///default", &params, &errmsg);
    ASSERT_EQ(LCB_SUCCESS, err) << "Bucket without host OK";
    ASSERT_STREQ("default", params.bucket);

    reinit();
    err = lcb_dsn_parse("couchbase:///default?", &params, &errmsg);
    ASSERT_EQ(LCB_SUCCESS, err);
    ASSERT_STREQ("default", params.bucket);

    reinit();
    err = lcb_dsn_parse("couchbase:///%2FUsers%2F?", &params, &errmsg);
    ASSERT_EQ(LCB_SUCCESS, err);
    ASSERT_STREQ("/Users/", params.bucket);
}

TEST_F(DsnTest, testOptionsPassthrough)
{
    lcb_error_t err;
    err = lcb_dsn_parse("couchbase:///?foo=bar", &params, &errmsg);
    ASSERT_EQ(LCB_SUCCESS, err) << "Options only";
    ASSERT_FALSE(params.ctlopts == NULL);
    ASSERT_NE(0, params.optslen);

    OptionPair op;
    ASSERT_TRUE(findOption(&params, "foo", op));
    ASSERT_EQ("bar", op.value);

    reinit();
    err = lcb_dsn_parse("couchbase://?foo=bar", &params, &errmsg);
    ASSERT_EQ(LCB_SUCCESS, err);
    ASSERT_TRUE(findOption(&params, "foo", op));
    ASSERT_EQ("bar", op.value);

    reinit();
    err = lcb_dsn_parse("couchbase://?foo", &params, &errmsg);
    ASSERT_NE(LCB_SUCCESS, err) << "Option without value";


    // Multiple options
    reinit();
    err = lcb_dsn_parse("couchbase://?foo=fooval&bar=barval", &params, &errmsg);
    ASSERT_EQ(LCB_SUCCESS, err);
    ASSERT_TRUE(findOption(&params, "foo", op));
    ASSERT_EQ("fooval", op.value);

    ASSERT_TRUE(findOption(&params, "bar", op));
    ASSERT_EQ("barval", op.value);

    reinit();
    err = lcb_dsn_parse("couchbase:///protected?ssl=on&compression=off",
        &params, &errmsg);
    ASSERT_EQ(LCB_SUCCESS, err) << "Ok with bucketÊand no hosts";
    ASSERT_EQ(1, countHosts(&params));
    ASSERT_FALSE(NULL == findHost(&params, "localhost"));
    ASSERT_TRUE(findOption(&params, "compression", op));

    reinit();
    err = lcb_dsn_parse("couchbase://?foo=foo&bar=bar&", &params, &errmsg);
    ASSERT_EQ(LCB_SUCCESS, err) << "Ok with trailing '&'";

    reinit();
    err = lcb_dsn_parse("couchbase://?foo=foo&bootstrap_on=all&bar=bar",
        &params, &errmsg);
    ASSERT_EQ(LCB_SUCCESS, err) << "Ok with non-passthrough option";
    ASSERT_TRUE(findOption(&params, "foo", op));
    ASSERT_TRUE(findOption(&params, "bar", op));
    ASSERT_FALSE(findOption(&params, "bootstrap_on", op));
}

TEST_F(DsnTest, testRecognizedOptions)
{
    lcb_error_t err;
    err = lcb_dsn_parse("couchbases://", &params, &errmsg);
    ASSERT_EQ(LCB_SUCCESS, err);
    ASSERT_EQ(LCB_SSL_ENABLED, params.sslopts);

    reinit();
    err = lcb_dsn_parse("couchbase://?ssl=on", &params, &errmsg);
    ASSERT_EQ(LCB_SUCCESS, err);
    ASSERT_EQ(LCB_SSL_ENABLED, params.sslopts);

    reinit();
    err = lcb_dsn_parse("couchbases://?ssl=no_verify", &params, &errmsg);
    ASSERT_EQ(LCB_SUCCESS, err);
    ASSERT_EQ(LCB_SSL_ENABLED|LCB_SSL_NOVERIFY, params.sslopts);

    reinit();
    err = lcb_dsn_parse("couchbases://?ssl=off", &params, &errmsg);
    ASSERT_NE(LCB_SUCCESS, err);

    // Loglevel
    reinit();
    err = lcb_dsn_parse("couchbase://?console_log_level=5", &params, &errmsg);
    ASSERT_EQ(LCB_SUCCESS, err);
    ASSERT_EQ(5, params.loglevel);

    reinit();
    err = lcb_dsn_parse("couchbase://?console_log_level=gah", &params, &errmsg);
    ASSERT_NE(LCB_SUCCESS, err);

}

TEST_F(DsnTest, testTransportOptions)
{
    lcb_error_t err;
    err = lcb_dsn_parse("couchbase://", &params, &errmsg);
    ASSERT_EQ(LCB_SUCCESS, err);
    ASSERT_EQ(LCB_CONFIG_TRANSPORT_LIST_END, params.transports[0]);

    reinit();
    err = lcb_dsn_parse("couchbase://?bootstrap_on=cccp", &params, &errmsg);
    ASSERT_EQ(LCB_SUCCESS, err) << "bootstrap_on=cccp";
    ASSERT_EQ(LCB_CONFIG_TRANSPORT_CCCP, params.transports[0]);
    ASSERT_EQ(LCB_CONFIG_TRANSPORT_LIST_END, params.transports[1]);

    reinit();
    err = lcb_dsn_parse("couchbase://?bootstrap_on=http", &params, &errmsg);
    ASSERT_EQ(LCB_SUCCESS, err) << "bootstrap_on=http";
    ASSERT_EQ(LCB_CONFIG_TRANSPORT_HTTP, params.transports[0]);
    ASSERT_EQ(LCB_CONFIG_TRANSPORT_LIST_END, params.transports[1]);

    reinit();
    err = lcb_dsn_parse("couchbase://?bootstrap_on=all", &params, &errmsg);
    ASSERT_EQ(LCB_SUCCESS, err) << "bootstrap_on=all";
    ASSERT_EQ(LCB_CONFIG_TRANSPORT_CCCP, params.transports[0]);
    ASSERT_EQ(LCB_CONFIG_TRANSPORT_HTTP, params.transports[1]);
    ASSERT_EQ(LCB_CONFIG_TRANSPORT_LIST_END, params.transports[2]);

    reinit();
    err = lcb_dsn_parse("couchbase://?bootstrap_on=bleh", &params, &errmsg);
    ASSERT_NE(LCB_SUCCESS, err) << "Error on bad bootstrap_on value";
}

TEST_F(DsnTest, testCompatConversion)
{
    lcb_error_t err;
    struct lcb_create_st cropts;
    memset(&cropts, 0, sizeof cropts);
    cropts.version = 0;
    cropts.v.v0.bucket = "users";
    cropts.v.v0.host = "foo.com;bar.com;baz.com";
    cropts.v.v0.passwd = "secret";

    err = lcb_dsn_convert(&params, &cropts);
    ASSERT_EQ(LCB_SUCCESS, err);
    ASSERT_FALSE(NULL == findHost(&params, "foo.com"));
    ASSERT_FALSE(NULL == findHost(&params, "bar.com"));
    ASSERT_FALSE(NULL == findHost(&params, "baz.com"));
    ASSERT_EQ(3, countHosts(&params));
    ASSERT_STREQ("users", params.bucket);
    ASSERT_STREQ("secret", params.password);

    // Ensure old-style port specifications are parsed and don't throw an
    // error. We'd also like to verify that these actually land within
    // the htport field, that's a TODO
    reinit();
    memset(&cropts, 0, sizeof cropts);
    cropts.version = 2;
    cropts.v.v2.host = "foo.com:9030;bar.com:9040;baz.com:9050";
    cropts.v.v2.mchosts = "foo.com:7030;bar.com:7040;baz.com:7050";
    err = lcb_dsn_convert(&params, &cropts);
    ASSERT_EQ(LCB_SUCCESS, err);
    ASSERT_EQ(6, countHosts(&params));

    // Ensure struct fields override the URI string
    reinit();
    memset(&cropts, 0, sizeof cropts);
    cropts.version = 3;
    cropts.v.v3.passwd = "secret";
    cropts.v.v3.dsn = "couchbase:///fluffle?password=bleh";
    err = lcb_dsn_convert(&params, &cropts);
    ASSERT_EQ(LCB_SUCCESS, err);
    ASSERT_STREQ("fluffle", params.bucket);
    ASSERT_STREQ(cropts.v.v3.passwd, params.password);
}
