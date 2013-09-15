/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
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


#include "couchbase_impl.h"
namespace Couchnode
{

////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
/// Get                                                                      ///
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
void GetOptions::merge(const GetOptions &other)
{
    if (!lockTime.isFound()) {
        lockTime = other.lockTime;
    }

    if (!expTime.isFound()) {
        expTime = other.expTime;
    }

    if (!format.isFound()) {
        format = other.format;
    }
}
bool GetCommand::handleSingle(Command *p,
                              CommandKey &ki,
                              Handle<Value> params, unsigned int ix)
{
    GetCommand *ctx = static_cast<GetCommand *>(p);
    GetOptions kOptions;

    if (params.IsEmpty() == false && params->IsObject()) {
        if (!kOptions.parseObject(params.As<Object>(), ctx->err)) {
            return false;
        }
    }

    kOptions.merge(ctx->globalOptions);

    lcb_get_cmd_st *cmd = ctx->commands.getAt(ix);
    ki.setKeyV0(cmd);

    if (kOptions.lockTime.isFound()) {
        cmd->v.v0.exptime = kOptions.lockTime.v;
        cmd->v.v0.lock = 1;

    } else {
        cmd->v.v0.exptime = kOptions.lockTime.v;
    }

    if (kOptions.format.isFound()) {
        ValueFormat::Spec spec = ValueFormat::toSpec(kOptions.format.v, ctx->err);
        // ignore auto so the handler uses the incoming flags
        if (spec != ValueFormat::AUTO) {
            ctx->setCookieKeyOption(ki.getObject(), Number::New(spec));
        }
    }

    return true;
}

lcb_error_t GetCommand::execute(lcb_t instance)
{
    return lcb_get(instance, cookie, commands.size(), commands.getList());
}

bool GetOptions::parseObject(const Handle<Object> options, CBExc &ex)
{
    ParamSlot *specs[] = { &expTime, &lockTime, &format };
    return ParamSlot::parseAll(options, specs, 3, ex);
}


////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
/// Set                                                                      ///
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
bool StoreCommand::handleSingle(Command *p, CommandKey &ki,
                                Handle<Value> params, unsigned int ix)
{
    StoreCommand *ctx = static_cast<StoreCommand *>(p);
    lcb_store_cmd_t *cmd = ctx->commands.getAt(ix);
    StoreOptions kOptions;

    if (!params.IsEmpty()) {
        if (!kOptions.parseObject(params.As<Object>(), ctx->err)) {
            return false;
        }
        kOptions.isInitialized = true;

    } else {
        ctx->err.eArguments("Must have options for set", params);
        return false;
    }


    char *vbuf;
    size_t nvbuf;
    Handle<Value> s = kOptions.value.v;
    ki.setKeyV0(cmd);

    ValueFormat::Spec spec;
    Handle<Value> specObj;
    if (kOptions.format.isFound()) {
        specObj = kOptions.format.v;
    } else {
        specObj = ctx->globalOptions.format.v;
    }

    spec = ValueFormat::toSpec(specObj, ctx->err);
    if (spec == ValueFormat::INVALID) {
        return false;
    }

    if (!ValueFormat::encode(s, spec, ctx->bufs,
                             &cmd->v.v0.flags, &vbuf, &nvbuf, ctx->err)) {
        return false;
    }

    cmd->v.v0.bytes = vbuf;
    cmd->v.v0.nbytes = nvbuf;
    cmd->v.v0.cas = kOptions.cas.v;

    // exptime
    if (kOptions.exp.isFound()) {
        cmd->v.v0.exptime = kOptions.exp.v;
    } else {
        cmd->v.v0.exptime = ctx->globalOptions.exp.v;
    }

    // flags override
    if (kOptions.flags.isFound()) {
        cmd->v.v0.flags = kOptions.flags.v;
    }

    cmd->v.v0.operation = ctx->op;
    return true;
}

lcb_error_t StoreCommand::execute(lcb_t instance)
{
    return lcb_store(instance, cookie, commands.size(), commands.getList());
}

bool StoreOptions::parseObject(const Handle<Object> options, CBExc &ex)
{
    ParamSlot *spec[] = { &cas, &exp, &format, &value, &flags };
    if (!ParamSlot::parseAll(options, spec, 5, ex)) {
        return false;
    }

    return true;
}

////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
/// Arithmetic                                                               ///
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
bool ArithmeticOptions::parseObject(const Handle<Object> obj, CBExc &ex)
{
    ParamSlot *spec[] = { &this->exp, &initial, &delta };
    return ParamSlot::parseAll(obj, spec, 3, ex);
}

void ArithmeticOptions::merge(const ArithmeticOptions &other)
{
    if (!exp.isFound()) {
        exp = other.exp;
    }

    if (!initial.isFound()) {
        initial = other.initial;
    }

    if (!delta.isFound()) {
        delta = other.delta;
    }
}

bool ArithmeticCommand::handleSingle(Command *p, CommandKey &ki,
                                     Handle<Value> params, unsigned int ix)
{
    ArithmeticOptions kOptions;
    ArithmeticCommand *ctx = static_cast<ArithmeticCommand *>(p);
    lcb_arithmetic_cmd_t *cmd = ctx->commands.getAt(ix);


    if (!params.IsEmpty()) {
        if (!kOptions.parseObject(params.As<Object>(), ctx->err)) {
            return false;
        }
        kOptions.isInitialized = true;
    }


    kOptions.merge(ctx->globalOptions);
    ki.setKeyV0(cmd);
    cmd->v.v0.delta = kOptions.delta.v;
    cmd->v.v0.initial = kOptions.initial.v;
    if (kOptions.initial.isFound()) {
        cmd->v.v0.create = 1;
    }
    cmd->v.v0.exptime = kOptions.exp.v;

    return true;
}

lcb_error_t ArithmeticCommand::execute(lcb_t instance)
{
    return lcb_arithmetic(instance, cookie, commands.size(), commands.getList());
}

////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
/// Delete                                                                   ///
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
bool DeleteCommand::handleSingle(Command *p, CommandKey &ki,
                                 Handle<Value> params, unsigned int ix)
{
    DeleteOptions *effectiveOptions;
    DeleteCommand *ctx = static_cast<DeleteCommand*>(p);
    DeleteOptions kOptions;

    if (!params.IsEmpty()) {
        if (!kOptions.parseObject(params.As<Object>(), ctx->err)) {
            return false;
        }
        effectiveOptions = &kOptions;
    } else {
        effectiveOptions = &ctx->globalOptions;
    }

    lcb_remove_cmd_t *cmd = ctx->commands.getAt(ix);
    ki.setKeyV0(cmd);
    cmd->v.v0.cas = effectiveOptions->cas.v;
    return true;
}

lcb_error_t DeleteCommand::execute(lcb_t instance)
{
    return lcb_remove(instance, cookie, commands.size(), commands.getList());
}

////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
/// Unlock                                                                   ///
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
bool UnlockOptions::parseObject(const Handle<Object> obj, CBExc &ex)
{
    ParamSlot *spec = &cas;
    return ParamSlot::parseAll(obj, &spec, 1, ex);
}

bool UnlockCommand::handleSingle(Command *p, CommandKey& ki,
                                 Handle<Value> params, unsigned int ix)
{
    UnlockCommand *ctx = static_cast<UnlockCommand*>(p);
    UnlockOptions kOptions;
    if (params.IsEmpty()) {
        ctx->err.eArguments("Unlock must have CAS");
        return false;
    }

    if (!kOptions.parseObject(params.As<Object>(), ctx->err)) {
        return false;
    }

    if (!kOptions.cas.isFound()) {
        ctx->err.eArguments("Unlock must have CAS");
        return false;
    }

    lcb_unlock_cmd_t *cmd = ctx->commands.getAt(ix);
    ki.setKeyV0(cmd);
    cmd->v.v0.cas = kOptions.cas.v;
    return true;
}

lcb_error_t UnlockCommand::execute(lcb_t instance)
{
    return lcb_unlock(instance, cookie, commands.size(), commands.getList());
}

////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
/// Touch                                                                    ///
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
bool TouchOptions::parseObject(const Handle<Object> obj, CBExc &ex)
{
    ParamSlot *spec = &this->exp;
    return ParamSlot::parseAll(obj, &spec, 1, ex);
}

bool TouchCommand::handleSingle(Command *p, CommandKey &ki,
                                Handle<Value> params, unsigned int ix)
{
    TouchCommand *ctx = static_cast<TouchCommand *>(p);
    TouchOptions kOptions;
    if (!params.IsEmpty()) {
        if (!kOptions.parseObject(params.As<Object>(), ctx->err)) {
            return false;
        }
    } else {
        kOptions.exp = ctx->globalOptions.exp;
    }

    lcb_touch_cmd_t *cmd = ctx->commands.getAt(ix);
    ki.setKeyV0(cmd);
    cmd->v.v0.exptime = kOptions.exp.v;
    return true;
}

lcb_error_t TouchCommand::execute(lcb_t instance)
{
    return lcb_touch(instance, cookie, commands.size(), commands.getList());
}

////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
/// Observe                                                                  ///
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

// This is a very simple implementation as it takes no options
bool ObserveCommand::handleSingle(Command *p, CommandKey &ki,
                                  Handle<Value>, unsigned int ix)
{
    ObserveCommand *ctx = static_cast<ObserveCommand*>(p);
    lcb_observe_cmd_t *cmd = ctx->commands.getAt(ix);
    ki.setKeyV0(cmd);
    return true;
}

lcb_error_t ObserveCommand::execute(lcb_t instance)
{
    return lcb_observe(instance, cookie, commands.size(), commands.getList());
}

Cookie *ObserveCommand::createCookie()
{
    if (cookie) {
        return cookie;
    }

    cookie = new ObserveCookie(commands.size());
    initCookie();
    return cookie;
}

////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
/// Endure                                                                   ///
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
bool DurabilityOptions::parseObject(Handle<Object> params, CBExc &ex)
{
    ParamSlot *specs[] = {
            &persist_to, &replicate_to, &isDelete, &timeout
    };
    return ParamSlot::parseAll(params, specs, 4, ex);
}

bool EndureCommand::handleSingle(Command *p, CommandKey &ki,
                                 Handle<Value> params, unsigned int ix)
{
    EndureCommand *ctx = static_cast<EndureCommand *>(p);
    lcb_durability_cmd_t *cmd = ctx->commands.getAt(ix);
    ki.setKeyV0(cmd);

    if (!params.IsEmpty()) {

        CasSlot casSlot;
        ParamSlot *spec = &casSlot;
        if (!ParamSlot::parseAll(params.As<Object>(), &spec, 1, ctx->err)) {
            return false;
        }
        if (casSlot.isFound()) {
            cmd->v.v0.cas = casSlot.v;
        }
    }

    return true;
}

lcb_error_t EndureCommand::execute(lcb_t instance)
{
    // set our options
    lcb_durability_opts_t dopts;
    memset(&dopts, 0, sizeof(dopts));
    dopts.v.v0.check_delete = globalOptions.isDelete.v;
    dopts.v.v0.persist_to = globalOptions.persist_to.v;
    dopts.v.v0.replicate_to = globalOptions.replicate_to.v;
    if (globalOptions.persist_to.v < 1 || globalOptions.replicate_to.v < 1) {
        dopts.v.v0.cap_max = 1;
    }

    return lcb_durability_poll(instance, cookie, &dopts,
                               commands.size(), commands.getList());
}

////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
/// Stats                                                                    ///
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
bool StatsCommand::handleSingle(Command *p, CommandKey &ki,
                                Handle<Value>, unsigned int ix)
{
    StatsCommand *ctx = static_cast<StatsCommand *>(p);
    if (ix != 0) {
        ctx->err.eArguments("Too many keys in stats");
        return false;
    }

    lcb_server_stats_cmd_t *cmd = ctx->commands.getAt(ix);
    cmd->v.v0.name = ki.getKey();
    cmd->v.v0.nname = ki.getKeySize();
    return true;
}

Cookie* StatsCommand::createCookie()
{
    if (!cookie) {
        cookie = new StatsCookie();
        cookie->setCallback(callback.v, CBMODE_SPOOLED);
    }

    return cookie;
}

lcb_error_t StatsCommand::execute(lcb_t instance)
{
    return lcb_server_stats(instance,
                            cookie, commands.size(), commands.getList());
}

////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
/// HTTP                                                                     ///
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
bool HttpOptions::parseObject(const Handle<Object> obj, CBExc &ex)
{
    ParamSlot *spec[] = {
            &path, &content, &contentType, &httpMethod, &httpType
    };

    return ParamSlot::parseAll(obj, spec, 5, ex);
}

bool HttpCommand::handleSingle(Command *p, CommandKey &ki,
                               Handle<Value>, unsigned int ix)
{
    HttpCommand *ctx = static_cast<HttpCommand*>(p);
    if (ix != 0) {
        ctx->err.eArguments("Too many items in HTTP request");
        return false;
    }

    lcb_http_cmd_t *cmd = ctx->commands.getAt(ix);
    HttpOptions *options = &ctx->globalOptions;

    char *kMisc;
    size_t nMisc;

    if (!options->path.isFound()) {
        ctx->err.eArguments("Missing path");
        abort();
        return false;
    }

    if (!options->httpMethod.isFound()) {
        cmd->v.v0.method = LCB_HTTP_METHOD_GET;
    } else {
        if (options->httpMethod.v > LCB_HTTP_METHOD_MAX) {
            ctx->err.eArguments("Invalid HTTP method option");
            return false;
        }
        cmd->v.v0.method = (lcb_http_method_t)options->httpMethod.v;
    }

    if (!options->httpType.isFound()) {
        ctx->err.eArguments("Need HTTP type");
        return false;

    } else if (options->httpType.v > LCB_HTTP_TYPE_MAX) {
        ctx->err.eArguments("Invalid LCB HTTP type");
        return false;

    } else {
        ctx->htType = (lcb_http_type_t)options->httpType.v;
    }

    if (!options->path.isFound()) {
        ctx->err.eArguments("Must have path");
        return false;

    } else if (options->path.v.IsEmpty() ||
            options->path.v->BooleanValue() == false) {
        ctx->err.eArguments("Invalid path", options->path.v);
        return false;
    }

    if (!ctx->getBufBackedString(options->path.v, &kMisc, &nMisc)) {
        return false;
    }
    cmd->v.v0.path = kMisc;
    cmd->v.v0.npath = nMisc;

    if (options->contentType.isFound() &&
            options->contentType.v->BooleanValue()) {
        if (!ctx->getBufBackedString(options->contentType.v, &kMisc, &nMisc, true)) {
            return false;
        }
        cmd->v.v0.content_type = kMisc;
    }

    // Need to allocate memory for a bunch of stuff
    if (options->content.isFound() && options->content.v->BooleanValue()) {
        if (!ctx->getBufBackedString(options->content.v, &kMisc, &nMisc)) {
            return false;
        }
        cmd->v.v0.body = kMisc;
        cmd->v.v0.nbody = nMisc;
    }
    return true;
}

lcb_error_t HttpCommand::execute(lcb_t instance)
{
    lcb_http_request_t req;
    return lcb_make_http_request(instance, cookie,
                                 htType,
                                 commands.getAt(0),
                                 &req);
}

Cookie *HttpCommand::createCookie()
{
    if (cookie) {
        return cookie;
    }
    cookie = new HttpCookie();
    cookie->setCallback(callback.v, CBMODE_SINGLE);
    return cookie;
}

}
