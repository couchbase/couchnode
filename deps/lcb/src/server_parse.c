/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2010-2013 Couchbase, Inc.
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

/**
 * This file contains the protocol handling and callback dispatching for
 * commands.
 *
 * @author Trond Norbye
 * @todo add more documentation
 */
#include "internal.h"
#include "packetutils.h"
#include "bucketconfig/clconfig.h"

#define LOGARGS(c, lvl) \
    &(c)->instance->settings, "pktparse", LCB_LOG_##lvl, __FILE__, __LINE__

#define LOG(c, lvl, msg) lcb_log(LOGARGS(c, lvl), msg)

static void swallow_command(lcb_server_t *c,
                            const protocol_binary_response_header *header,
                            int was_connected)
{
    lcb_size_t nr;
    protocol_binary_request_header req;
    if (was_connected &&
            (header->response.opcode != PROTOCOL_BINARY_CMD_STAT ||
             header->response.keylen == 0)) {
        nr = ringbuffer_read(&c->cmd_log, req.bytes, sizeof(req));
        lcb_assert(nr == sizeof(req));
        ringbuffer_consumed(&c->cmd_log, ntohl(req.request.bodylen));
        ringbuffer_consumed(&c->output_cookies,
                            sizeof(struct lcb_command_data_st));
    }
}

/**
 * Returns 1 if retried, 0 if the command should fail, -1 for an internal
 * error
 */
static int handle_not_my_vbucket(lcb_server_t *c,
                                 packet_info *resinfo,
                                 protocol_binary_request_header *oldreq,
                                 struct lcb_command_data_st *oldct)
{
    int idx;
    char *body;
    lcb_size_t nbody, nr;
    lcb_server_t *new_srv;
    struct lcb_command_data_st ct;
    protocol_binary_request_header req;
    hrtime_t now;
    lcb_string config_string;
    lcb_error_t err = LCB_ERROR;
    clconfig_provider *cccp;

    lcb_log(LOGARGS(c, WARN),
            "NOT_MY_VBUCKET; Server=%p,ix=%d,real_start=%lu,vb=%d",
            (void *)c, c->index,
            (unsigned long)oldct->real_start,
            (int)ntohs(oldreq->request.vbucket));

    cccp = lcb_confmon_get_provider(c->instance->confmon, LCB_CLCONFIG_CCCP);
    lcb_string_init(&config_string);
    if (PACKET_NBODY(resinfo) && cccp->enabled) {
        lcb_string_append(&config_string,
                          PACKET_VALUE(resinfo),
                          PACKET_NVALUE(resinfo));

        err = lcb_cccp_update(cccp, c->curhost.host, &config_string);
    }

    lcb_string_release(&config_string);

    if (err != LCB_SUCCESS) {
        lcb_bootstrap_refresh(c->instance);
    }

    /* re-schedule command to new server */
    if (!c->instance->settings.vb_noguess) {
        idx = vbucket_found_incorrect_master(c->instance->vbucket_config,
                                             ntohs(oldreq->request.vbucket),
                                             (int)c->index);
    } else {
        idx = c->index;
    }

    if (idx == -1) {
        lcb_log(LOGARGS(c, ERR), "no alternate server");
        return 0;
    }
    lcb_log(LOGARGS(c, INFO), "Mapped key to new server %d -> %d",
            c->index, idx);

    now = gethrtime();

    if (oldct->real_start) {
        hrtime_t min_ok = now - MCSERVER_TIMEOUT(c) * 1000;
        if (oldct->real_start < min_ok) {
            /** Timed out in a 'natural' manner */
            return 0;
        }
    }

    req = *oldreq;

    lcb_assert((lcb_size_t)idx < c->instance->nservers);
    new_srv = c->instance->servers + idx;

    nr = ringbuffer_read(&c->cmd_log, req.bytes, sizeof(req));
    lcb_assert(nr == sizeof(req));

    req.request.opaque = ++c->instance->seqno;
    nbody = ntohl(req.request.bodylen);
    body = malloc(nbody);
    if (body == NULL) {
        lcb_error_handler(c->instance, LCB_CLIENT_ENOMEM, NULL);
        return -1;
    }
    nr = ringbuffer_read(&c->cmd_log, body, nbody);
    lcb_assert(nr == nbody);
    nr = ringbuffer_read(&c->output_cookies, &ct, sizeof(ct));
    lcb_assert(nr == sizeof(ct));

    /* Preserve the cookie and reset timestamp for the command. This
     * means that the library will retry the command until it will
     * get code different from LCB_NOT_MY_VBUCKET */
    if (!ct.real_start) {
        ct.real_start = ct.start;
    }
    ct.start = now;

    lcb_server_retry_packet(new_srv, &ct, &req, sizeof(req));
    /* FIXME dtrace instrumentation */
    lcb_server_write_packet(new_srv, body, nbody);
    lcb_server_end_packet(new_srv);
    lcb_server_send_packets(new_srv);
    free(body);

    return 1;
}

int lcb_proto_parse_single(lcb_server_t *c, hrtime_t stop)
{
    int rv;
    packet_info info;
    protocol_binary_request_header req;
    lcb_size_t nr;
    lcb_connection_t conn = &c->connection;

    rv = lcb_packet_read_ringbuffer(&info, conn->input);
    if (rv == -1) {
        return -1;
    } else if (rv == 0) {
        return 0;
    }

    /* Is it already timed out? */
    nr = ringbuffer_peek(&c->cmd_log, req.bytes, sizeof(req));
    if (nr < sizeof(req) || /* the command log doesn't know about it */
            (PACKET_OPAQUE(&info) < req.request.opaque &&
             PACKET_OPAQUE(&info) > 0)) { /* sasl comes with zero opaque */
        /* already processed. */
        lcb_packet_release_ringbuffer(&info, conn->input);
        return 1;
    }


    nr = ringbuffer_peek(&c->output_cookies, &info.ct, sizeof(info.ct));
    if (nr != sizeof(info.ct)) {
        lcb_error_handler(c->instance, LCB_EINTERNAL, NULL);
        lcb_packet_release_ringbuffer(&info, conn->input);
        return -1;
    }
    info.ct.vbucket = ntohs(req.request.vbucket);

    switch (info.res.response.magic) {
    case PROTOCOL_BINARY_REQ:
        /*
         * The only way to get request packets is if someone started
         * to send us TAP requests, and we don't support that anymore
         */
        lcb_error_handler(c->instance, LCB_EINTERNAL,
                          "Protocol error. someone sent us a command!");
        return -1;
    case PROTOCOL_BINARY_RES: {
        int was_connected = c->connection_ready;
        rv = lcb_server_purge_implicit_responses(c,
                                                 PACKET_OPAQUE(&info),
                                                 stop, 0);
        if (rv != 0) {
            lcb_packet_release_ringbuffer(&info, conn->input);
            return -1;
        }

        if (c->instance->histogram) {
            lcb_record_metrics(c->instance, stop - info.ct.start,
                               PACKET_OPCODE(&info));
        }

        if (PACKET_STATUS(&info) != PROTOCOL_BINARY_RESPONSE_NOT_MY_VBUCKET
                || PACKET_OPCODE(&info) == CMD_GET_REPLICA
                || PACKET_OPCODE(&info) == CMD_OBSERVE) {
            rv = lcb_dispatch_response(c, &info);
            if (rv == -1) {
                lcb_error_handler(c->instance, LCB_EINTERNAL,
                                  "Received unknown command response");
                abort();
                return -1;
            }

            /* keep command and cookie until we get complete STAT response */
            swallow_command(c, &info.res, was_connected);

        } else {
            rv = handle_not_my_vbucket(c, &info, &req, &info.ct);

            if (rv == -1) {
                return -1;

            } else if (rv == 0) {
                lcb_dispatch_response(c, &info);
                swallow_command(c, &info.res, was_connected);
            }

        }
        break;
    }

    default:
        lcb_error_handler(c->instance, LCB_PROTOCOL_ERROR, NULL);
        lcb_packet_release_ringbuffer(&info, conn->input);
        return -1;
    }

    lcb_packet_release_ringbuffer(&info, conn->input);
    return 1;
}
