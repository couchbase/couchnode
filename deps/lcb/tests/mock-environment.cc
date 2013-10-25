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

#include "server.h"
#include "mock-environment.h"
#include <sstream>

MockEnvironment *MockEnvironment::instance;

MockEnvironment *MockEnvironment::getInstance(void)
{
    if (instance == NULL) {
        instance = new MockEnvironment;
    }
    return instance;
}

MockEnvironment *MockEnvironment::createSpecial(const char **argv)
{
    MockEnvironment *env = new MockEnvironment();
    env->argv = argv;
    env->SetUp();
    return env;
}

void MockEnvironment::Reset()
{
    if (instance != NULL) {
        instance->TearDown();
        instance->SetUp();
    }
}

MockEnvironment::MockEnvironment() : mock(NULL), numNodes(10),
    realCluster(false),
    serverVersion(VERSION_UNKNOWN),
    http(NULL),
    argv(NULL)
{
    // No extra init needed
}

void MockEnvironment::failoverNode(int index, std::string bucket)
{
    MockBucketCommand bCmd(MockCommand::FAILOVER, index, bucket);
    sendCommand(bCmd);
    getResponse();
}

void MockEnvironment::respawnNode(int index, std::string bucket)
{
    MockBucketCommand bCmd(MockCommand::RESPAWN, index, bucket);
    sendCommand(bCmd);
    getResponse();
    std::stringstream cmdbuf;
}

void MockEnvironment::hiccupNodes(int msecs, int offset)
{
    MockCommand cmd(MockCommand::HICCUP);
    cmd.set("msecs", msecs);
    cmd.set("offset", offset);
    sendCommand(cmd);
    getResponse();
}

void MockEnvironment::sendCommand(MockCommand &cmd)
{
    std::string s = cmd.encode();
    lcb_ssize_t nw = send(mock->client, s.c_str(), (unsigned long)s.size(), 0);
    assert(nw == s.size());
}

MockResponse MockEnvironment::getResponse()
{
    std::string rbuf;
    do {
        char c;
        int rv = recv(mock->client, &c, 1, 0);
        assert(rv == 1);
        if (c == '\n') {
            break;
        }
        rbuf += c;
    } while (true);
    return MockResponse(rbuf);
}

void MockEnvironment::createConnection(HandleWrap &handle, lcb_t &instance)
{
    lcb_io_opt_t io;
    if (lcb_create_io_ops(&io, NULL) != LCB_SUCCESS) {
        fprintf(stderr, "Failed to create IO instance\n");
        exit(1);
    }

    lcb_create_st options;
    makeConnectParams(options, io);
    lcb_error_t err = lcb_create(&instance, &options);
    ASSERT_EQ(LCB_SUCCESS, err);

    (void)lcb_set_cookie(instance, io);

    handle.instance = instance;
    handle.iops = io;
}

void MockEnvironment::createConnection(lcb_t &instance)
{
    HandleWrap handle;
    createConnection(handle, instance);

    handle.iops->v.v0.need_cleanup = 1;
    handle.instance = NULL;
    handle.iops = NULL;

}

#define STAT_EP_VERSION "ep_version"

extern "C" {
    static void statsCallback(lcb_t, const void *cookie,
                              lcb_error_t err,
                              const lcb_server_stat_resp_t *resp)
    {
        MockEnvironment *me = (MockEnvironment *)cookie;
        ASSERT_EQ(LCB_SUCCESS, err);

        if (resp->v.v0.server_endpoint == NULL) {
            return;
        }

        if (!resp->v.v0.nkey) {
            return;
        }

        if (resp->v.v0.nkey != sizeof(STAT_EP_VERSION) - 1  ||
                memcmp(resp->v.v0.key, STAT_EP_VERSION,
                       sizeof(STAT_EP_VERSION) - 1) != 0) {
            return;
        }
        int version = ((const char *)resp->v.v0.bytes)[0] - '0';
        if (version == 1) {
            me->setServerVersion(MockEnvironment::VERSION_10);
        } else if (version == 2) {
            me->setServerVersion(MockEnvironment::VERSION_20);

        } else {
            std::cerr << "Unable to determine version from string '";
            std::cerr.write((const char *)resp->v.v0.bytes,
                            resp->v.v0.nbytes);
            std::cerr << "' assuming 1.x" << std::endl;

            me->setServerVersion(MockEnvironment::VERSION_10);
        }
    }
}

void MockEnvironment::bootstrapRealCluster()
{
    serverParams = ServerParams(mock->http, mock->bucket,
                                mock->username, mock->password);

    lcb_t tmphandle;
    lcb_error_t err;
    lcb_create_st options;
    serverParams.makeConnectParams(options, NULL);

    bool verbose = getenv("LCB_VERBOSE_TESTS") != 0;


    ASSERT_EQ(LCB_SUCCESS, lcb_create(&tmphandle, &options));
    ASSERT_EQ(LCB_SUCCESS, lcb_connect(tmphandle));
    lcb_wait(tmphandle);

    lcb_set_stat_callback(tmphandle, statsCallback);
    lcb_server_stats_cmd_t scmd, *pscmd;
    pscmd = &scmd;
    err = lcb_server_stats(tmphandle, this, 1, &pscmd);
    ASSERT_EQ(LCB_SUCCESS, err);
    lcb_wait(tmphandle);

    if (verbose) {
        std::cout << "Detected cluster version " << std::dec << serverVersion;
        std::cout << std::endl;
    }

    const char *const *servers = lcb_get_server_list(tmphandle);
    if (verbose) {
        std::cout << "Using the following servers: " << std::endl;
    }

    int ii;
    for (ii = 0; servers[ii] != NULL; ii++) {
        if (verbose) {
            std::cout << "[" << servers[ii] << "]" << std::endl;
        }
    }

    if (serverVersion == VERSION_20) {
        // Couchbase 2.0.x
        featureRegistry.insert("observe");
        featureRegistry.insert("views");
        featureRegistry.insert("http");
        featureRegistry.insert("replica_read");
        featureRegistry.insert("lock");
    }

    numNodes = ii;
    lcb_destroy(tmphandle);
}

extern "C" {
    static void mock_flush_callback(lcb_t instance,
                                    const void *cookie,
                                    lcb_error_t err,
                                    const lcb_flush_resp_t *resp)
    {
        assert(err == LCB_SUCCESS);
    }
}
void MockEnvironment::SetUp()
{
    if (mock) {
        if (is_using_real_cluster()) {
            return;
        }

        for (int ii = 0; ii < getNumNodes(); ii++) {
            respawnNode(ii, "default");
        }

        HandleWrap hw;
        lcb_t instance;
        lcb_error_t err;

        createConnection(hw, instance);
        lcb_set_flush_callback(instance, mock_flush_callback);

        err = lcb_connect(instance);
        ASSERT_EQ(LCB_SUCCESS, err);

        err = lcb_wait(instance);
        ASSERT_EQ(LCB_SUCCESS, err);

        lcb_flush_cmd_t fcmd;
        const lcb_flush_cmd_t *fcmd_p = &fcmd;
        memset(&fcmd, 0, sizeof(fcmd));

        err = lcb_flush(instance, NULL, 1, &fcmd_p);
        ASSERT_EQ(LCB_SUCCESS, err);

        err = lcb_wait(instance);
        ASSERT_EQ(LCB_SUCCESS, err);

        return;
    }

    mock = (struct test_server_info *)start_test_server((char **)argv);
    realCluster = is_using_real_cluster() != 0;
    ASSERT_NE((const void *)(NULL), mock);
    http = get_mock_http_server(mock);
    ASSERT_NE((const char *)(NULL), http);

    if (realCluster) {
        bootstrapRealCluster();
    } else {
        const char *name = getenv("LCB_TEST_BUCKET");
        serverParams = ServerParams(http, name, name, NULL);
        numNodes = 10;

        // Mock 0.6
        featureRegistry.insert("observe");
        featureRegistry.insert("views");
        featureRegistry.insert("replica_read");
        featureRegistry.insert("lock");
    }
}

void MockEnvironment::TearDown()
{

}

MockEnvironment::~MockEnvironment()
{
    shutdown_mock_server(mock);
    mock = NULL;
}

void HandleWrap::destroy()
{
    if (instance) {
        lcb_destroy(instance);
    }
    if (iops) {
        lcb_destroy_io_ops(iops);
    }

    instance = NULL;
    iops = NULL;
}

HandleWrap::~HandleWrap()
{
    destroy();
}

MockCommand::MockCommand(Code code)
{
    this->code = code;
    name = GetName(code);
    command = cJSON_CreateObject();
    payload = cJSON_CreateObject();
    cJSON_AddItemToObject(command, "payload", payload);
    cJSON_AddStringToObject(command, "command", name.c_str());
}

MockCommand::~MockCommand()
{
    cJSON_Delete(command);
    payload = NULL;
    command = NULL;
}

void MockCommand::set(const std::string &field, const std::string &value)
{
    cJSON_AddStringToObject(payload, field.c_str(), value.c_str());
}

void MockCommand::set(const std::string &field, int value)
{
    cJSON *num = cJSON_CreateNumber(value);
    assert(num);
    cJSON_AddItemToObject(payload, field.c_str(), num);
}

void MockCommand::set(const std::string field, bool value)
{
    cJSON *v = value ? cJSON_CreateTrue() : cJSON_CreateFalse();
    cJSON_AddItemToObject(payload, field.c_str(), v);
}

std::string MockCommand::encode()
{
    finalizePayload();
    char *s = cJSON_PrintUnformatted(command);
    std::string ret(s);
    ret += "\n";
    free(s);
    return ret;
}

void MockKeyCommand::finalizePayload()
{
    MockCommand::finalizePayload();
    if (vbucket != -1) {
        set("vBucket", vbucket);
    }

    if (!bucket.empty()) {
        set("Bucket", bucket);
    }
    set("Key", key);
}

void MockMutationCommand::finalizePayload()
{
    MockKeyCommand::finalizePayload();
    set("OnMaster", onMaster);

    if (!replicaList.empty()) {
        cJSON *arr = cJSON_CreateArray();
        for (std::vector<int>::iterator ii = replicaList.begin();
                ii != replicaList.end(); ii++) {
            cJSON_AddItemToArray(arr, cJSON_CreateNumber(*ii));
        }
        cJSON_AddItemToObject(payload, "OnReplicas", arr);

    } else {
        set("OnReplicas", replicaCount);
    }

    if (cas != 0) {
        if (cas > (1LU << 30)) {
            fprintf(stderr, "Detected incompatible > 31 bit integer\n");
            abort();
        }
        set("CAS", (int)cas);
    }

    if (!value.empty()) {
        set("Value", value);
    }
}

void MockBucketCommand::finalizePayload()
{
    MockCommand::finalizePayload();
    set("idx", ix);
    set("bucket", bucket);
}

MockResponse::MockResponse(const std::string &resp)
{
    jresp = cJSON_Parse(resp.c_str());
    assert(jresp);
}

MockResponse::~MockResponse()
{
    if (jresp) {
        cJSON_Delete(jresp);
    }
}

bool MockResponse::isOk()
{
    cJSON *status = cJSON_GetObjectItem(jresp, "status");

    if (!status) {
        return false;
    }

    if (status->type != cJSON_String) {
        return false;
    }

    if (tolower(status->valuestring[0]) != 'o') {
        return false;
    }

    return true;

}
