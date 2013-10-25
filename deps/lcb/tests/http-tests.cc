/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
#include "config.h"
#include "mock-unit-test.h"
#include "server.h"

#define DESIGN_DOC_NAME "lcb_design_doc"
#define VIEW_NAME "lcb-test-view"

class HttpUnitTest : public MockUnitTest
{
};

class HttpCmdContext
{
public:
    HttpCmdContext() :
        received(false), dumpIfEmpty(false), dumpIfError(false), cbCount(0)
    { }

    bool received;
    bool dumpIfEmpty;
    bool dumpIfError;
    unsigned cbCount;

    lcb_http_status_t status;
    lcb_error_t err;
    std::string body;
};

static const char *view_common =
    "{ "
    " \"id\" : \"_design/" DESIGN_DOC_NAME "\","
    " \"language\" : \"javascript\","
    " \"views\" : { "
    " \"" VIEW_NAME "\" : {"
    "\"map\":"
    " \"function(doc) { "
    "if (doc.testid == 'lcb') { emit(doc.id) } "
    " } \" "
    " } "
    "}"
    "}";


static void dumpResponse(const lcb_http_resp_t *resp)
{
    if (resp->v.v0.headers) {
        const char *const *hdr;
        for (hdr = resp->v.v0.headers; *hdr; hdr++) {
            std::cout << "Header: " << *hdr << std::endl;
        }
    }
    if (resp->v.v0.bytes) {
        std::cout << "Data: " << std::endl;
        std::cout.write((const char *)resp->v.v0.bytes, resp->v.v0.nbytes);
        std::cout << std::endl;
    }

    std::cout << "Path: " << std::endl;
    std::cout.write(resp->v.v0.path, resp->v.v0.npath);
    std::cout << std::endl;

}

extern "C" {

    static void httpSimpleCallback(lcb_http_request_t request,
                                   lcb_t instance,
                                   const void *cookie,
                                   lcb_error_t error,
                                   const lcb_http_resp_t *resp)
    {
        HttpCmdContext *htctx;
        htctx = reinterpret_cast<HttpCmdContext *>((void *)cookie);
        htctx->err = error;
        htctx->status = resp->v.v0.status;
        htctx->received = true;
        htctx->cbCount++;

        if (resp->v.v0.bytes) {
            htctx->body.assign((const char *)resp->v.v0.bytes, resp->v.v0.nbytes);
        }

        if ((resp->v.v0.nbytes == 0 && htctx->dumpIfEmpty) ||
                (error != LCB_SUCCESS && htctx->dumpIfError)) {
            std::cout << "Count: " << htctx->cbCount << std::endl
                      << "Code: " << error << std::endl
                      << "nBytes: " << resp->v.v0.nbytes << std::endl;
            dumpResponse(resp);
        }
    }
}

/**
 * @test HTTP (Put)
 *
 * @pre Create a valid view document and store it on the server
 * @post Store succeeds and the HTTP result code is 201
 */
TEST_F(HttpUnitTest, testPut)
{
    SKIP_IF_MOCK();
    HandleWrap hw;
    lcb_t instance;
    createConnection(hw, instance);

    const char *design_doc_path = "/_design/" DESIGN_DOC_NAME;
    lcb_http_cmd_st cmd;
    cmd = lcb_http_cmd_st(design_doc_path, strlen(design_doc_path),
                          view_common, strlen(view_common),
                          LCB_HTTP_METHOD_PUT, 0,
                          "application/json");

    lcb_error_t err;
    lcb_set_http_complete_callback(instance, httpSimpleCallback);

    lcb_http_request_t htreq;
    HttpCmdContext ctx;
    ctx.dumpIfError = true;

    err = lcb_make_http_request(instance, &ctx, LCB_HTTP_TYPE_VIEW,
                                &cmd, &htreq);

    ASSERT_EQ(LCB_SUCCESS, err);
    lcb_wait(instance);

    ASSERT_EQ(true, ctx.received);
    ASSERT_EQ(LCB_SUCCESS, ctx.err);
    ASSERT_EQ(LCB_HTTP_STATUS_CREATED, ctx.status);
    ASSERT_EQ(1, ctx.cbCount);

}

/**
 * @test HTTP (Get)
 * @pre Query a value view
 * @post HTTP Result is @c 200, and the view contents look like valid JSON
 * (i.e. the first non-whitespace char is a @c { and the last non-whitespace
 * char is a @c }
 */
TEST_F(HttpUnitTest, testGet)
{
    SKIP_IF_MOCK();

    HandleWrap hw;
    lcb_t instance;
    createConnection(hw, instance);

    const char *path = "_design/" DESIGN_DOC_NAME "/_view/" VIEW_NAME;
    lcb_http_cmd_st cmd = lcb_http_cmd_st(path, strlen(path), NULL, 0,
                                          LCB_HTTP_METHOD_GET, 0,
                                          "application/json");

    HttpCmdContext ctx;
    ctx.dumpIfEmpty = true;
    ctx.dumpIfError = true;

    lcb_set_http_complete_callback(instance, httpSimpleCallback);
    lcb_error_t err;
    lcb_http_request_t htreq;

    err = lcb_make_http_request(instance, &ctx, LCB_HTTP_TYPE_VIEW,
                                &cmd, &htreq);

    ASSERT_EQ(LCB_SUCCESS, err);
    lcb_wait(instance);

    ASSERT_EQ(true, ctx.received);
    ASSERT_EQ(LCB_HTTP_STATUS_OK, ctx.status);
    ASSERT_GT(ctx.body.size(), 0);
    ASSERT_EQ(ctx.cbCount, 1);

    unsigned ii;
    const char *pcur;

    for (ii = 0, pcur = ctx.body.c_str();
            ii < ctx.body.size() && isspace(*pcur); ii++, pcur++) {
        /* no body */
    }

    /**
     * This is a view request. If all is in order, the content should be a
     * JSON object, first non-ws char is "{" and last non-ws char is "}"
     */
    ASSERT_NE(ctx.body.size(), ii);
    ASSERT_EQ(*pcur, '{');

    for (pcur = ctx.body.c_str() + ctx.body.size() - 1;
            ii >= 0 && isspace(*pcur); ii--, pcur--) {
        /* no body */
    }
    ASSERT_GE(ii, 0);
    ASSERT_EQ('}', *pcur);

}

/**
 * @test HTTP (Connection Refused)
 * @bug CCBC-132
 * @pre Create a request of type RAW to @c localhost:1 - nothing should be
 * listening there
 * @post Command returns. Status code is one of CONNECT_ERROR or NETWORK_ERROR
 */
TEST_F(HttpUnitTest, testRefused)
{
    lcb_t instance;
    HandleWrap hw;
    createConnection(hw, instance);

    const char *path = "non-exist-path";
    lcb_http_cmd_st cmd = lcb_http_cmd_st();

    cmd.version = 1;
    cmd.v.v1.host = "localhost:1"; // should not have anything listening on it
    cmd.v.v1.path = "non-exist";
    cmd.v.v1.npath = strlen(cmd.v.v1.path);
    cmd.v.v1.method = LCB_HTTP_METHOD_GET;


    HttpCmdContext ctx;
    ctx.dumpIfEmpty = false;
    ctx.dumpIfError = false;

    lcb_set_http_complete_callback(instance, httpSimpleCallback);
    lcb_error_t err;
    lcb_http_request_t htreq;

    err = lcb_make_http_request(instance, &ctx, LCB_HTTP_TYPE_RAW,
                                &cmd, &htreq);

    ASSERT_EQ(LCB_SUCCESS, err);
    lcb_wait(instance);
    ASSERT_EQ(true, ctx.received);
    ASSERT_TRUE(ctx.err == LCB_CONNECT_ERROR || ctx.err == LCB_NETWORK_ERROR);

}
