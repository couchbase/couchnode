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

#include "opbuilder.h"

using namespace v8;

namespace Couchnode
{

void setHandleParentSpan(lcb_t inst, lcb_VIEWHANDLE &handle, TraceSpan span)
{
    lcb_view_set_parent_span(inst, handle, span.span());
}

void setHandleParentSpan(lcb_t inst, lcb_N1QLHANDLE &handle, TraceSpan span)
{
    lcb_n1ql_set_parent_span(inst, handle, span.span());
}

void setHandleParentSpan(lcb_t inst, lcb_FTSHANDLE &handle, TraceSpan span)
{
    lcb_fts_set_parent_span(inst, handle, span.span());
}

template <>
template <>
bool CmdBuilder<lcb_CMDVIEWQUERY>::parseStrOption<&lcb_CMDVIEWQUERY::ddoc>(
    Local<Value> value)
{
    return parseNstrOption<&lcb_CMDVIEWQUERY::ddoc, &lcb_CMDVIEWQUERY::nddoc>(
        value);
}

#define CMDBUILDER_NSTRVAR(_CLS, _PROP, _NPROP)                                \
    template <>                                                                \
    template <>                                                                \
    bool CmdBuilder<_CLS>::parseStrOption<&_CLS::_PROP>(Local<Value> value)    \
    {                                                                          \
        return parseNstrOption<&_CLS::_PROP, &_CLS::_NPROP>(value);            \
    }

#define CMDBUILDER_STRVAR(_CLS, _PROP)                                         \
    template <>                                                                \
    template <>                                                                \
    bool CmdBuilder<_CLS>::parseStrOption<&_CLS::_PROP>(Local<Value> value)    \
    {                                                                          \
        return parseCstrOption<&_CLS::_PROP>(value);                           \
    }

// CMDBUILDER_NSTRVAR(lcb_CMDVIEWQUERY, ddoc, nddoc)
CMDBUILDER_NSTRVAR(lcb_CMDVIEWQUERY, view, nview)
CMDBUILDER_NSTRVAR(lcb_CMDVIEWQUERY, optstr, noptstr)
CMDBUILDER_NSTRVAR(lcb_CMDVIEWQUERY, postdata, npostdata)
CMDBUILDER_STRVAR(lcb_CMDN1QL, host)
CMDBUILDER_NSTRVAR(lcb_CMDN1QL, query, nquery)
CMDBUILDER_NSTRVAR(lcb_CMDFTS, query, nquery)
CMDBUILDER_STRVAR(lcb_CMDHTTP, host)
CMDBUILDER_STRVAR(lcb_CMDHTTP, username)
CMDBUILDER_STRVAR(lcb_CMDHTTP, password)
CMDBUILDER_STRVAR(lcb_CMDHTTP, content_type)
CMDBUILDER_NSTRVAR(lcb_CMDHTTP, body, nbody)

#undef CMDBUILDER_NSTRVAR
#undef CMDBUILDER_STRVAR

} // namespace Couchnode
