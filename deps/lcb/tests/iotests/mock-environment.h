/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2010-2020 Couchbase, Inc.
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
#ifndef TESTS_MOCK_ENVIRONMENT_H
#define TESTS_MOCK_ENVIRONMENT_H 1

#include "config.h"
#include <gtest/gtest.h>
#include <libcouchbase/couchbase.h>

#include <utility>
#include "serverparams.h"
#include "contrib/lcb-jsoncpp/lcb-jsoncpp.h"

class HandleWrap
{

    friend class MockEnvironment;

  public:
    lcb_INSTANCE *getLcb() const
    {
        return instance;
    }

    void destroy();

    HandleWrap operator=(const HandleWrap &) = delete;

    HandleWrap() : instance(nullptr), iops(nullptr) {}
    virtual ~HandleWrap();

  private:
    lcb_INSTANCE *instance;
    lcb_io_opt_t iops;
};

class MockCommand
{
#define XMOCKCMD(X)                                                                                                    \
    X(FAILOVER)                                                                                                        \
    X(RESPAWN)                                                                                                         \
    X(HICCUP)                                                                                                          \
    X(TRUNCATE)                                                                                                        \
    X(MOCKINFO)                                                                                                        \
    X(PERSIST)                                                                                                         \
    X(CACHE)                                                                                                           \
    X(UNPERSIST)                                                                                                       \
    X(UNCACHE)                                                                                                         \
    X(ENDURE)                                                                                                          \
    X(PURGE)                                                                                                           \
    X(KEYINFO)                                                                                                         \
    X(GET_MCPORTS)                                                                                                     \
    X(SET_CCCP)                                                                                                        \
    X(REGEN_VBCOORDS)                                                                                                  \
    X(RESET_QUERYSTATE)                                                                                                \
    X(OPFAIL)                                                                                                          \
    X(START_RETRY_VERIFY)                                                                                              \
    X(CHECK_RETRY_VERIFY)                                                                                              \
    X(SET_ENHANCED_ERRORS)                                                                                             \
    X(SET_COMPRESSION)                                                                                                 \
    X(SET_SASL_MECHANISMS)

  public:
    enum Code {
#define X(cc) cc,
        XMOCKCMD(X)
#undef X
    };

    static std::string GetName(Code code)
    {

#define X(cc)                                                                                                          \
    if (code == cc) {                                                                                                  \
        return #cc;                                                                                                    \
    }
        XMOCKCMD(X)
#undef X

        abort();
    }

    explicit MockCommand(Code code);

    // Various methods to set a field in the payload
    template <typename T>
    void set(const std::string &s, const T &v)
    {
        (*payload)[s] = v;
    }
    virtual ~MockCommand() = default;

    // Encodes the command in a form suitable for sending over the network
    std::string encode();

  protected:
    Code code;
    std::string name;
    Json::Value command;
    Json::Value *payload;
    virtual void finalizePayload() {}

  private:
    MockCommand(const MockCommand &other);
};

class MockKeyCommand : public MockCommand
{
  public:
    MockKeyCommand(Code code, std::string &key) : MockCommand(code), vbucket(-1)
    {
        this->key = key;
    }

    const std::string &getKey() const
    {
        return key;
    }

    short vbucket;
    std::string bucket;
    std::string key;

  protected:
    void finalizePayload() override;
};

class MockMutationCommand : public MockKeyCommand
{
  public:
    MockMutationCommand(Code code, std::string &key)
        : MockKeyCommand(code, key), onMaster(false), replicaCount(0), cas(0)
    {
    }

    bool onMaster;
    int replicaCount;
    std::vector<int> replicaList;
    uint64_t cas;
    std::string value;

  protected:
    void finalizePayload() override;
};

class MockBucketCommand : public MockCommand
{
  public:
    MockBucketCommand(Code code, int index, const std::string &bucketstr = "default") : MockCommand(code)
    {
        ix = index;
        bucket = bucketstr;
    }

  protected:
    void finalizePayload() override;
    int ix;
    std::string bucket;
};

class MockOpfailCommand : public MockCommand
{
  public:
    MockOpfailCommand(uint16_t errcode, int index, int count = -1, const std::string &bucketstr = "default")
        : MockCommand(OPFAIL)
    {
        set("count", count);
        set("bucket", bucketstr);
        set("code", errcode);

        Json::Value srvlist(Json::arrayValue);
        srvlist.append(index);
        set("servers", srvlist);
    }
};

class MockOpFailClearCommand : public MockCommand
{
  public:
    explicit MockOpFailClearCommand(size_t nservers, const std::string &bucketstr = "default") : MockCommand(OPFAIL)
    {
        set("count", -1);
        set("bucket", bucketstr);
        set("code", 0);

        Json::Value srvlist(Json::arrayValue);
        for (size_t ii = 0; ii < nservers; ++ii) {
            srvlist.append(static_cast<int>(ii));
        }
        set("servers", srvlist);
    }
};

class MockResponse
{
  public:
    MockResponse() = default;
    ~MockResponse() = default;
    void assign(const std::string &s);

    bool isOk();
    const Json::Value &getRawResponse()
    {
        return jresp;
    }
    const Json::Value &constResp() const
    {
        return jresp;
    }

  protected:
    Json::Value jresp;
    friend std::ostream &operator<<(std::ostream &, const MockResponse &);

  private:
    MockResponse(const MockResponse &);
};

class MockEnvironment : public ::testing::Environment
{
  public:
    enum ServerVersion {
        VERSION_UNKNOWN = 0,
        VERSION_40 = 4,
        VERSION_41 = 5,
        VERSION_45 = 6,
        VERSION_46 = 7,
        VERSION_50 = 8,
        VERSION_55 = 9,
        VERSION_60 = 10,
        VERSION_65 = 11,
        VERSION_66 = 12,
        VERSION_70 = 13
    };

    void SetUp() override;
    void TearDown() override;

    static MockEnvironment *getInstance();
    static void Reset();

    /**
     * Make a connect structure you may utilize to connect to
     * the backend we're running the tests towards.
     *
     * @param crst the create structure to fill in
     * @param io the io ops to use (pass nullptr if you don't have a
     *           special io ops you want to use
     */
    void makeConnectParams(lcb_CREATEOPTS *&crst, lcb_io_opt_t io = nullptr, lcb_INSTANCE_TYPE type = LCB_TYPE_BUCKET)
    {
        serverParams.makeConnectParams(crst, io, type);
    }

    /**
     * Get the number of nodes used in the backend
     */
    int getNumNodes() const
    {
        return numNodes;
    }

    /**
     * Are we currently using a real cluster as the backend, or
     * are we using the mock server.
     *
     * You should try your very best to avoid using this variable, and
     * rather extend the mock server to support the requested feature.
     */
    bool isRealCluster() const
    {
        return realCluster;
    }

    /**
     * Simulate node failover. In this case mock will disable server
     * corresponding given index an push new configuration. No data
     * rebalancing implemented on the mock.
     *
     * @param index the index of the node on the mock
     * @param bucket the name of the bucket
     */
    void failoverNode(int index, const std::string &bucket = "default", bool rebalance = true);

    /**
     * Simulate node reconvering. In this case mock will enable server
     * corresponding given index an push new configuration. No data
     * rebalancing implemented on the mock.
     *
     * @param index the index of the node on the mock
     * @param bucket the name of the bucket
     */
    void respawnNode(int index, const std::string &bucket = "default");

    /**
     * Regenerate existing UUIDs and sequence numbers on the cluster to
     * simulate a dcp-style failover. This is a separate command as triggering
     * this during a "Normal" failover severly slows down the mock.
     *
     * @param bucket
     */
    void regenVbCoords(const std::string &bucket = "default");

    /**
     * Retrieve the memcached listening ports for a given bucket
     * @param bucket the bucket for which to retrieve memcached port into
     * @return a vector of ports to use.
     */
    std::vector<int> getMcPorts(const std::string &bucket = "default");

    /**
     * Enable SASL mechanisms on the mock cluster
     * @param mechanisms list of mechanisms to enable
     * @param bucket the bucket on which to enable these mechanisms
     * @param nodes a list of by-index nodes on which to enable mechanisms. If nullptr
     * then all nodes are enabled
     */
    void setSaslMechs(std::vector<std::string> &mechanisms, const std::string &bucket = "",
                      const std::vector<int> *nodes = nullptr);

    /**
     * Enable CCCP on the mock cluster
     * @param bucket the bucket on which to enable CCCP
     * @param nodes a list of by-index nodes on which to enable CCCP. If nullptr
     * then all nodes are enabled
     * @param bucket the bucket on which to
     */
    void setCCCP(bool enabled, const std::string &bucket = "", const std::vector<int> *nodes = nullptr);

    /**
     * Enable enhanced errors on the mock cluster
     *
     * This includes generation event id (ref), and setting context for some errors
     * .
     * @param bucket the bucket on which to enable enhanced errors
     * @param nodes a list of by-index nodes on which to enable Enhanced Errors. If nullptr
     * then all nodes are enabled
     */
    void setEnhancedErrors(bool enabled, const std::string &bucket = "", const std::vector<int> *nodes = nullptr);

    /**
     * Change compression mode on the server
     *
     * @param mode compression mode ("off", "passive", "active")
     * @param bucket the bucket on which to enable compression
     * @param nodes a list of by-index nodes on which to enable compression. If nullptr
     * then all nodes are enabled
     */
    void setCompression(const std::string &mode, const std::string &bucket = "",
                        const std::vector<int> *nodes = nullptr);

    Json::Value getKeyInfo(std::string key, const std::string &bucket = "");

    int getKeyIndex(lcb_INSTANCE *instance, std::string &key, const std::string &bucket = "", int level = 0);

    /**
     * Create a connection to the mock/real server.
     *
     * The instance will be initialized with the the connect parameters
     * to either the mock or a real server (just like makeConnectParams),
     * and call lcb_create. The io instance will be stored in the instance
     * cookie so you may grab it from there.
     *
     * You should call lcb_destroy on the instance when you're done
     * using it.
     *
     * @param instance the instane to create
     */
    void createConnection(lcb_INSTANCE **instance);

    void createConnection(HandleWrap &handle, lcb_INSTANCE **instance);
    void createConnection(HandleWrap &handle, lcb_INSTANCE **instance, const lcb_CREATEOPTS *options) const;

    /**
     * Setup mock to split response in two parts: send first "offset" bytes
     * immediately and send the rest after "msecs" milliseconds.
     *
     * @param msecs the number of milliseconds to wait before sending the
     *              rest of the packet.
     * @param offset the number of the bytes to send in first before delay
     */
    void hiccupNodes(int msecs, int offset);

    ServerVersion getServerVersion() const
    {
        return serverVersion;
    }

    void setServerVersion(ServerVersion ver)
    {
        serverVersion = ver;
    }

    void sendCommand(MockCommand &cmd);
    void getResponse(MockResponse &resp);
    void getResponse()
    {
        MockResponse tmp;
        getResponse(tmp);
    }

    bool hasFeature(const char *feature)
    {
        return featureRegistry.find(feature) != featureRegistry.end();
    }

    static void printSkipMessage(const std::string &file, int line, const std::string &reason)
    {
        std::cerr << "Skipping " << file << ":" << std::dec << line;
        std::cerr << " (" << reason << ")";
        std::cerr << std::endl;
    }

    explicit MockEnvironment(const char **argv, const std::string &name = "default");
    ~MockEnvironment() override;
    void postCreate(lcb_INSTANCE *instance) const;

  protected:
    /**
     * Protected destructor to make it to a singleton
     */
    MockEnvironment() = default;
    /**
     * Handle to the one and only instance of the mock environment
     */
    static MockEnvironment *instance_;

    void bootstrapRealCluster();
    const struct test_server_info *mock{nullptr};
    ServerParams serverParams;
    int numNodes{4};
    bool realCluster{false};
    ServerVersion serverVersion{VERSION_UNKNOWN};
    const char *http{nullptr};
    lcb_io_opt_st *iops{nullptr};
    std::set<std::string> featureRegistry;
    std::string bucket_name_;
    std::string userName;
    const char **argv_{nullptr};
    void clearAndReset();

  private:
    lcb_INSTANCE *innerClient{nullptr};
};

#define LCB_TEST_REQUIRE_CLUSTER_VERSION(v)                                                                            \
    if (!MockEnvironment::getInstance()->isRealCluster()) {                                                            \
        MockEnvironment::printSkipMessage(__FILE__, __LINE__, "need real cluster");                                    \
        return;                                                                                                        \
    }                                                                                                                  \
    if (MockEnvironment::getInstance()->getServerVersion() < v) {                                                      \
        MockEnvironment::printSkipMessage(__FILE__, __LINE__, "needs higher cluster version");                         \
        return;                                                                                                        \
    }

#define LCB_TEST_REQUIRE_FEATURE(s)                                                                                    \
    if (!MockEnvironment::getInstance()->hasFeature(s)) {                                                              \
        MockEnvironment::printSkipMessage(__FILE__, __LINE__, "Feature " s " missing in server implementation");       \
        return;                                                                                                        \
    }

#define CLUSTER_VERSION_IS_HIGHER_THAN(v)                                                                              \
    (MockEnvironment::getInstance()->isRealCluster() && MockEnvironment::getInstance()->getServerVersion() >= v)

#define SKIP_IF_CLUSTER_VERSION_IS_HIGHER_THAN(v)                                                                      \
    if (CLUSTER_VERSION_IS_HIGHER_THAN(v)) {                                                                           \
        MockEnvironment::printSkipMessage(__FILE__, __LINE__, "needs lower cluster version");                          \
        return;                                                                                                        \
    }

#define CLUSTER_VERSION_IS_LOWER_THAN(v)                                                                               \
    (MockEnvironment::getInstance()->isRealCluster() && MockEnvironment::getInstance()->getServerVersion() < v)

#define SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(v)                                                                       \
    if (CLUSTER_VERSION_IS_LOWER_THAN(v)) {                                                                            \
        MockEnvironment::printSkipMessage(__FILE__, __LINE__, "needs higher cluster version");                         \
        return;                                                                                                        \
    }
#endif
