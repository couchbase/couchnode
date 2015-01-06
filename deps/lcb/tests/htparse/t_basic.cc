#include <gtest/gtest.h>
#include <lcbht/lcbht.h>
#include <sstream>
#include <map>
#include "settings.h"

using std::string;

class HtparseTest : public ::testing::Test {
};

TEST_F(HtparseTest, testBasic)
{
    lcb_settings *settings = lcb_settings_new();
    // Allocate a parser
    lcbht_pPARSER parser = lcbht_new(settings);
    ASSERT_FALSE(parser == NULL);

    // Feed the parser some stuff
    lcbht_RESPSTATE state;

    string buf;
    buf = "HTTP/1.0 200 OK\r\n";

    state = lcbht_parse(parser, buf.c_str(), buf.size());
    ASSERT_EQ(0, state);

    buf = "Connec";
    state = lcbht_parse(parser, buf.c_str(), buf.size());
    ASSERT_EQ(0, state);
    buf = "tion: Keep-Alive\r\n";
    state = lcbht_parse(parser, buf.c_str(), buf.size());
    ASSERT_EQ(0, state);
    buf += "Content-Length: 5\r\n\r\n";
    state = lcbht_parse(parser, buf.c_str(), buf.size());
    ASSERT_EQ(LCBHT_S_HEADER|LCBHT_S_HTSTATUS, state);

    lcbht_RESPONSE *resp = lcbht_get_response(parser);
    ASSERT_EQ(200, resp->status);

    // Add some data into the body
    buf = "H";
    state = lcbht_parse(parser, buf.c_str(), buf.size());
    ASSERT_EQ(0, state & LCBHT_S_ERROR);
    ASSERT_STREQ("H", resp->body.base);

    buf = "ello";
    state = lcbht_parse(parser, buf.c_str(), buf.size());
    ASSERT_NE(0, state & LCBHT_S_DONE);
    ASSERT_STREQ("Hello", resp->body.base);

    // Now find the header

    lcbht_free(parser);
    lcb_settings_unref(settings);
}

TEST_F(HtparseTest, testHeaderFunctions)
{
    lcb_settings *settings = lcb_settings_new();
    lcbht_pPARSER parser = lcbht_new(settings);

    string buf = "HTTP/1.0 200 OK\r\n"
            "Connection: keep-alive\r\n"
            "X-Server: dummy/1.0\r\n"
            "Content-Type: application/json\r\n"
            "Content-Length: 0\r\n"
            "\r\n";
    lcbht_RESPSTATE state;
    state = lcbht_parse(parser, buf.c_str(), buf.size());
    ASSERT_NE(0, state & LCBHT_S_DONE);

    lcbht_RESPONSE *resp = lcbht_get_response(parser);
    // Now fine the header value stuff
    ASSERT_STREQ("keep-alive", lcbht_get_resphdr(resp, "Connection"));
    ASSERT_STREQ("dummy/1.0", lcbht_get_resphdr(resp, "X-Server"));
    ASSERT_STREQ("application/json", lcbht_get_resphdr(resp, "Content-Type"));

    using std::map;
    map<string,string> hdrmap;
    char **hdrlist = lcbht_make_resphdrlist(resp);
    for (char **cur = hdrlist; *cur != NULL; cur += 2) {
        string k = cur[0];
        string v = cur[1];
        hdrmap[k] = v;
        free(cur[0]);
        free(cur[1]);
    }
    free(hdrlist);

    ASSERT_EQ("keep-alive", hdrmap["Connection"]);
    ASSERT_EQ("dummy/1.0", hdrmap["X-Server"]);
    ASSERT_EQ("application/json", hdrmap["Content-Type"]);

    lcbht_free(parser);
    lcb_settings_unref(settings);
}

TEST_F(HtparseTest, testParseErrors)
{
    lcb_settings *settings = lcb_settings_new();
    lcbht_pPARSER parser = lcbht_new(settings);

    string buf = "blahblahblah";
    lcbht_RESPSTATE state = lcbht_parse(parser, buf.c_str(), buf.size());
    ASSERT_NE(0, state & LCBHT_S_ERROR);
    lcbht_free(parser);
    lcb_settings_unref(settings);
}


TEST_F(HtparseTest, testParseExtended)
{
    lcb_settings *settings = lcb_settings_new();
    lcbht_pPARSER parser = lcbht_new(settings);
    lcbht_RESPONSE *resp;

    const char *body;
    unsigned nbody, nused;

    string buf = "HTTP/1.0 200 OK\r\n"
            "Connection: keep-alive\r\n"
            "Content-Length: 5\r\n";

    lcbht_RESPSTATE state;
    state = lcbht_parse_ex(parser, buf.c_str(), buf.size(), &nused, &nbody, &body);
    ASSERT_EQ(0, state & LCBHT_S_ERROR);
    ASSERT_EQ(NULL, body);
    ASSERT_EQ(buf.size(), nused);
    ASSERT_EQ(0, nbody);

    resp = lcbht_get_response(parser);
    buf = "\r\nHello";
    // Feed the buffer
    state = lcbht_parse_ex(parser, buf.c_str(), buf.size(), &nused, &nbody, &body);
    ASSERT_EQ(0, state & LCBHT_S_DONE);
    ASSERT_EQ(5, nbody);
    ASSERT_FALSE(NULL == body);
    ASSERT_STREQ("Hello", body);
    ASSERT_EQ(buf.size()-1, nused);

    size_t off = nused;

    // Parse again
    state = lcbht_parse_ex(parser, buf.c_str()+off, buf.size()-off, &nused, &nbody, &body);
    ASSERT_EQ(nused, buf.size()-off);
    ASSERT_TRUE(body == NULL);
    ASSERT_EQ(0, nbody);
    ASSERT_NE(0, state & LCBHT_S_DONE);
    ASSERT_EQ(0, state & LCBHT_S_ERROR);
    ASSERT_EQ(0, resp->body.nused);

    lcbht_free(parser);
    lcb_settings_unref(settings);
}

TEST_F(HtparseTest, testCanKeepalive)
{
    lcb_settings *settings = lcb_settings_new();
    lcbht_pPARSER parser = lcbht_new(settings);
    string buf = "HTTP/1.0 200 OK\r\n"
            "Content-Length: 0\r\n"
            "\r\n";
    lcbht_RESPSTATE state;
    state = lcbht_parse(parser, buf.c_str(), buf.size());
    ASSERT_NE(0, state & LCBHT_S_DONE);
    ASSERT_EQ(0, state & LCBHT_S_ERROR);
    ASSERT_EQ(0, lcbht_can_keepalive(parser));

    // Use HTTP/1.1 with Connection: close
    lcbht_reset(parser);
    buf = "HTTP/1.1 200 OK\r\n"
            "Content-Length: 0\r\n"
            "Connection: close\r\n"
            "\r\n";
    state = lcbht_parse(parser, buf.c_str(), buf.size());
    ASSERT_NE(0, state & LCBHT_S_DONE);
    ASSERT_EQ(0, state & LCBHT_S_ERROR);
    ASSERT_EQ(0, lcbht_can_keepalive(parser));

    lcbht_reset(parser);
    // Default HTTP/1.1
    buf = "HTTP/1.1 200 OK\r\n"
            "Content-Length: 0\r\n"
            "\r\n";
    state = lcbht_parse(parser, buf.c_str(), buf.size());
    ASSERT_NE(0, state & LCBHT_S_DONE);
    ASSERT_EQ(0, state & LCBHT_S_ERROR);
    ASSERT_NE(0, lcbht_can_keepalive(parser));

    lcbht_free(parser);
    lcb_settings_unref(settings);
}
