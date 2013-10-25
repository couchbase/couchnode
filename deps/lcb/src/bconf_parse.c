/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2013 Couchbase, Inc.
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
 * This file contains parsing routines for the vbucket stream
 * @author Mark Nunberg
 */

#include "internal.h"


/** Don't create any buffers less than 2k */
const lcb_size_t min_buffer_size = 2048;


/**
 * Grow a buffer so that it got at least a minimum size of available space.
 * I'm <b>always</b> allocating one extra byte to add a '\0' so that if you
 * use one of the str* functions you won't run into random memory.
 *
 * @param buffer the buffer to grow
 * @param min_free the minimum amount of free space I need
 * @return 1 if success, 0 otherwise
 */
static int grow_buffer(buffer_t *buffer, lcb_size_t min_free)
{
    if (min_free == 0) {
        /*
        ** no minimum size requested, just ensure that there is at least
        ** one byte there...
        */
        min_free = 1;
    }

    if (buffer->size - buffer->avail < min_free) {
        lcb_size_t next = buffer->size ? buffer->size << 1 : min_buffer_size;
        char *ptr;

        while ((next - buffer->avail) < min_free) {
            next <<= 1;
        }

        ptr = realloc(buffer->data, next + 1);
        if (ptr == NULL) {
            return 0;
        }
        ptr[next] = '\0';
        buffer->data = ptr;
        buffer->size = next;
    }

    return 1;
}


/**
 * Try to parse the piece of data we've got available to see if we got all
 * the data for this "chunk"
 * @param instance the instance containing the data
 * @return 1 if we got all the data we need, 0 otherwise
 */
static lcb_error_t parse_chunk(struct vbucket_stream_st *vbs)
{
    buffer_t *buffer = &vbs->chunk;
    lcb_assert(vbs->chunk_size != 0);

    if (vbs->chunk_size == (lcb_size_t) - 1) {
        char *ptr = strstr(buffer->data, "\r\n");
        long val;
        if (ptr == NULL) {
            /* We need more data! */
            return LCB_BUSY;
        }
        ptr += 2;
        val = strtol(buffer->data, NULL, 16);
        val += 2;
        vbs->chunk_size = (lcb_size_t)val;
        buffer->avail -= (lcb_size_t)(ptr - buffer->data);
        memmove(buffer->data, ptr, buffer->avail);
        buffer->data[buffer->avail] = '\0';
    }

    if (buffer->avail < vbs->chunk_size) {
        /* need more data! */
        return LCB_BUSY;
    }

    return LCB_SUCCESS;
}

/**
 * Try to parse the headers in the input chunk.
 *
 * @param instance the instance containing the data
 * @return 0 success, 1 we need more data, -1 incorrect response
 */
static lcb_error_t parse_header(struct vbucket_stream_st *vbs, lcb_type_t btype)
{
    int response_code;

    buffer_t *buffer = &vbs->chunk;
    char *ptr = strstr(buffer->data, "\r\n\r\n");

    if (ptr != NULL) {
        *ptr = '\0';
        ptr += 4;
    } else if ((ptr = strstr(buffer->data, "\n\n")) != NULL) {
        *ptr = '\0';
        ptr += 2;
    } else {
        /* We need more data! */
        return LCB_BUSY;
    }

    /* parse the headers I care about... */
    if (sscanf(buffer->data, "HTTP/1.1 %d", &response_code) != 1) {
        return LCB_PROTOCOL_ERROR;

    } else if (response_code != 200) {
        switch (response_code) {
        case 401:
            return LCB_AUTH_ERROR;
        case 404:
            return LCB_BUCKET_ENOENT;
        default:
            return LCB_PROTOCOL_ERROR;
            break;
        }
    }

    /** TODO: Isn't a vBucket config only for BUCKET types? */
    if (btype == LCB_TYPE_BUCKET &&
            strstr(buffer->data, "Transfer-Encoding: chunked") == NULL &&
            strstr(buffer->data, "Transfer-encoding: chunked") == NULL) {
        return LCB_PROTOCOL_ERROR;
    }

    vbs->header = strdup(buffer->data);
    /* realign remaining data.. */
    buffer->avail -= (lcb_size_t)(ptr - buffer->data);
    memmove(buffer->data, ptr, buffer->avail);
    buffer->data[buffer->avail] = '\0';
    vbs->chunk_size = (lcb_size_t) - 1;

    return LCB_SUCCESS;
}

static lcb_error_t parse_body(lcb_t instance,
                              struct vbucket_stream_st *vbs,
                              int *done)
{
    lcb_error_t err = LCB_BUSY;
    char *term;
    buffer_t *buffer = &vbs->chunk;

    if ((err = parse_chunk(vbs)) != LCB_SUCCESS) {
        *done = 1; /* no data */
        lcb_assert(err == LCB_BUSY);
        return err;
    }

    if (!grow_buffer(&vbs->input, vbs->chunk_size)) {
        return LCB_ENOMEM;
    }

    memcpy(vbs->input.data + vbs->input.avail, buffer->data, vbs->chunk_size);

    vbs->input.avail += vbs->chunk_size;
    /* the chunk includes the \r\n at the end.. We shouldn't add
    ** that..
    */
    vbs->input.avail -= 2;
    vbs->input.data[vbs->input.avail] = '\0';

    /* realign buffer */
    memmove(buffer->data, buffer->data + vbs->chunk_size,
            buffer->avail - vbs->chunk_size);

    buffer->avail -= vbs->chunk_size;
    buffer->data[buffer->avail] = '\0';
    term = strstr(vbs->input.data, "\n\n\n\n");

    if (term != NULL) {
        *term = '\0';
        vbs->input.avail -= 4;
        lcb_update_vbconfig(instance, NULL);
        err = LCB_SUCCESS;
    }

    vbs->chunk_size = (lcb_size_t) - 1;
    if (buffer->avail > 0) {
        *done = 0;
        /**
         * If we receive at least one configuration here, we
         * return LCB_SUCCESS to let the outer loop propagate it to the
         * I/O code; in which case the connection timer (if any) is cancelled.
         */
    }
    return err;
}

lcb_error_t lcb_parse_vbucket_stream(lcb_t instance)
{
    struct vbucket_stream_st *vbs = &instance->vbucket_stream;
    buffer_t *buffer = &vbs->chunk;
    lcb_size_t nw, expected;
    lcb_error_t status = LCB_ERROR;
    lcb_connection_t conn = &instance->connection;

    if (!grow_buffer(buffer, conn->input->nbytes + 1)) {
        return LCB_ENOMEM;
    }

    /**
     * Read any data from the ringbuffer into our 'buffer_t' structure.
     * TODO: Refactor this code to use ringbuffer directly, so we don't need
     * to copy
     */
    expected = conn->input->nbytes;
    lcb_assert(buffer->data);

    /**
     * XXX: The semantics of the buffer fields are confusing. Normally,
     * 'avail' is the length of the allocated buffer and 'size' is the length
     * of the used contents within that buffer. Here however it appears to be
     * that 'size' is the allocated length, and 'avail' is the length of the
     * contents within the buffer
     */
    nw = ringbuffer_read(conn->input,
                         buffer->data + buffer->avail,
                         buffer->size - buffer->avail);

    lcb_assert(nw == expected);
    buffer->avail += nw;
    buffer->data[buffer->avail] = '\0';

    if (vbs->header == NULL) {
        status = parse_header(&instance->vbucket_stream, instance->type);
        if (status != LCB_SUCCESS) {
            return status; /* BUSY or otherwise */
        }
    }

    lcb_assert(vbs->header);
    if (instance->type == LCB_TYPE_CLUSTER) {
        /* Do not parse payload for cluster connection type */
        return LCB_SUCCESS;
    }

    /**
     * Note that we're doing a streaming push-based config; we
     */
    {
        int done = 0;
        do {
            status = parse_body(instance, vbs, &done);
        } while (!done);
    }

    return status;
}
