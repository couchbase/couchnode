/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2012 - 2013 Couchbase, Inc.
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
#include <libcouchbase/debug.h>

std::ostream &operator <<(std::ostream &out, const lcb_http_type_t type)
{
    if (type == LCB_HTTP_TYPE_VIEW) {
        out << "view";
    } else if (type == LCB_HTTP_TYPE_MANAGEMENT) {
        out << "management";
    } else if (type == LCB_HTTP_TYPE_RAW) {
        out << "raw";
    } else {
        out << "invalid";
    }
    return out;
}

std::ostream &operator <<(std::ostream &out, const lcb_http_method_t method)
{
    if (method == LCB_HTTP_METHOD_GET) {
        out << "GET";
    } else if (method == LCB_HTTP_METHOD_POST) {
        out << "POST";
    } else if (method == LCB_HTTP_METHOD_PUT) {
        out << "PUT";
    } else if (method == LCB_HTTP_METHOD_DELETE) {
        out << "DELETE";
    } else {
        out << "invalid";
    }
    return out;
}

std::ostream &operator <<(std::ostream &out, const lcb_http_cmd_t &cmd)
{
    int v = cmd.version;
    out << "{" << std::endl
        << "   version: " << v << std::endl;

    if (v > 1) {
        out << "   unknown layout " << std::endl << "}";
        return out;
    }

    out << "   v.v" << v << ".path: [";
    out.write(cmd.v.v0.path, cmd.v.v0.npath);
    out << "]" << std::endl
        << "   v.v" << v << ".npath: " << cmd.v.v0.npath << std::endl
        << "   v.v" << v << ".body: [";
    out.write((const char *)cmd.v.v0.body, cmd.v.v0.nbody);
    out << "]" << std::endl
        << "   v.v" << v << ".nbody: " << cmd.v.v0.nbody << std::endl
        << "   v.v" << v << ".method: " << cmd.v.v0.method << std::endl
        << "   v.v" << v << ".chunked: " << cmd.v.v0.chunked << std::endl
        << "   v.v" << v << ".content_type: [" << cmd.v.v0.content_type << "]"
        << std::endl;

    if (v == 1) {
        out << "   v.v" << v << ".host: " << cmd.v.v1.host << std::endl
            << "   v.v" << v << ".username: " << cmd.v.v1.username << std::endl
            << "   v.v" << v << ".password: " << cmd.v.v1.password << std::endl;
    }

    out << "}";

    return out;
}

std::ostream &operator <<(std::ostream &out, const lcb_datatype_t op)
{
    if (op == 0) {
        out << "RAW";
    } else {
        out << "Illegal";
    }

    return out;
}

std::ostream &operator <<(std::ostream &out, const lcb_storage_t op)
{
    if (op == LCB_ADD) {
        out << "ADD";
    } else if (op == LCB_REPLACE) {
        out << "REPLACE";
    } else if (op == LCB_SET) {
        out << "SET";
    } else if (op == LCB_APPEND) {
        out << "APPEND";
    } else if (op == LCB_PREPEND) {
        out << "PREPEND";
    } else {
        out << "INVALID";
    }

    return out;
}

std::ostream &operator <<(std::ostream &out, const lcb_store_cmd_t &cmd)
{
    int v = cmd.version;
    out << "{" << std::endl
        << "   version: " << v << std::endl;

    if (v > 1) {
        out << "   unknown layout " << std::endl << "}";
        return out;
    }

    out << "   v.v" << v << ".key: [";
    out.write((const char *)cmd.v.v0.key, cmd.v.v0.nkey);
    out << "]" << std::endl
        << "   v.v" << v << ".nkey: " << cmd.v.v0.nkey << std::endl
        << "   v.v" << v << ".bytes: [";
    out.write((const char *)cmd.v.v0.bytes, cmd.v.v0.nbytes);
    out << "]" << std::endl
        << "   v.v" << v << ".nbytes: " << cmd.v.v0.nbytes << std::endl
        << "   v.v" << v << ".flags: " << cmd.v.v0.flags << std::endl
        << "   v.v" << v << ".cas: " << cmd.v.v0.cas << std::endl
        << "   v.v" << v << ".datatype: " << cmd.v.v0.datatype << std::endl
        << "   v.v" << v << ".exptime: " << cmd.v.v0.exptime << std::endl
        << "   v.v" << v << ".operation: " << cmd.v.v0.operation << std::endl
        << "   v.v" << v << ".nhashkey: " << cmd.v.v0.nhashkey << std::endl
        << "   v.v" << v << ".hashkey: [";
    out.write((const char *)cmd.v.v0.hashkey, cmd.v.v0.nhashkey);
    out << "]" << std::endl;
    out << "}";

    return out;
}

std::ostream &operator <<(std::ostream &out, const lcb_error_t err)
{
    out << lcb_strerror(NULL, err);
    return out;
}
