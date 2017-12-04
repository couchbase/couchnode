#include "config.h"
#include "iotests.h"
#include <map>
#include <libcouchbase/views.h>
#include <libcouchbase/pktfwd.h>
#include "contrib/cJSON/cJSON.h"

namespace {

class ViewsUnitTest : public MockUnitTest
{
protected:
    void SetUp() { }
    void TearDown() { }
    void connectBeerSample(HandleWrap& hw, lcb_t& instance, bool first=true);
};

using std::string;
using std::vector;

extern "C" {
static void bktCreateCb(lcb_t, int, const lcb_RESPBASE *rb) {
    const lcb_RESPHTTP *htr = (const lcb_RESPHTTP *)rb;
    ASSERT_EQ(LCB_SUCCESS, htr->rc);
    ASSERT_TRUE(htr->htstatus > 199 && htr->htstatus < 300);
}
}

void
ViewsUnitTest::connectBeerSample(HandleWrap& hw, lcb_t& instance, bool first)
{
    lcb_create_st crparams;
    lcb_create_st crparamsAdmin;
    MockEnvironment::getInstance()->makeConnectParams(crparams, NULL);
    crparamsAdmin = crparams;

    crparams.v.v2.bucket = "beer-sample";
    if (!CLUSTER_VERSION_IS_HIGHER_THAN(MockEnvironment::VERSION_50)) {
        // We could do CCCP if we really cared.. but it's simpler and makes
        // the logs cleaner.
        crparams.v.v2.user = "beer-sample";
        crparams.v.v2.mchosts = NULL;
        lcb_config_transport_t transports[] = {LCB_CONFIG_TRANSPORT_HTTP, LCB_CONFIG_TRANSPORT_LIST_END};
        crparams.v.v2.transports = transports;
    }

    // See if we can connect:
    lcb_error_t rv = tryCreateConnection(hw, instance, crparams);
    if (rv == LCB_SUCCESS) {
        return;
    } else if (!first) {
        ASSERT_EQ(LCB_SUCCESS, rv);
    }

    ASSERT_TRUE(rv == LCB_BUCKET_ENOENT || rv == LCB_AUTH_ERROR);
    hw.destroy(); // Should really be called clear(), since that's what it does

    // Use the management API to load the beer-sample database
    crparamsAdmin.v.v2.type = LCB_TYPE_CLUSTER;
    crparamsAdmin.v.v2.user = "Administrator";
    crparamsAdmin.v.v2.passwd = "password";
    crparamsAdmin.v.v2.bucket = NULL;

    rv = tryCreateConnection(hw, instance, crparamsAdmin);
    ASSERT_EQ(LCB_SUCCESS, rv);

    const char *path = "/sampleBuckets/install";
    const char *body = "[\"beer-sample\"]";

    lcb_CMDHTTP htcmd = { 0 };
    LCB_CMD_SET_KEY(&htcmd, path, strlen(path));

    htcmd.body = body;
    htcmd.nbody = strlen(body);
    htcmd.method = LCB_HTTP_METHOD_POST;
    htcmd.type = LCB_HTTP_TYPE_MANAGEMENT;
    htcmd.content_type = "application/json";
    lcb_install_callback3(instance, LCB_CALLBACK_HTTP, bktCreateCb);
    lcb_sched_enter(instance);
    rv = lcb_http3(instance, NULL, &htcmd);
    ASSERT_EQ(LCB_SUCCESS, rv);
    lcb_sched_leave(instance);
    lcb_wait(instance);
    hw.destroy();

    // Now it should all be good, so we can call recursively..
    connectBeerSample(hw, instance, false);
}

struct ViewRow {
    string key;
    string value;
    string docid;
    lcb_RESPGET docContents;

    void clear() {
        if (docContents.value) {
            lcb_backbuf_unref((lcb_BACKBUF)docContents.bufh);
            docContents.value = NULL;
        }
    }

    ViewRow(const lcb_RESPVIEWQUERY *resp) {
        const lcb_RESPGET *rg = resp->docresp;

        if (resp->key != NULL) {
            key.assign((const char *)resp->key, resp->nkey);
        }
        if (resp->value != NULL) {
            value.assign((const char *)resp->value, resp->nvalue);
        }

        if (resp->docid != NULL) {
            docid.assign((const char *)resp->docid, resp->ndocid);
            if (rg != NULL) {
                string tmpId((const char *)rg->key, rg->nkey);
                EXPECT_EQ(tmpId, docid);
                docContents = *rg;
                lcb_backbuf_ref((lcb_BACKBUF)docContents.bufh);
            } else {
                memset(&docContents, 0, sizeof docContents);
            }
        } else {
            EXPECT_TRUE(rg == NULL);
            memset(&docContents, 0, sizeof docContents);
        }
    }
};

struct ViewInfo {
    vector<ViewRow> rows;
    size_t totalRows;
    lcb_error_t err;
    short http_status;

    void addRow(const lcb_RESPVIEWQUERY *resp) {
        if (err == LCB_SUCCESS && resp->rc != LCB_SUCCESS) {
            err = resp->rc;
        }

        if (! (resp->rflags & LCB_RESP_F_FINAL)) {
            rows.push_back(ViewRow(resp));

        } else {
            if (resp->value != NULL) {
                // See if we have a 'value' for the final response
                string vBuf(resp->value, resp->nvalue);
                cJSON *cj = cJSON_Parse(resp->value);
                ASSERT_FALSE(cj == NULL);
                cJSON *jTotal = cJSON_GetObjectItem(cj, "total_rows");
                if (jTotal != NULL) {
                    totalRows = jTotal->valueint;
                } else {
                    // Reduce responses might skip total_rows
                    totalRows = rows.size();
                }
                cJSON_Delete(cj);
            }
            if (resp->htresp) {
                http_status = resp->htresp->htstatus;
            }
        }
    }

    void clear() {
        for (size_t ii = 0; ii < rows.size(); ii++) {
            rows[ii].clear();
        }
        rows.clear();
        totalRows = 0;
        http_status = 0;
        err = LCB_SUCCESS;
    }

    ~ViewInfo() {
        clear();
    }

    ViewInfo() {
        clear();
    }
};

extern "C" {
static void viewCallback(lcb_t, int cbtype, const lcb_RESPVIEWQUERY *resp)
{
    EXPECT_EQ(LCB_CALLBACK_VIEWQUERY, cbtype);
//    printf("View Callback invoked!\n");
    ViewInfo *info = reinterpret_cast<ViewInfo*>(resp->cookie);
    info->addRow(resp);
}
}


TEST_F(ViewsUnitTest, testSimpleView)
{
    // Requires beer-sample
    HandleWrap hw;
    lcb_t instance;
    connectBeerSample(hw, instance);

    lcb_CMDVIEWQUERY vq = { 0 };
    lcb_view_query_initcmd(&vq, "beer", "brewery_beers", NULL, viewCallback);
    ViewInfo vi;

    lcb_error_t rc = lcb_view_query(instance, &vi, &vq);
    ASSERT_EQ(LCB_SUCCESS, rc);

    lcb_wait(instance);
    ASSERT_EQ(LCB_SUCCESS, vi.err);
    ASSERT_GT(vi.rows.size(), 0U);
    ASSERT_EQ(7303, vi.totalRows);

    // Check the row parses correctly:
    const ViewRow& row = vi.rows.front();
    // Unquoted docid
    ASSERT_EQ("21st_amendment_brewery_cafe", row.docid);
    ASSERT_EQ("[\"21st_amendment_brewery_cafe\"]", row.key);
    ASSERT_EQ("null", row.value);

    vi.clear();

    //apply limit
    lcb_view_query_initcmd(&vq, "beer", "brewery_beers", "limit=10", viewCallback);

    rc = lcb_view_query(instance, &vi, &vq);
    ASSERT_EQ(LCB_SUCCESS, rc);
    lcb_wait(instance);
    ASSERT_EQ(LCB_SUCCESS, vi.err);
    ASSERT_EQ(10, vi.rows.size());
    ASSERT_EQ(7303, vi.totalRows);
    vi.clear();

    // Set the limit to 0
    lcb_view_query_initcmd(&vq, "beer", "brewery_beers", "limit=0", viewCallback);
    rc = lcb_view_query(instance, &vi, &vq);
    ASSERT_EQ(LCB_SUCCESS, rc);
    lcb_wait(instance);
    ASSERT_EQ(0, vi.rows.size());
    ASSERT_EQ(7303, vi.totalRows);
}

TEST_F(ViewsUnitTest, testIncludeDocs) {
    HandleWrap hw;
    lcb_t instance;
    lcb_error_t rc;
    connectBeerSample(hw, instance);

    ViewInfo vi;
    lcb_CMDVIEWQUERY vq = { 0 };
    lcb_view_query_initcmd(&vq, "beer", "brewery_beers", NULL, viewCallback);
    vq.cmdflags |= LCB_CMDVIEWQUERY_F_INCLUDE_DOCS;
    rc = lcb_view_query(instance, &vi, &vq);
    ASSERT_EQ(LCB_SUCCESS, rc);
    lcb_wait(instance);

    // Again, ensure everything is OK
    ASSERT_EQ(7303, vi.totalRows);
    ASSERT_EQ(7303, vi.rows.size());

    for (size_t ii = 0; ii < vi.rows.size(); ii++) {
        const ViewRow& row = vi.rows[ii];
        ASSERT_FALSE(row.docContents.key == NULL);
        ASSERT_EQ(row.docid.size(), row.docContents.nkey);
        ASSERT_EQ(LCB_SUCCESS, row.docContents.rc);
        ASSERT_NE(0, row.docContents.cas);
    }
}

TEST_F(ViewsUnitTest, testReduce) {
    HandleWrap hw;
    lcb_t instance;
    lcb_error_t rc;
    connectBeerSample(hw, instance);

    ViewInfo vi;
    lcb_CMDVIEWQUERY vq = { 0 };
    lcb_view_query_initcmd(&vq, "beer", "by_location", NULL, viewCallback);
    rc = lcb_view_query(instance, &vi, &vq);
    ASSERT_EQ(LCB_SUCCESS, rc);
    lcb_wait(instance);
    ASSERT_EQ(1, vi.rows.size());
    ASSERT_STREQ("1411", vi.rows[0].value.c_str());

    vi.clear();
    // Try with include_docs
    vq.cmdflags |= LCB_CMDVIEWQUERY_F_INCLUDE_DOCS;
    rc = lcb_view_query(instance, &vi, &vq);
    ASSERT_EQ(LCB_SUCCESS, rc);
    lcb_wait(instance);
    ASSERT_EQ(1, vi.rows.size());

    vi.clear();
    // Try with reduce=false
    vq.cmdflags |= LCB_CMDVIEWQUERY_F_INCLUDE_DOCS;
    lcb_view_query_initcmd(&vq, "beer", "by_location", "reduce=false&limit=10", viewCallback);
    rc = lcb_view_query(instance, &vi, &vq);
    ASSERT_EQ(LCB_SUCCESS, rc);
    lcb_wait(instance);
    ASSERT_EQ(10, vi.rows.size());
    ASSERT_EQ(1411, vi.totalRows);

    ViewRow* firstRow = &vi.rows[0];
    ASSERT_EQ("[\"Argentina\",\"\",\"Mendoza\"]", firstRow->key);
    ASSERT_EQ("1", firstRow->value);
    ASSERT_EQ("cervecera_jerome", firstRow->docid);

    // try with grouplevel
    vi.clear();
    memset(&vq, 0, sizeof vq);
    lcb_view_query_initcmd(&vq, "beer", "by_location", "group_level=1", viewCallback);
    rc = lcb_view_query(instance, &vi, &vq);
    ASSERT_EQ(LCB_SUCCESS, rc);
    lcb_wait(instance);

    firstRow = &vi.rows[0];
    ASSERT_EQ("[\"Argentina\"]", firstRow->key);
    ASSERT_EQ("2", firstRow->value);
    ASSERT_TRUE(firstRow->docid.empty());
}

TEST_F(ViewsUnitTest, testEngineErrors) {
    // Tests various things which can go wrong; basically negative responses
    HandleWrap hw;
    lcb_t instance;
    connectBeerSample(hw, instance);
    lcb_error_t rc;

    ViewInfo vi;
    lcb_CMDVIEWQUERY cmd = { 0 };
    lcb_view_query_initcmd(&cmd, "nonexist", "nonexist", NULL, viewCallback);
    rc = lcb_view_query(instance, &vi, &cmd);
    ASSERT_EQ(LCB_SUCCESS, rc);
    lcb_wait(instance);
    ASSERT_EQ(LCB_HTTP_ERROR, vi.err);
    ASSERT_EQ(404, vi.http_status);

    vi.clear();
    lcb_view_query_initcmd(&cmd, "beer", "badview", NULL, viewCallback);
    rc = lcb_view_query(instance, &vi, &cmd);
    ASSERT_EQ(LCB_SUCCESS, rc);
    lcb_wait(instance);
    ASSERT_EQ(LCB_HTTP_ERROR, vi.err);
    ASSERT_EQ(404, vi.http_status);

    vi.clear();
    lcb_view_query_initcmd(&cmd, "beer", "brewery_beers", "reduce=true", viewCallback);
    rc = lcb_view_query(instance, &vi, &cmd);
    ASSERT_EQ(LCB_SUCCESS, rc);
    lcb_wait(instance);
    ASSERT_EQ(LCB_HTTP_ERROR, vi.err);
    ASSERT_EQ(400, vi.http_status);
}

TEST_F(ViewsUnitTest, testOptionValidation)
{
    HandleWrap hw;
    lcb_t instance;
    connectBeerSample(hw, instance);

    lcb_CMDVIEWQUERY cmd = { 0 };
    ASSERT_EQ(LCB_EINVAL, lcb_view_query(instance, NULL, &cmd));

    cmd.callback = viewCallback;
    ASSERT_EQ(LCB_EINVAL, lcb_view_query(instance, NULL, &cmd));

    cmd.view = "view";
    cmd.nview = strlen("view");
    ASSERT_EQ(LCB_EINVAL, lcb_view_query(instance, NULL, &cmd));

    cmd.ddoc = "design";
    cmd.nddoc = strlen("design");

    // Expect it to fail with flags
    cmd.cmdflags |= LCB_CMDVIEWQUERY_F_INCLUDE_DOCS;
    cmd.cmdflags |= LCB_CMDVIEWQUERY_F_NOROWPARSE;
    ASSERT_EQ(LCB_OPTIONS_CONFLICT, lcb_view_query(instance, NULL, &cmd));
}

TEST_F(ViewsUnitTest, testBackslashDocid)
{
    HandleWrap hw;
    lcb_t instance;
    lcb_error_t rc;
    connectBeerSample(hw, instance);

    string key("backslash\\docid");
    string doc("{\"type\":\"brewery\", \"name\":\"Backslash IPA\"}");
    storeKey(instance, key, doc);

    ViewInfo vi;
    lcb_CMDVIEWQUERY cmd = { 0 };

    lcb_view_query_initcmd(&cmd, "beer", "brewery_beers", "stale=false&key=[\"backslash\\\\docid\"]", viewCallback);
    rc = lcb_view_query(instance, &vi, &cmd);
    ASSERT_EQ(LCB_SUCCESS, rc);
    lcb_wait(instance);
    ASSERT_EQ(LCB_SUCCESS, vi.err);
    ASSERT_EQ(1, vi.rows.size());
    ASSERT_EQ(key, vi.rows[0].docid);

    vi.clear();
    cmd.cmdflags = LCB_CMDVIEWQUERY_F_INCLUDE_DOCS;
    rc = lcb_view_query(instance, &vi, &cmd);
    ASSERT_EQ(LCB_SUCCESS, rc);
    lcb_wait(instance);
    ASSERT_EQ(1, vi.rows.size());
    ASSERT_EQ(doc.size(), vi.rows[0].docContents.nvalue);

    removeKey(instance, key);
    vi.clear();
    rc = lcb_view_query(instance, &vi, &cmd);
    ASSERT_EQ(LCB_SUCCESS, rc);
    lcb_wait(instance);
    ASSERT_EQ(0, vi.rows.size());
}
}
