/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2011-2012 Couchbase, Inc.
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
 * This file contains the functions to operate on the packets
 *
 * @author Trond Norbye
 * @todo add more documentation
 */

#include "internal.h"

void lcb_server_buffer_start_packet(lcb_server_t *c,
                                    const void *command_cookie,
                                    ringbuffer_t *buff,
                                    ringbuffer_t *buff_cookie,
                                    const void *data,
                                    lcb_size_t size)
{
    struct lcb_command_data_st ct;
    memset(&ct, 0, sizeof(struct lcb_command_data_st));
    /* @todo we don't want to call gethrtime for each operation, */
    /* so I need to pass it down the chain so that a large */
    /* multiget can reuse the same timer... */
    ct.start = gethrtime();
    ct.cookie = command_cookie;

    lcb_assert(ringbuffer_ensure_capacity(buff, size) &&
               ringbuffer_ensure_capacity(&c->cmd_log, size) &&
               ringbuffer_ensure_capacity(buff_cookie, sizeof(ct)) &&
               ringbuffer_write(buff, data, size) == size &&
               ringbuffer_write(&c->cmd_log, data, size) == size &&
               ringbuffer_write(buff_cookie, &ct, sizeof(ct)) == sizeof(ct));
}

void lcb_server_buffer_retry_packet(lcb_server_t *c,
                                    struct lcb_command_data_st *ct,
                                    ringbuffer_t *buff,
                                    ringbuffer_t *buff_cookie,
                                    const void *data,
                                    lcb_size_t size)
{
    lcb_size_t ct_size = sizeof(struct lcb_command_data_st);

    lcb_assert(ringbuffer_ensure_capacity(buff, size) &&
               ringbuffer_ensure_capacity(&c->cmd_log, size) &&
               ringbuffer_ensure_capacity(buff_cookie, ct_size) &&
               ringbuffer_write(buff, data, size) == size &&
               ringbuffer_write(&c->cmd_log, data, size) == size &&
               ringbuffer_write(buff_cookie, ct, ct_size) == ct_size);
}

void lcb_server_buffer_write_packet(lcb_server_t *c,
                                    ringbuffer_t *buff,
                                    const void *data,
                                    lcb_size_t size)
{
    (void)c;
    lcb_assert(ringbuffer_ensure_capacity(buff, size) &&
               ringbuffer_ensure_capacity(&c->cmd_log, size) &&
               ringbuffer_write(buff, data, size) == size &&
               ringbuffer_write(&c->cmd_log, data, size) == size);
}

void lcb_server_buffer_end_packet(lcb_server_t *c,
                                  ringbuffer_t *buff)
{
    (void)c;
    (void)buff;
}

void lcb_server_buffer_complete_packet(lcb_server_t *c,
                                       const void *command_cookie,
                                       ringbuffer_t *buff,
                                       ringbuffer_t *buff_cookie,
                                       const void *data,
                                       lcb_size_t size)
{

    lcb_server_buffer_start_packet(c, command_cookie,
                                   buff, buff_cookie, data, size);
    lcb_server_buffer_end_packet(c, buff);
}

void lcb_server_retry_packet(lcb_server_t *c,
                             struct lcb_command_data_st *command_data,
                             const void *data,
                             lcb_size_t size)
{
    if (c->connection_ready) {
        if (!c->connection.output) {
            c->connection.output = calloc(1, sizeof(ringbuffer_t));
            ringbuffer_initialize(c->connection.output, 8092);
        }
        lcb_server_buffer_retry_packet(c, command_data,
                                       c->connection.output,
                                       &c->output_cookies,
                                       data, size);
    } else {
        lcb_server_buffer_retry_packet(c, command_data,
                                       &c->pending,
                                       &c->pending_cookies,
                                       data, size);
    }
}

void lcb_server_start_packet_ct(lcb_server_t *c,
                                struct lcb_command_data_st *command_data,
                                const void *data,
                                lcb_size_t size)
{
    lcb_server_retry_packet(c, command_data, data, size);
}


void lcb_server_start_packet(lcb_server_t *c,
                             const void *command_cookie,
                             const void *data,
                             lcb_size_t size)
{
    if (c->connection_ready) {
        if (!c->connection.output) {
            c->connection.output = calloc(1, sizeof(ringbuffer_t));
            ringbuffer_initialize(c->connection.output, 8092);
        }

        lcb_server_buffer_start_packet(c, command_cookie,
                                       c->connection.output,
                                       &c->output_cookies,
                                       data, size);
    } else {
        lcb_server_buffer_start_packet(c, command_cookie,
                                       &c->pending,
                                       &c->pending_cookies,
                                       data, size);
    }
}

void lcb_server_write_packet(lcb_server_t *c,
                             const void *data,
                             lcb_size_t size)
{
    if (c->connection_ready) {
        lcb_server_buffer_write_packet(c, c->connection.output, data, size);
    } else {
        lcb_server_buffer_write_packet(c, &c->pending, data, size);
    }
}

void lcb_server_end_packet(lcb_server_t *c)
{
    (void)c;
}

void lcb_server_complete_packet(lcb_server_t *c,
                                const void *command_cookie,
                                const void *data,
                                lcb_size_t size)
{
    if (c->connection_ready) {
        lcb_server_buffer_complete_packet(c, command_cookie,
                                          c->connection.output,
                                          &c->output_cookies,
                                          data, size);
    } else {
        lcb_server_buffer_complete_packet(c, command_cookie,
                                          &c->pending,
                                          &c->pending_cookies,
                                          data, size);
    }
}

void lcb_server_buffer_start_packet_ex(lcb_server_t *c,
                                       struct lcb_command_data_st *ct,
                                       ringbuffer_t *buff,
                                       ringbuffer_t *buff_cookie,
                                       const void *data,
                                       lcb_size_t size)
{
    lcb_assert(ringbuffer_ensure_capacity(buff, size) &&
               ringbuffer_ensure_capacity(&c->cmd_log, size) &&
               ringbuffer_ensure_capacity(buff_cookie, sizeof(*ct)) &&
               ringbuffer_write(buff, data, size) == size &&
               ringbuffer_write(&c->cmd_log, data, size) == size &&
               ringbuffer_write(buff_cookie, ct, sizeof(*ct)) == sizeof(*ct));
}

void lcb_server_start_packet_ex(lcb_server_t *c,
                                struct lcb_command_data_st *ct,
                                const void *data,
                                lcb_size_t size)
{
    if (c->connection_ready) {
        lcb_server_buffer_start_packet_ex(c, ct,
                                          c->connection.output,
                                          &c->output_cookies,
                                          data, size);
    } else {
        lcb_server_buffer_start_packet_ex(c, ct,
                                          &c->pending,
                                          &c->pending_cookies,
                                          data, size);
    }
}

