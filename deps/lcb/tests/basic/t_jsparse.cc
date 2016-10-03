#include "config.h"
#include <gtest/gtest.h>
#include <libcouchbase/couchbase.h>
#include "jsparse/parser.h"
#include "contrib/lcb-jsoncpp/lcb-jsoncpp.h"
#include "t_jsparse.h"

class JsonParseTest : public ::testing::Test {
};


struct Context {
    lcb_error_t rc;
    bool received_done;
    std::string meta;
    std::vector<std::string> rows;
    Context() {
        reset();
    }
    void reset() {
        rc = LCB_SUCCESS;
        received_done = false;
        meta.clear();
        rows.clear();
    }
};

class Parser {
public:
    Parser(int mode_) : mode(mode_), inner(NULL) {
        reset();
    }

    void reset() {
        if (inner != NULL) {
            lcbjsp_free(inner);
        }
        inner = lcbjsp_create(mode);
    }

    ~Parser() {
        if (inner != NULL) {
            lcbjsp_free(inner);
        }
    }

    operator lcbjsp_PARSER* () {
        return inner;
    }

    lcbjsp_PARSER *getInner() {
        return inner;
    }

private:
    int mode;
    lcbjsp_PARSER *inner;
    Parser(Parser&);
};

static std::string iov2s(const lcb_IOV& iov) {
    return std::string(reinterpret_cast<const char*>(iov.iov_base), iov.iov_len);
}

extern "C" {
static void rowCallback(lcbjsp_PARSER *parser, const lcbjsp_ROW *row) {
    Context *ctx = reinterpret_cast<Context*>(parser->data);
    if (row->type == LCBJSP_TYPE_ERROR) {
        ctx->rc = LCB_PROTOCOL_ERROR;
        ctx->received_done = true;
    } else if (row->type == LCBJSP_TYPE_ROW) {
        ctx->rows.push_back(iov2s(row->row));
    } else if (row->type == LCBJSP_TYPE_COMPLETE) {
        ctx->meta = iov2s(row->row);
        ctx->received_done = true;
    }
}
}

static bool validateJsonRows(const char *txt, size_t ntxt, int mode)
{
    Parser parser(mode);
    EXPECT_TRUE(parser != NULL);
    if (parser == NULL) {
        return false;
    }

    // Feed it once
    Context cx;
    parser.getInner()->callback = rowCallback;
    parser.getInner()->data = &cx;

    for (size_t ii = 0; ii < ntxt; ii++) {
        lcbjsp_feed(parser, txt + ii, 1);
    }
    EXPECT_EQ(LCB_SUCCESS, cx.rc);

    lcb_IOV out;
    lcbjsp_get_postmortem(parser, &out);
    EXPECT_EQ(cx.meta, iov2s(out));
    Json::Value root;
    EXPECT_TRUE(Json::Reader().parse(cx.meta, root));
    return true;
}

static bool validateBadParse(const char *txt, size_t ntxt, int mode)
{
    Parser p(mode);
    Context cx;
    p.getInner()->callback = rowCallback;
    p.getInner()->data = &cx;
    lcbjsp_feed(p, JSON_fts_bad, sizeof(JSON_fts_bad));
    EXPECT_EQ(LCB_PROTOCOL_ERROR, cx.rc);

    p.reset();
    cx.reset();

    p.getInner()->callback = rowCallback;
    p.getInner()->data = &cx;

    for (size_t ii = 0; ii < ntxt; ++ii) {
    }
    return true;
}

TEST_F(JsonParseTest, testFTS)
{
    ASSERT_TRUE(validateJsonRows(JSON_fts_good, sizeof(JSON_fts_good), LCBJSP_MODE_FTS));
    ASSERT_TRUE(validateBadParse(JSON_fts_bad, sizeof(JSON_fts_bad), LCBJSP_MODE_FTS));
    ASSERT_TRUE(validateBadParse(JSON_fts_bad2, sizeof(JSON_fts_bad2), LCBJSP_MODE_FTS));
}

TEST_F(JsonParseTest, testN1QL) {
    ASSERT_TRUE(validateJsonRows(JSON_n1ql_nonempty, sizeof(JSON_n1ql_nonempty), LCBJSP_MODE_N1QL));
    ASSERT_TRUE(validateJsonRows(JSON_n1ql_empty, sizeof(JSON_n1ql_empty), LCBJSP_MODE_N1QL));
    ASSERT_TRUE(validateBadParse(JSON_n1ql_bad, sizeof(JSON_n1ql_bad), LCBJSP_MODE_N1QL));
}
