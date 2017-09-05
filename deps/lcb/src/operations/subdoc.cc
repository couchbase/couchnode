/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2015 Couchbase, Inc.
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
#include "internal.h"
#include <vector>
#include <string>
#include <include/libcouchbase/subdoc.h>

static lcb_size_t
get_value_size(mc_PACKET *packet)
{
    if (packet->flags & MCREQ_F_HASVALUE) {
        if (packet->flags & MCREQ_F_VALUE_IOV) {
            return packet->u_value.multi.total_length;
        } else {
            return packet->u_value.single.size;
        }
    } else {
        return 0;
    }
}

namespace SubdocCmdTraits {
enum Options {
    EMPTY_PATH = 1<<0,
    ALLOW_EXPIRY = 1<<1,
    HAS_VALUE = 1<<2,
    ALLOW_MKDIRP = 1<<3,
    IS_LOOKUP = 1<<4,
    // Must encapsulate in 'multi' spec
    NO_STANDALONE = 1<<5
};

struct Traits {
    const unsigned allow_empty_path;
    const unsigned allow_expiry;
    const unsigned has_value;
    const unsigned allow_mkdir_p;
    const unsigned is_lookup;
    const uint8_t opcode;

    inline bool valid() const {
        return opcode != PROTOCOL_BINARY_CMD_INVALID;
    }

    inline unsigned mode() const {
        return is_lookup ? LCB_SDMULTI_MODE_LOOKUP : LCB_SDMULTI_MODE_MUTATE;
    }

    inline bool chk_allow_empty_path(uint32_t options) const {
        if (allow_empty_path) {
            return true;
        }
        if (!is_lookup) {
            return false;
        }

        return (options & LCB_SDSPEC_F_XATTRPATH) != 0;
    }

    inline Traits(uint8_t op, unsigned options) :
        allow_empty_path(options & EMPTY_PATH),
        allow_expiry(options & ALLOW_EXPIRY),
        has_value(options & HAS_VALUE),
        allow_mkdir_p(options & ALLOW_MKDIRP),
        is_lookup(options & IS_LOOKUP),
        opcode(op) {}
};

static const Traits
Get(PROTOCOL_BINARY_CMD_SUBDOC_GET, IS_LOOKUP);

static const Traits
Exists(PROTOCOL_BINARY_CMD_SUBDOC_EXISTS, IS_LOOKUP);

static const Traits
GetCount(PROTOCOL_BINARY_CMD_SUBDOC_GET_COUNT, IS_LOOKUP|EMPTY_PATH);

static const Traits
DictAdd(PROTOCOL_BINARY_CMD_SUBDOC_DICT_ADD, ALLOW_EXPIRY|HAS_VALUE);

static const Traits
DictUpsert(PROTOCOL_BINARY_CMD_SUBDOC_DICT_UPSERT,
    ALLOW_EXPIRY|HAS_VALUE|ALLOW_MKDIRP);

static const Traits
Remove(PROTOCOL_BINARY_CMD_SUBDOC_DELETE, ALLOW_EXPIRY);

static const Traits
ArrayInsert(PROTOCOL_BINARY_CMD_SUBDOC_ARRAY_INSERT,
    ALLOW_EXPIRY|HAS_VALUE);

static const Traits
Replace(PROTOCOL_BINARY_CMD_SUBDOC_REPLACE, ALLOW_EXPIRY|HAS_VALUE);

static const Traits
ArrayAddFirst(PROTOCOL_BINARY_CMD_SUBDOC_ARRAY_PUSH_FIRST,
    ALLOW_EXPIRY|HAS_VALUE|EMPTY_PATH|ALLOW_MKDIRP);

static const Traits
ArrayAddLast(PROTOCOL_BINARY_CMD_SUBDOC_ARRAY_PUSH_LAST,
    ALLOW_EXPIRY|HAS_VALUE|EMPTY_PATH|ALLOW_MKDIRP);

static const Traits
ArrayAddUnique(PROTOCOL_BINARY_CMD_SUBDOC_ARRAY_ADD_UNIQUE,
    ALLOW_EXPIRY|HAS_VALUE|EMPTY_PATH|ALLOW_MKDIRP);

static const Traits
Counter(PROTOCOL_BINARY_CMD_SUBDOC_COUNTER, ALLOW_EXPIRY|HAS_VALUE|ALLOW_MKDIRP);

static const Traits
GetDoc(PROTOCOL_BINARY_CMD_GET, IS_LOOKUP|EMPTY_PATH|NO_STANDALONE);

static const Traits
SetDoc(PROTOCOL_BINARY_CMD_SET, EMPTY_PATH|NO_STANDALONE);

static const Traits
DeleteDoc(PROTOCOL_BINARY_CMD_DELETE, EMPTY_PATH|NO_STANDALONE);

static const Traits
Invalid(PROTOCOL_BINARY_CMD_INVALID, 0);

const Traits&
find(unsigned mode)
{
    switch (mode) {
    case LCB_SDCMD_REPLACE:
        return Replace;
    case LCB_SDCMD_DICT_ADD:
        return DictAdd;
    case LCB_SDCMD_DICT_UPSERT:
        return DictUpsert;
    case LCB_SDCMD_ARRAY_ADD_FIRST:
        return ArrayAddFirst;
    case LCB_SDCMD_ARRAY_ADD_LAST:
        return ArrayAddLast;
    case LCB_SDCMD_ARRAY_ADD_UNIQUE:
        return ArrayAddUnique;
    case LCB_SDCMD_ARRAY_INSERT:
        return ArrayInsert;
    case LCB_SDCMD_GET:
        return Get;
    case LCB_SDCMD_EXISTS:
        return Exists;
    case LCB_SDCMD_GET_COUNT:
        return GetCount;
    case LCB_SDCMD_REMOVE:
        return Remove;
    case LCB_SDCMD_COUNTER:
        return Counter;
    case LCB_SDCMD_GET_FULLDOC:
        return GetDoc;
    case LCB_SDCMD_SET_FULLDOC:
        return SetDoc;
    case LCB_SDCMD_REMOVE_FULLDOC:
        return DeleteDoc;
    default:
        return Invalid;
    }
}
}

namespace SubdocPathFlags {
static const uint8_t MKDIR_P = 0x01;
static const uint8_t XATTR = 0x04;
static const uint8_t EXPAND_MACROS = 0x010;
}

namespace SubdocDocFlags {
static const uint8_t MKDOC = 0x01;
static const uint8_t ADDDOC = 0x02;
static const uint8_t ACCESS_DELETED = 0x04;
}

static size_t
get_valbuf_size(const lcb_VALBUF& vb)
{
    if (vb.vtype == LCB_KV_COPY || vb.vtype == LCB_KV_CONTIG) {
        return vb.u_buf.contig.nbytes;
    } else {
        if (vb.u_buf.multi.total_length) {
            return vb.u_buf.multi.total_length;
        } else {
            size_t tmp = 0;
            for (size_t ii = 0; ii < vb.u_buf.multi.niov; ++ii) {
                tmp += vb.u_buf.multi.iov[ii].iov_len;
            }
            return tmp;
        }
    }
}

static uint8_t
make_path_flags(const uint32_t user) {
    uint8_t flags = 0;
    if (user & LCB_SDSPEC_F_MKINTERMEDIATES) {
        flags |= SubdocPathFlags::MKDIR_P;
    }
    if (user & LCB_SDSPEC_F_XATTRPATH) {
        flags |= SubdocPathFlags::XATTR;
    }
    if (user & LCB_SDSPEC_F_XATTR_MACROVALUES) {
        flags |= SubdocPathFlags::XATTR | SubdocPathFlags::EXPAND_MACROS;
    }
    return flags;
}

static uint8_t
make_doc_flags(const uint32_t user) {
    uint8_t flags = 0;
    if (user & LCB_CMDSUBDOC_F_INSERT_DOC) {
        flags |= SubdocDocFlags::ADDDOC;
    }
    if (user & LCB_CMDSUBDOC_F_UPSERT_DOC) {
        flags |= SubdocDocFlags::MKDOC;
    }
    if (user & LCB_CMDSUBDOC_F_ACCESS_DELETED) {
        flags |= SubdocDocFlags::ACCESS_DELETED;
    }
    return flags;
}

struct MultiBuilder {
    static unsigned infer_mode(const lcb_CMDSUBDOC *cmd) {
        if (cmd->nspecs == 0) {
            return 0;
        }
        const SubdocCmdTraits::Traits& trait = SubdocCmdTraits::find(cmd->specs[0].sdcmd);
        if (!trait.valid()) {
            return 0;
        }
        return trait.mode();
    }

    MultiBuilder(const lcb_CMDSUBDOC *cmd_)
    : cmd(cmd_), payload_size(0) {
        mode = infer_mode(cmd_);
        size_t ebufsz = is_lookup() ? cmd->nspecs * 4 : cmd->nspecs * 8;
        extra_body = new char[ebufsz];
        bodysz = 0;
    }

    ~MultiBuilder() {
        if (extra_body != NULL) {
            delete[] extra_body;
        }
    }

    inline MultiBuilder(const MultiBuilder&);

    // IOVs which are fed into lcb_VALBUF for subsequent use
    const lcb_CMDSUBDOC *cmd;
    std::vector<lcb_IOV> iovs;
    char *extra_body;
    size_t bodysz;

    // Total size of the payload itself
    size_t payload_size;

    unsigned mode;

    bool is_lookup() const {
        return mode == LCB_SDMULTI_MODE_LOOKUP;
    }

    bool is_mutate() const {
        return mode == LCB_SDMULTI_MODE_MUTATE;
    }

    void maybe_setmode(const SubdocCmdTraits::Traits& t) {
        if (mode == 0) {
            mode = t.mode();
        }
    }

    template <typename T> void add_field(T itm, size_t len) {
        const char *b = reinterpret_cast<const char *>(&itm);
        memcpy(extra_body + bodysz, b, len);
        bodysz += len;
    }

    const char *extra_mark() const {
        return extra_body + bodysz;
    }

    void add_extras_iov(const char *last_begin) {
        const char *p_end = extra_mark();
        add_iov(last_begin, p_end - last_begin);
    }

    void add_iov(const void *b, size_t n) {
        if (!n) {
            return;
        }

        lcb_IOV iov;
        iov.iov_base = const_cast<void*>(b);
        iov.iov_len = n;
        iovs.push_back(iov);
        payload_size += n;
    }

    void add_iov(const lcb_VALBUF& vb) {
        if (vb.vtype == LCB_KV_CONTIG || vb.vtype == LCB_KV_COPY) {
            add_iov(vb.u_buf.contig.bytes, vb.u_buf.contig.nbytes);
        } else {
            for (size_t ii = 0; ii < vb.u_buf.contig.nbytes; ++ii) {
                const lcb_IOV& iov = vb.u_buf.multi.iov[ii];
                if (!iov.iov_len) {
                    continue; // Skip it
                }
                payload_size += iov.iov_len;
                iovs.push_back(iov);
            }
        }
    }

    inline lcb_error_t add_spec(const lcb_SDSPEC *);
};

lcb_error_t
MultiBuilder::add_spec(const lcb_SDSPEC *spec)
{
    const SubdocCmdTraits::Traits& trait = SubdocCmdTraits::find(spec->sdcmd);
    if (!trait.valid()) {
        return LCB_UNKNOWN_SDCMD;
    }
    maybe_setmode(trait);

    if (trait.mode() != mode) {
        return LCB_OPTIONS_CONFLICT;
    }

    const char *p_begin = extra_mark();
    // opcode
    add_field(trait.opcode, 1);
    // flags
    add_field(make_path_flags(spec->options), 1);

    uint16_t npath = static_cast<uint16_t>(spec->path.contig.nbytes);
    if (!npath && !trait.chk_allow_empty_path(spec->options)) {
        return LCB_EMPTY_PATH;
    }

    // Path length
    add_field(static_cast<uint16_t>(htons(npath)), 2);

    uint32_t vsize = 0;
    if (is_mutate()) {
        // Mutation needs an additional 'value' spec.
        vsize = get_valbuf_size(spec->value);
        add_field(static_cast<uint32_t>(htonl(vsize)), 4);
    }

    // Finalize the header..
    add_extras_iov(p_begin);

    // Add the actual path
    add_iov(spec->path.contig.bytes, spec->path.contig.nbytes);
    if (vsize) {
        add_iov(spec->value);
    }
    return LCB_SUCCESS;
}


static lcb_error_t
sd3_single(lcb_t instance, const void *cookie, const lcb_CMDSUBDOC *cmd)
{
    // Find the trait
    const lcb_SDSPEC *spec = cmd->specs;
    const SubdocCmdTraits::Traits& traits = SubdocCmdTraits::find(spec->sdcmd);
    lcb_error_t rc;

    // Any error here is implicitly related to the only spec
    if (cmd->error_index) {
        *cmd->error_index = 0;
    }

    if (!traits.valid()) {
        return LCB_UNKNOWN_SDCMD;
    }

    // Determine if the trait matches the mode. Technically we don't care
    // about this (since it's always a single command) but we do want the
    // API to remain consistent.
    if (cmd->multimode != 0 && cmd->multimode != traits.mode()) {
        return LCB_OPTIONS_CONFLICT;
    }

    if (LCB_KEYBUF_IS_EMPTY(&cmd->key)) {
        return LCB_EMPTY_KEY;
    }
    if (LCB_KEYBUF_IS_EMPTY(&spec->path) &&
            !traits.chk_allow_empty_path(spec->options)) {
        return LCB_EMPTY_PATH;
    }

    lcb_VALBUF valbuf;
    const lcb_VALBUF *valbuf_p = &valbuf;
    lcb_IOV tmpiov[2];
    lcb_FRAGBUF *fbuf = &valbuf.u_buf.multi;

    valbuf.vtype = LCB_KV_IOVCOPY;
    fbuf->iov = tmpiov;
    fbuf->niov = 1;
    fbuf->total_length = 0;
    tmpiov[0].iov_base = const_cast<void*>(spec->path.contig.bytes);
    tmpiov[0].iov_len = spec->path.contig.nbytes;

    if (traits.has_value) {
        if (spec->value.vtype == LCB_KV_COPY) {
            fbuf->niov = 2;
            /* Subdoc value is the second IOV */
            tmpiov[1].iov_base = (void *)spec->value.u_buf.contig.bytes;
            tmpiov[1].iov_len = spec->value.u_buf.contig.nbytes;
        } else {
            /* Assume properly formatted packet */
            valbuf_p = &spec->value;
        }
    }

    uint8_t extlen = 3;
    uint32_t exptime = 0;
    if (cmd->exptime) {
        if (!traits.allow_expiry) {
            return LCB_OPTIONS_CONFLICT;
        }
        exptime = cmd->exptime;
        extlen = 7;
    }

    uint8_t docflags = make_doc_flags(cmd->cmdflags);
    if (docflags) {
        extlen++;
    }

    protocol_binary_request_header hdr = {{0}};
    mc_PACKET *packet;
    mc_PIPELINE *pipeline;

    rc = mcreq_basic_packet(&instance->cmdq,
        (const lcb_CMDBASE*)cmd,
        &hdr, extlen, &packet, &pipeline, MCREQ_BASICPACKET_F_FALLBACKOK);

    if (rc != LCB_SUCCESS) {
        return rc;
    }

    rc = mcreq_reserve_value(pipeline, packet, valbuf_p);
    if (rc != LCB_SUCCESS) {
        mcreq_wipe_packet(pipeline, packet);
        mcreq_release_packet(pipeline, packet);
        return rc;
    }

    MCREQ_PKT_RDATA(packet)->cookie = cookie;
    MCREQ_PKT_RDATA(packet)->start = gethrtime();

    hdr.request.magic = PROTOCOL_BINARY_REQ;
    hdr.request.datatype = PROTOCOL_BINARY_RAW_BYTES;
    hdr.request.extlen = packet->extlen;
    hdr.request.opaque = packet->opaque;
    hdr.request.opcode = traits.opcode;
    hdr.request.cas = lcb_htonll(cmd->cas);
    hdr.request.bodylen = htonl(hdr.request.extlen +
        ntohs(hdr.request.keylen) + get_value_size(packet));

    memcpy(SPAN_BUFFER(&packet->kh_span), hdr.bytes, sizeof hdr.bytes);

    char *extras = SPAN_BUFFER(&packet->kh_span) + MCREQ_PKT_BASESIZE;
    // Path length:
    uint16_t enc_pathlen = htons(spec->path.contig.nbytes);
    memcpy(extras, &enc_pathlen, 2);
    extras += 2;

    uint8_t path_flags = make_path_flags(spec->options);
    memcpy(extras, &path_flags, 1);
    extras += 1;

    if (exptime) {
        uint32_t enc_exptime = htonl(exptime);
        memcpy(extras, &enc_exptime, 4);
        extras += 4;
    }

    if (docflags) {
        memcpy(extras, &docflags, 1);
        extras += 1;
    }

    LCB_SCHED_ADD(instance, pipeline, packet);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API
lcb_error_t
lcb_subdoc3(lcb_t instance, const void *cookie, const lcb_CMDSUBDOC *cmd)
{
    // First validate the command
    if (cmd->nspecs == 0) {
        return LCB_ENO_COMMANDS;
    }

    if (cmd->nspecs == 1) {
        switch (cmd->specs[0].sdcmd) {
        case LCB_SDCMD_GET_FULLDOC:
        case LCB_SDCMD_SET_FULLDOC:
        case LCB_SDCMD_REMOVE_FULLDOC:
            break;
        default:
            return sd3_single(instance, cookie, cmd);
        }
    }

    uint32_t expiry = cmd->exptime;
    uint8_t docflags = make_doc_flags(cmd->cmdflags);
    lcb_error_t rc = LCB_SUCCESS;

    MultiBuilder ctx(cmd);
    if (cmd->error_index) {
        *cmd->error_index = -1;
    }

    if (expiry && !ctx.is_mutate()) {
        return LCB_OPTIONS_CONFLICT;
    }

    for (size_t ii = 0; ii < cmd->nspecs; ++ii) {
        if (cmd->error_index) {
            *cmd->error_index = ii;
        }
        rc = ctx.add_spec(cmd->specs + ii);
        if (rc != LCB_SUCCESS) {
            return rc;
        }
    }

    mc_PIPELINE *pl;
    mc_PACKET *pkt;
    uint8_t extlen = 0;
    if (expiry) {
        extlen += 4;
    }
    if (docflags) {
        extlen ++;
    }

    protocol_binary_request_header hdr;

    if (cmd->error_index) {
        *cmd->error_index = -1;
    }

    rc = mcreq_basic_packet(
        &instance->cmdq, reinterpret_cast<const lcb_CMDBASE*>(cmd),
        &hdr, extlen, &pkt, &pl, MCREQ_BASICPACKET_F_FALLBACKOK);

    if (rc != LCB_SUCCESS) {
        return rc;
    }

    lcb_VALBUF vb = { LCB_KV_IOVCOPY };
    vb.u_buf.multi.iov = &ctx.iovs[0];
    vb.u_buf.multi.niov = ctx.iovs.size();
    vb.u_buf.multi.total_length = ctx.payload_size;
    rc = mcreq_reserve_value(pl, pkt, &vb);

    if (rc != LCB_SUCCESS) {
        mcreq_wipe_packet(pl, pkt);
        mcreq_release_packet(pl, pkt);
        return rc;
    }

    // Set the header fields.
    hdr.request.magic = PROTOCOL_BINARY_REQ;
    if (ctx.is_lookup()) {
        hdr.request.opcode = PROTOCOL_BINARY_CMD_SUBDOC_MULTI_LOOKUP;
    } else {
        hdr.request.opcode = PROTOCOL_BINARY_CMD_SUBDOC_MULTI_MUTATION;
    }
    hdr.request.datatype = PROTOCOL_BINARY_RAW_BYTES;
    hdr.request.extlen = pkt->extlen;
    hdr.request.opaque = pkt->opaque;
    hdr.request.cas = lcb_htonll(cmd->cas);
    hdr.request.bodylen = htonl(hdr.request.extlen +
        ntohs(hdr.request.keylen) + ctx.payload_size);
    memcpy(SPAN_BUFFER(&pkt->kh_span), hdr.bytes, sizeof hdr.bytes);
    if (expiry) {
        expiry = htonl(expiry);
        memcpy(SPAN_BUFFER(&pkt->kh_span) + 24, &expiry, 4);
    }
    if (docflags) {
        memcpy(SPAN_BUFFER(&pkt->kh_span) + 24 + (extlen -1), &docflags, 1);
    }

    MCREQ_PKT_RDATA(pkt)->cookie = cookie;
    MCREQ_PKT_RDATA(pkt)->start = gethrtime();
    LCB_SCHED_ADD(instance, pl, pkt);
    return LCB_SUCCESS;
}
