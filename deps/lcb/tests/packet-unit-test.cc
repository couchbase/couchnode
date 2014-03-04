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
        hdr->response.cas = cas;
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
        hdr->response.cas = cas;
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

    void rbWrite(ringbuffer_t *rb) {
        EXPECT_NE(0, ringbuffer_ensure_capacity(rb, len));
        lcb_size_t nw = ringbuffer_write(rb, pkt, len);
        EXPECT_EQ(len, nw);
    }

    void rbWriteHeader(ringbuffer_t *rb) {
        EXPECT_NE(0, ringbuffer_ensure_capacity(rb, 24));
        lcb_size_t nw = ringbuffer_write(rb, pkt, 24);
        EXPECT_EQ(24, nw);
    }

    void rbWriteBody(ringbuffer_t *rb) {
        EXPECT_NE(0, ringbuffer_ensure_capacity( rb, len - 24));
        lcb_size_t nw = ringbuffer_write(rb, pkt + 24, len - 24);
        EXPECT_EQ(len - 24, nw);
    }

    void writeGenericHeader(unsigned long bodylen, ringbuffer_t *rb) {
        protocol_binary_response_header hdr;
        memset(&hdr, 0, sizeof(hdr));
        hdr.response.opcode = 0;
        hdr.response.bodylen = htonl(bodylen);
        ringbuffer_write(rb, hdr.bytes, sizeof(hdr.bytes));
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
    ringbuffer_t rb;

    memset(&rb, 0, sizeof(rb));
    ASSERT_NE(0, ringbuffer_initialize(&rb, 10));

    Pkt pkt;
    pkt.getq(value, 0);
    pkt.rbWrite(&rb);

    packet_info pi;
    memset(&pi, 0, sizeof(pi));
    int rv = lcb_packet_read_ringbuffer(&pi, &rb);
    ASSERT_EQ(rv, 1);

    ASSERT_EQ(0, PACKET_STATUS(&pi));
    ASSERT_EQ(PROTOCOL_BINARY_CMD_GETQ, PACKET_OPCODE(&pi));
    ASSERT_EQ(0, PACKET_OPAQUE(&pi));
    ASSERT_EQ(7, PACKET_NBODY(&pi));
    ASSERT_EQ(3, PACKET_NVALUE(&pi));
    ASSERT_EQ(0, PACKET_NKEY(&pi));
    ASSERT_EQ(4, PACKET_EXTLEN(&pi));
    ASSERT_EQ(PACKET_NBODY(&pi), rb.nbytes);
    ASSERT_EQ(0, strncmp(value.c_str(), PACKET_VALUE(&pi), 3));
    ASSERT_EQ(0, pi.is_allocated);

    lcb_packet_release_ringbuffer(&pi, &rb);
    ASSERT_EQ(0, rb.nbytes);
    ringbuffer_destruct(&rb);
}

static void rbSetWrap(ringbuffer_t *rb, size_t contig_size)
{
    EXPECT_EQ(0, rb->nbytes);
    EXPECT_TRUE(contig_size < rb->size);
    char *offset = rb->root + (rb->size - contig_size);
    rb->read_head = offset;
    rb->write_head = offset;
    EXPECT_EQ(0, ringbuffer_is_continous(rb, RINGBUFFER_WRITE, contig_size+1));
    EXPECT_NE(0, ringbuffer_is_continous(rb, RINGBUFFER_WRITE, contig_size));
}

TEST_F(Packet, testParsePartial)
{
    ringbuffer_t rb;
    memset(&rb, 0, sizeof(rb));
    ASSERT_NE(0, ringbuffer_initialize(&rb, 4096));

    std::string value;
    value.insert(0, 1024, '*');

    packet_info pi;
    int rv;

    rbSetWrap(&rb, 12);
    Pkt pkt;
    pkt.getq(value, 0);
    pkt.rbWrite(&rb);

    rv = lcb_packet_read_ringbuffer(&pi, &rb);
    ASSERT_EQ(1, rv);
    ASSERT_EQ(1028, PACKET_NBODY(&pi));
    ASSERT_EQ(1024, PACKET_NVALUE(&pi));
    ASSERT_EQ(0, pi.is_allocated);
    ASSERT_EQ(value.size(), PACKET_NVALUE(&pi));
    ASSERT_EQ(0, memcmp(value.c_str(), PACKET_VALUE(&pi), value.size()));
    lcb_packet_release_ringbuffer(&pi, &rb);
    ASSERT_EQ(0, rb.nbytes);
    ringbuffer_destruct(&rb);

    memset(&rb, 0, sizeof(rb));
    ASSERT_NE(0, ringbuffer_initialize(&rb, 4096));
    rbSetWrap(&rb, 100);
    pkt.rbWrite(&rb);
    rv = lcb_packet_read_ringbuffer(&pi, &rb);
    ASSERT_EQ(1, rv);
    ASSERT_EQ(1, pi.is_allocated);
    lcb_packet_release_ringbuffer(&pi, &rb);

    // Test where we're missing just one byte
    ringbuffer_reset(&rb);
    pkt.writeGenericHeader(10, &rb);
    rv = lcb_packet_read_ringbuffer(&pi, &rb);
    ASSERT_EQ(0, rv);
    for (int ii = 0; ii < 9; ii++) {
        char c = 'O';
        ringbuffer_write(&rb, &c, 1);
        rv = lcb_packet_read_ringbuffer(&pi, &rb);
        ASSERT_EQ(0, rv);
    }
    char tmp = 'O';
    ringbuffer_write(&rb, &tmp, 1);
    rv = lcb_packet_read_ringbuffer(&pi, &rb);
    ASSERT_EQ(1, rv);
    lcb_packet_release_ringbuffer(&pi, &rb);


    ringbuffer_destruct(&rb);
}


TEST_F(Packet, testKeys)
{
    ringbuffer_t rb;
    memset(&rb, 0, sizeof(rb));
    EXPECT_NE(0, ringbuffer_initialize(&rb, 10));

    std::string key = "a simple key";
    std::string value = "a simple value";
    Pkt pkt;
    pkt.get(key, value, 1000, PROTOCOL_BINARY_RESPONSE_ETMPFAIL, 0xdeadbeef, 50);
    pkt.rbWrite(&rb);

    packet_info pi;
    memset(&pi, 0, sizeof(pi));
    int rv = lcb_packet_read_ringbuffer(&pi, &rb);
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

    lcb_packet_release_ringbuffer(&pi, &rb);
    ringbuffer_destruct(&rb);

}
