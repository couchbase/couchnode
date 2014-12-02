/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
#include "config.h"
#include "iotests.h"
#include <map>

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
    ASSERT_GT(ctx.body.size(), 0U);
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
    ASSERT_GE(ii, 0U);
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
    ASSERT_NE(0, LCB_EIFNET(ctx.err));

}

struct HtResult {
    std::string body;
    std::map<std::string,std::string> headers;

    bool gotComplete;
    bool gotChunked;
    lcb_RESPHTTP res;
    void reset() {
        body.clear();
        gotComplete = false;
        gotChunked = false;
        memset(&res, 0, sizeof res);
    }
};

extern "C" {
static void http_callback(lcb_t, int, const lcb_RESPBASE *rb)
{
    const lcb_RESPHTTP *htr = (const lcb_RESPHTTP *)rb;
    HtResult *me = (HtResult *)htr->cookie;

    if (htr->nbody) {
        me->body.append((const char*)htr->body, (const char*)htr->body + htr->nbody);
    }

    if (htr->rflags & LCB_RESP_F_FINAL) {
        me->res = *htr;
        me->gotComplete = true;
        const char * const * cur = htr->headers;
        for (; *cur; cur+=2) {
            me->headers[cur[0]] = cur[1];
        }
    } else {
        me->gotChunked = true;
    }
}
}

static void
makeAdminReq(lcb_CMDHTTP& cmd, std::string& bkbuf)
{
    memset(&cmd, 0, sizeof cmd);
    bkbuf.assign("/pools/default/buckets/default");

    cmd.type = LCB_HTTP_TYPE_MANAGEMENT;
    cmd.method = LCB_HTTP_METHOD_GET;
    LCB_CMD_SET_KEY(&cmd, bkbuf.c_str(), bkbuf.size());
}

// Some more basic HTTP tests for the administrative API. We use the admin
// API since it's always available.
TEST_F(HttpUnitTest, testAdminApi)
{
    lcb_t instance;
    HandleWrap hw;
    std::string pth;
    createConnection(hw, instance);
    lcb_install_callback3(instance, LCB_CALLBACK_HTTP, http_callback);

    // Make the request; this time we make it to the 'management' API
    lcb_CMDHTTP cmd = { 0 };

    makeAdminReq(cmd, pth);
    HtResult htr;
    htr.reset();

    lcb_error_t err;
    lcb_sched_enter(instance);
    err = lcb_http3(instance, &htr, &cmd);
    ASSERT_EQ(LCB_SUCCESS, err);
    lcb_sched_leave(instance);
    lcb_wait(instance);

    ASSERT_TRUE(htr.gotComplete);
    ASSERT_EQ(LCB_SUCCESS, htr.res.rc);
    ASSERT_EQ(200, htr.res.htstatus);
    ASSERT_FALSE(htr.body.empty());

    // Try with a chunked request
    htr.reset();
    cmd.cmdflags |= LCB_CMDHTTP_F_STREAM;
    lcb_sched_enter(instance);
    err = lcb_http3(instance, &htr, &cmd);
    ASSERT_EQ(LCB_SUCCESS, err);
    lcb_sched_leave(instance);
    lcb_wait(instance);

    ASSERT_TRUE(htr.gotComplete);
    ASSERT_TRUE(htr.gotChunked);

    // try another one, but this time cancelling it..
    lcb_http_request_t reqh;
    cmd.reqhandle = &reqh;
    lcb_sched_enter(instance);
    err = lcb_http3(instance, NULL, &cmd);
    ASSERT_EQ(LCB_SUCCESS, err);
    ASSERT_FALSE(reqh == NULL);
    lcb_sched_leave(instance);
    lcb_cancel_http_request(instance, reqh);

    // Try another one, allocating a request body. Unfortunately, we need
    // to cancel this one too, as none of the mock's endpoints support a
    // request body
    cmd.reqhandle = &reqh;
    cmd.body = "FOO";
    cmd.nbody = 3;
    cmd.method = LCB_HTTP_METHOD_PUT;
    err = lcb_http3(instance, NULL, &cmd);
    ASSERT_EQ(LCB_SUCCESS, err);
    ASSERT_FALSE(reqh == NULL);
    lcb_sched_leave(instance);
    lcb_cancel_http_request(instance, reqh);
}


extern "C" {
static void doubleCancel_callback(lcb_t instance, int, const lcb_RESPBASE *rb)
{
    const lcb_RESPHTTP *resp = (const lcb_RESPHTTP *)rb;
    if (resp->rflags & LCB_RESP_F_FINAL) {
        lcb_cancel_http_request(instance, resp->_htreq);
        lcb_cancel_http_request(instance, resp->_htreq);
    }
}
}

TEST_F(HttpUnitTest, testDoubleCancel)
{
    lcb_t instance;
    HandleWrap hw;
    createConnection(hw, instance);
    lcb_install_callback3(instance, LCB_CALLBACK_HTTP, doubleCancel_callback);

    // Make the request; this time we make it to the 'management' API
    lcb_CMDHTTP cmd = { 0 };
    std::string bk;
    makeAdminReq(cmd, bk);
    lcb_sched_enter(instance);
    ASSERT_EQ(LCB_SUCCESS, lcb_http3(instance, NULL, &cmd));
    lcb_sched_leave(instance);
    lcb_wait(instance);
    // No crashes or errors here means we've done OK
}


extern "C" {
static void cancelVerify_callback(lcb_t instance, int, const lcb_RESPBASE *rb)
{
    const lcb_RESPHTTP *resp = (const lcb_RESPHTTP *)rb;
    bool *bCancelled = (bool *)resp->cookie;

    ASSERT_EQ(0, resp->rflags & LCB_RESP_F_FINAL);
    ASSERT_FALSE(*bCancelled);

    lcb_cancel_http_request(instance, resp->_htreq);
    *bCancelled = true;
}
}
// Ensure cancel actually does what it claims to do
TEST_F(HttpUnitTest, testCancelWorks)
{
    lcb_t instance;
    HandleWrap hw;
    createConnection(hw, instance);
    lcb_install_callback3(instance, LCB_CALLBACK_HTTP, cancelVerify_callback);
    lcb_CMDHTTP cmd;
    std::string ss;
    makeAdminReq(cmd, ss);
    // Make it chunked
    cmd.cmdflags |= LCB_CMDHTTP_F_STREAM;
    bool cookie = false;
    lcb_sched_enter(instance);
    ASSERT_EQ(LCB_SUCCESS, lcb_http3(instance, &cookie, &cmd));
    lcb_sched_leave(instance);
    lcb_wait(instance);
}

extern "C" {
static void noInvoke_callback(lcb_t, int, const lcb_RESPBASE*)
{
    EXPECT_FALSE(true) << "This callback should not be invoked!";
}
}
TEST_F(HttpUnitTest, testDestroyWithActiveRequest)
{
    lcb_t instance;
    // Note the one-arg form of createConnection which doesn't come with the
    // magical HandleWrap; this is because we destroy our instance explicitly
    // here.
    createConnection(instance);

    lcb_CMDHTTP cmd;
    std::string ss;
    makeAdminReq(cmd, ss);

    lcb_install_callback3(instance,LCB_CALLBACK_HTTP, noInvoke_callback);
    lcb_sched_enter(instance);
    ASSERT_EQ(LCB_SUCCESS, lcb_http3(instance, NULL, &cmd));
    lcb_sched_leave(instance);
    lcb_destroy(instance);
}
