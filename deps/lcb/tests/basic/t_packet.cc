/** for ntohl/htonl */
#ifndef _WIN32
#include <netinet/in.h>
#else
#include "winsock2.h"
#endif

#include <libcouchbase/couchbase.h>
#include "config.h"
#include <gtest/gtest.h>
#include "packetutils.h"

class Packet : public ::testing::Test
{
};

class Pkt {
public:
    Pkt() : pkt(NULL), len(0) {}

    void getq(const std::string& value,
              lcb_uint32_t opaque,
              lcb_uint16_t status = 0,
              lcb_cas_t cas = 0,
              lcb_uint32_t flags = 0)
    {
        protocol_binary_response_getq msg;
        protocol_binary_response_header *hdr = &msg.message.header;
        memset(&msg, 0, sizeof(msg));

        hdr->response.magic = PROTOCOL_BINARY_RES;
        hdr->response.opaque = opaque;
        hdr->response.status = htons(status);
        hdr->response.opcode = PROTOCOL_BINARY_CMD_GETQ;
        hdr->response.cas = lcb_htonll(cas);
        hdr->response.bodylen = htonl((lcb_uint32_t)value.size() + 4);
        hdr->response.extlen = 4;
        msg.message.body.flags = htonl(flags);

        // Pack the response
        clear();
        len = sizeof(msg.bytes) + value.size();
        pkt = new char[len];

        EXPECT_TRUE(pkt != NULL);

        memcpy(pkt, msg.bytes, sizeof(msg.bytes));

        memcpy((char *)pkt + sizeof(msg.bytes),
               value.c_str(),
               (unsigned long)value.size());
    }

    void get(const std::string& key, const std::string& value,
             lcb_uint32_t opaque,
             lcb_uint16_t status = 0,
             lcb_cas_t cas = 0,
             lcb_uint32_t flags = 0)
    {
        protocol_binary_response_getq msg;
        protocol_binary_response_header *hdr = &msg.message.header;
        hdr->response.magic = PROTOCOL_BINARY_RES;
        hdr->response.opaque = opaque;
        hdr->response.cas = lcb_htonll(cas);
        hdr->response.opcode = PROTOCOL_BINARY_CMD_GET;
        hdr->response.keylen = htons((lcb_uint16_t)key.size());
        hdr->response.extlen = 4;
        hdr->response.bodylen = htonl(key.size() + value.size() + 4);
        hdr->response.status = htons(status);
        msg.message.body.flags = flags;

        clear();
        len = sizeof(msg.bytes) + value.size() + key.size();
        pkt = new char[len];
        char *ptr = pkt;

        memcpy(ptr, msg.bytes, sizeof(msg.bytes));
        ptr += sizeof(msg.bytes);
        memcpy(ptr , key.c_str(), (unsigned long)key.size());
        ptr += key.size();
        memcpy(ptr, value.c_str(), (unsigned long)value.size());
    }

    void rbWrite(rdb_IOROPE *ior) {
        rdb_copywrite(ior, pkt, len);
    }

    void rbWriteHeader(rdb_IOROPE *ior) {
        rdb_copywrite(ior, pkt, 24);
    }

    void rbWriteBody(rdb_IOROPE *ior) {
        rdb_copywrite(ior, pkt + 24, len - 24);
    }

    void writeGenericHeader(unsigned long bodylen, rdb_IOROPE *ior) {
        protocol_binary_response_header hdr;
        memset(&hdr, 0, sizeof(hdr));
        hdr.response.opcode = 0;
        hdr.response.bodylen = htonl(bodylen);
        rdb_copywrite(ior, hdr.bytes, sizeof(hdr.bytes));
    }

    ~Pkt() {
        clear();
    }

    void clear() {
        if (pkt != NULL) {
            delete[] pkt;
        }
        pkt = NULL;
        len = 0;
    }

    size_t size() {
        return len;
    }

private:
    char *pkt;
    size_t len;
    Pkt(Pkt&);
};



TEST_F(Packet, testParseBasic)
{
    std::string value = "foo";
    rdb_IOROPE ior;
    rdb_init(&ior, rdb_libcalloc_new());

    Pkt pkt;
    pkt.getq(value, 0);
    pkt.rbWrite(&ior);

    packet_info pi;
    memset(&pi, 0, sizeof(pi));
    unsigned wanted;
    int rv = lcb_pktinfo_ior_get(&pi, &ior, &wanted);
    ASSERT_EQ(rv, 1);

    ASSERT_EQ(0, PACKET_STATUS(&pi));
    ASSERT_EQ(PROTOCOL_BINARY_CMD_GETQ, PACKET_OPCODE(&pi));
    ASSERT_EQ(0, PACKET_OPAQUE(&pi));
    ASSERT_EQ(7, PACKET_NBODY(&pi));
    ASSERT_EQ(3, PACKET_NVALUE(&pi));
    ASSERT_EQ(0, PACKET_NKEY(&pi));
    ASSERT_EQ(4, PACKET_EXTLEN(&pi));
    ASSERT_EQ(PACKET_NBODY(&pi), rdb_get_nused(&ior));
    ASSERT_EQ(0, strncmp(value.c_str(), PACKET_VALUE(&pi), 3));

    lcb_pktinfo_ior_done(&pi, &ior);
    ASSERT_EQ(0, rdb_get_nused(&ior));
    rdb_cleanup(&ior);
}

TEST_F(Packet, testParsePartial)
{
    rdb_IOROPE ior;
    Pkt pkt;
    rdb_init(&ior, rdb_libcalloc_new());

    std::string value;
    value.insert(0, 1024, '*');

    packet_info pi;
    int rv;

    // Test where we're missing just one byte
    pkt.writeGenericHeader(10, &ior);
    unsigned wanted;
    rv = lcb_pktinfo_ior_get(&pi, &ior, &wanted);
    ASSERT_EQ(0, rv);

    for (int ii = 0; ii < 9; ii++) {
        char c = 'O';
        rdb_copywrite(&ior, &c, 1);
        rv = lcb_pktinfo_ior_get(&pi, &ior, &wanted);
        ASSERT_EQ(0, rv);
    }
    char tmp = 'O';
    rdb_copywrite(&ior, &tmp, 1);
    rv = lcb_pktinfo_ior_get(&pi, &ior, &wanted);
    ASSERT_EQ(1, rv);
    lcb_pktinfo_ior_done(&pi, &ior);
    rdb_cleanup(&ior);
}


TEST_F(Packet, testKeys)
{
    rdb_IOROPE ior;
    rdb_init(&ior, rdb_libcalloc_new());
    std::string key = "a simple key";
    std::string value = "a simple value";
    Pkt pkt;
    pkt.get(key, value, 1000, PROTOCOL_BINARY_RESPONSE_ETMPFAIL, 0xdeadbeef, 50);
    pkt.rbWrite(&ior);

    packet_info pi;
    memset(&pi, 0, sizeof(pi));
    unsigned wanted;
    int rv = lcb_pktinfo_ior_get(&pi, &ior, &wanted);
    ASSERT_EQ(1, rv);

    ASSERT_EQ(key.size(), PACKET_NKEY(&pi));
    ASSERT_EQ(0, memcmp(key.c_str(), PACKET_KEY(&pi), PACKET_NKEY(&pi)));
    ASSERT_EQ(value.size(), PACKET_NVALUE(&pi));
    ASSERT_EQ(0, memcmp(value.c_str(), PACKET_VALUE(&pi), PACKET_NVALUE(&pi)));
    ASSERT_EQ(0xdeadbeef, PACKET_CAS(&pi));
    ASSERT_EQ(PROTOCOL_BINARY_RESPONSE_ETMPFAIL, PACKET_STATUS(&pi));
    ASSERT_EQ(PROTOCOL_BINARY_CMD_GET, PACKET_OPCODE(&pi));
    ASSERT_EQ(4, PACKET_EXTLEN(&pi));
    ASSERT_EQ(4 + key.size() + value.size(), PACKET_NBODY(&pi));
    ASSERT_NE(pi.payload, PACKET_VALUE(&pi));
    ASSERT_EQ(4 + key.size(), PACKET_VALUE(&pi) - (char *)pi.payload);

    lcb_pktinfo_ior_done(&pi, &ior);
    rdb_cleanup(&ior);
}
