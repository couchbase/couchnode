#include "connection.h"

#include "error.h"
#include "opbuilder.h"

namespace couchnode
{

NAN_METHOD(Connection::fnGet)
{
    Connection *me = ObjectWrap::Unwrap<Connection>(info.This());
    Nan::HandleScope scope;
    OpBuilder<lcb_CMDGET> enc(me);

    enc.beginTrace("get");

    if (!enc.parseOption<&lcb_cmdget_collection>(info[0], info[1])) {
        return Nan::ThrowError(Error::create("bad scope/collection passed"));
    }
    if (!enc.parseOption<&lcb_cmdget_key>(info[2])) {
        return Nan::ThrowError(Error::create("bad key passed"));
    }
    if (!enc.parseTranscoder(info[3])) {
        return Nan::ThrowError(Error::create("bad transcoder passed"));
    }
    if (!enc.parseOption<&lcb_cmdget_expiry>(info[4])) {
        return Nan::ThrowError(Error::create("bad expiry passed"));
    }
    if (ValueParser::asUint(info[5]) > 0) {
        if (!enc.parseOption<&lcb_cmdget_locktime>(info[5])) {
            return Nan::ThrowError(Error::create("bad locked passed"));
        }
    }
    if (!enc.parseOption<&lcb_cmdget_timeout>(info[6])) {
        return Nan::ThrowError(Error::create("bad timeout passed"));
    }
    if (!enc.parseCallback(info[7])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_STATUS err = enc.execute<&lcb_get>();
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(Connection::fnExists)
{
    Connection *me = ObjectWrap::Unwrap<Connection>(info.This());
    Nan::HandleScope scope;
    OpBuilder<lcb_CMDEXISTS> enc(me);

    enc.beginTrace("exists");

    if (!enc.parseOption<&lcb_cmdexists_collection>(info[0], info[1])) {
        return Nan::ThrowError(Error::create("bad scope/collection passed"));
    }
    if (!enc.parseOption<&lcb_cmdexists_key>(info[2])) {
        return Nan::ThrowError(Error::create("bad key passed"));
    }
    if (!enc.parseOption<&lcb_cmdexists_timeout>(info[3])) {
        return Nan::ThrowError(Error::create("bad timeout passed"));
    }
    if (!enc.parseCallback(info[4])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_STATUS err = enc.execute<&lcb_exists>();
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(Connection::fnGetReplica)
{
    Connection *me = ObjectWrap::Unwrap<Connection>(info.This());
    Nan::HandleScope scope;

    lcb_REPLICA_MODE mode =
        static_cast<lcb_REPLICA_MODE>(ValueParser::asUint(info[4]));

    OpBuilder<lcb_CMDGETREPLICA> enc(me, mode);

    enc.beginTrace("getReplica");

    if (!enc.parseOption<&lcb_cmdgetreplica_collection>(info[0], info[1])) {
        return Nan::ThrowError(Error::create("bad scope/collection passed"));
    }
    if (!enc.parseOption<&lcb_cmdgetreplica_key>(info[2])) {
        return Nan::ThrowError(Error::create("bad key passed"));
    }
    if (!enc.parseTranscoder(info[3])) {
        return Nan::ThrowError(Error::create("bad transcoder passed"));
    }
    if (!enc.parseOption<&lcb_cmdgetreplica_timeout>(info[5])) {
        return Nan::ThrowError(Error::create("bad timeout passed"));
    }
    if (!enc.parseCallback(info[6])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_STATUS err = enc.execute<&lcb_getreplica>();
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(Connection::fnStore)
{
    Connection *me = ObjectWrap::Unwrap<Connection>(info.This());
    Nan::HandleScope scope;

    const char *opName = "store";
    lcb_STORE_OPERATION opType =
        static_cast<lcb_STORE_OPERATION>(ValueParser::asUint(info[11]));
    switch (opType) {
    case LCB_STORE_UPSERT:
        opName = "upsert";
        break;
    case LCB_STORE_INSERT:
        opName = "insert";
        break;
    case LCB_STORE_REPLACE:
        opName = "replace";
        break;
    case LCB_STORE_APPEND:
        opName = "append";
        break;
    case LCB_STORE_PREPEND:
        opName = "prepend";
        break;
    default:
        return Nan::ThrowError(Error::create("bad op type passed"));
    }

    OpBuilder<lcb_CMDSTORE> enc(me, opType);

    enc.beginTrace(opName);

    if (!enc.parseOption<&lcb_cmdstore_collection>(info[0], info[1])) {
        return Nan::ThrowError(Error::create("bad scope/collection passed"));
    }
    if (!enc.parseOption<&lcb_cmdstore_key>(info[2])) {
        return Nan::ThrowError(Error::create("bad key passed"));
    }
    if (!enc.parseTranscoder(info[3])) {
        return Nan::ThrowError(Error::create("bad transcoder passed"));
    }
    {
        Local<Value> errVal;
        bool parseRes;
        {
            Nan::TryCatch tryCatch;
            parseRes =
                enc.parseDocValue<&lcb_cmdstore_value, &lcb_cmdstore_flags>(
                    info[4]);
            if (tryCatch.HasCaught()) {
                errVal = tryCatch.Exception();
            }
        }
        if (!parseRes) {
            if (!errVal.IsEmpty()) {
                return Nan::ThrowError(errVal);
            }

            return Nan::ThrowError(Error::create("bad value passed"));
        }
    }
    if (!enc.parseOption<&lcb_cmdstore_expiry>(info[5])) {
        return Nan::ThrowError(Error::create("bad expiry passed"));
    }
    if (!enc.parseCasOption<&lcb_cmdstore_cas>(info[6])) {
        return Nan::ThrowError(Error::create("bad cas passed"));
    }
    lcb_DURABILITY_LEVEL durabilityLevel =
        static_cast<lcb_DURABILITY_LEVEL>(ValueParser::asUint(info[7]));
    int persistTo = ValueParser::asInt(info[8]);
    int replicateTo = ValueParser::asInt(info[9]);
    if (durabilityLevel != LCB_DURABILITYLEVEL_NONE) {
        lcb_cmdstore_durability(enc.cmd(), durabilityLevel);
    } else if (persistTo > 0 || replicateTo > 0) {
        lcb_cmdstore_durability_observe(enc.cmd(), persistTo, replicateTo);
    }
    if (!enc.parseOption<&lcb_cmdstore_timeout>(info[10])) {
        return Nan::ThrowError(Error::create("bad timeout passed"));
    }
    if (!enc.parseCallback(info[12])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    // In the case of APPEND/PREPEND, we need to clear the flags bits
    // to avoid any confusion about what is being set.
    switch (opType) {
    case LCB_STORE_APPEND:
    case LCB_STORE_PREPEND:
        lcb_cmdstore_flags(enc.cmd(), 0);
        break;
    default:
        break;
        // No need to do anything special for everyone else
    }

    lcb_STATUS err = enc.execute<&lcb_store>();
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(Connection::fnRemove)
{
    Connection *me = ObjectWrap::Unwrap<Connection>(info.This());
    Nan::HandleScope scope;
    OpBuilder<lcb_CMDREMOVE> enc(me);

    enc.beginTrace("remove");

    if (!enc.parseOption<&lcb_cmdremove_collection>(info[0], info[1])) {
        return Nan::ThrowError(Error::create("bad scope/collection passed"));
    }
    if (!enc.parseOption<&lcb_cmdremove_key>(info[2])) {
        return Nan::ThrowError(Error::create("bad key passed"));
    }
    if (!enc.parseCasOption<&lcb_cmdremove_cas>(info[3])) {
        return Nan::ThrowError(Error::create("bad cas passed"));
    }
    lcb_DURABILITY_LEVEL durabilityLevel =
        static_cast<lcb_DURABILITY_LEVEL>(ValueParser::asUint(info[4]));
    int persistTo = ValueParser::asInt(info[5]);
    int replicateTo = ValueParser::asInt(info[6]);
    if (durabilityLevel != LCB_DURABILITYLEVEL_NONE) {
        lcb_cmdremove_durability(enc.cmd(), durabilityLevel);
    } else if (persistTo > 0 || replicateTo > 0) {
        // TODO(brett19): BUG JSCBC-637 - Implement this when LCB adds support
        // lcb_cmdremove_durability_observe(enc.cmd(), persistTo, replicateTo);
        return Nan::ThrowError("unimplemented functionality");
    }
    if (!enc.parseOption<&lcb_cmdremove_timeout>(info[7])) {
        return Nan::ThrowError(Error::create("bad timeout passed"));
    }
    if (!enc.parseCallback(info[8])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_STATUS err = enc.execute<&lcb_remove>();
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(Connection::fnTouch)
{
    Connection *me = ObjectWrap::Unwrap<Connection>(info.This());
    Nan::HandleScope scope;
    OpBuilder<lcb_CMDTOUCH> enc(me);

    enc.beginTrace("touch");

    if (!enc.parseOption<&lcb_cmdtouch_collection>(info[0], info[1])) {
        return Nan::ThrowError(Error::create("bad scope/collection passed"));
    }
    if (!enc.parseOption<&lcb_cmdtouch_key>(info[2])) {
        return Nan::ThrowError(Error::create("bad key passed"));
    }
    if (!enc.parseOption<&lcb_cmdtouch_expiry>(info[3])) {
        return Nan::ThrowError(Error::create("bad expiry passed"));
    }
    lcb_DURABILITY_LEVEL durabilityLevel =
        static_cast<lcb_DURABILITY_LEVEL>(ValueParser::asUint(info[4]));
    int persistTo = ValueParser::asInt(info[5]);
    int replicateTo = ValueParser::asInt(info[6]);
    if (durabilityLevel != LCB_DURABILITYLEVEL_NONE) {
        lcb_cmdtouch_durability(enc.cmd(), durabilityLevel);
    } else if (persistTo > 0 || replicateTo > 0) {
        // TODO(brett19): BUG JSCBC-637 - Implement this when LCB adds support
        // lcb_cmdtouch_durability_observe(enc.cmd(), persistTo, replicateTo);
        return Nan::ThrowError("unimplemented functionality");
    }
    if (!enc.parseOption<&lcb_cmdtouch_timeout>(info[7])) {
        return Nan::ThrowError(Error::create("bad timeout passed"));
    }
    if (!enc.parseCallback(info[8])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_STATUS err = enc.execute<&lcb_touch>();
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(Connection::fnUnlock)
{
    Connection *me = ObjectWrap::Unwrap<Connection>(info.This());
    Nan::HandleScope scope;
    OpBuilder<lcb_CMDUNLOCK> enc(me);

    enc.beginTrace("unlock");

    if (!enc.parseOption<&lcb_cmdunlock_collection>(info[0], info[1])) {
        return Nan::ThrowError(Error::create("bad scope/collection passed"));
    }
    if (!enc.parseOption<&lcb_cmdunlock_key>(info[2])) {
        return Nan::ThrowError(Error::create("bad key passed"));
    }
    if (!enc.parseCasOption<&lcb_cmdunlock_cas>(info[3])) {
        return Nan::ThrowError(Error::create("bad cas passed"));
    }
    if (!enc.parseOption<&lcb_cmdunlock_timeout>(info[4])) {
        return Nan::ThrowError(Error::create("bad timeout passed"));
    }
    if (!enc.parseCallback(info[5])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_STATUS err = enc.execute<&lcb_unlock>();
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(Connection::fnCounter)
{
    Connection *me = ObjectWrap::Unwrap<Connection>(info.This());
    Nan::HandleScope scope;
    OpBuilder<lcb_CMDCOUNTER> enc(me);

    enc.beginTrace("counter");

    if (!enc.parseOption<&lcb_cmdcounter_collection>(info[0], info[1])) {
        return Nan::ThrowError(Error::create("bad scope/collection passed"));
    }
    if (!enc.parseOption<&lcb_cmdcounter_key>(info[2])) {
        return Nan::ThrowError(Error::create("bad key passed"));
    }
    if (!enc.parseOption<&lcb_cmdcounter_delta>(info[3])) {
        return Nan::ThrowError(Error::create("bad delta passed"));
    }
    if (!enc.parseOption<&lcb_cmdcounter_initial>(info[4])) {
        return Nan::ThrowError(Error::create("bad initial passed"));
    }
    if (!enc.parseOption<&lcb_cmdcounter_expiry>(info[5])) {
        return Nan::ThrowError(Error::create("bad expiry passed"));
    }
    lcb_DURABILITY_LEVEL durabilityLevel =
        static_cast<lcb_DURABILITY_LEVEL>(ValueParser::asUint(info[6]));
    int persistTo = ValueParser::asInt(info[7]);
    int replicateTo = ValueParser::asInt(info[8]);
    if (durabilityLevel != LCB_DURABILITYLEVEL_NONE) {
        lcb_cmdcounter_durability(enc.cmd(), durabilityLevel);
    } else if (persistTo > 0 || replicateTo > 0) {
        // TODO(brett19): BUG JSCBC-637 - Implement this when LCB adds support
        // lcb_cmdcounter_durability_observe(enc.cmd(), persistTo, replicateTo);
        return Nan::ThrowError("unimplemented functionality");
    }
    if (!enc.parseOption<&lcb_cmdcounter_timeout>(info[9])) {
        return Nan::ThrowError(Error::create("bad timeout passed"));
    }
    if (!enc.parseCallback(info[10])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_STATUS err = enc.execute<&lcb_counter>();
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(Connection::fnLookupIn)
{
    Connection *me = ObjectWrap::Unwrap<Connection>(info.This());
    Nan::HandleScope scope;
    OpBuilder<lcb_CMDSUBDOC> enc(me);

    enc.beginTrace("lookupIn");

    if (!enc.parseOption<&lcb_cmdsubdoc_collection>(info[0], info[1])) {
        return Nan::ThrowError(Error::create("bad scope/collection passed"));
    }
    if (!enc.parseOption<&lcb_cmdsubdoc_key>(info[2])) {
        return Nan::ThrowError(Error::create("bad key passed"));
    }
    uint32_t flags = ValueParser::asUint(info[3]);
    if (flags & LCBX_SDFLAG_ACCESS_DELETED) {
        lcb_cmdsubdoc_access_deleted(enc.cmd(), 1);
    }
    if (!enc.parseOption<&lcb_cmdsubdoc_timeout>(info[5])) {
        return Nan::ThrowError(Error::create("bad timeout passed"));
    }
    if (!enc.parseCallback(info[6])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    Local<Array> cmds = info[4].As<v8::Array>();

    size_t numCmds = cmds->Length() / 3;
    CmdBuilder<lcb_SUBDOCSPECS> cmdsEnc =
        enc.makeSubCmdBuilder<lcb_SUBDOCSPECS>(numCmds);

    for (size_t i = 0, idx = 0; i < numCmds; ++i, idx += 3) {
        Local<Value> arg0 = Nan::Get(cmds, idx + 0).ToLocalChecked();
        Local<Value> arg1 = Nan::Get(cmds, idx + 1).ToLocalChecked();
        Local<Value> arg2 = Nan::Get(cmds, idx + 2).ToLocalChecked();

        lcbx_SDCMD sdcmd = static_cast<lcbx_SDCMD>(ValueParser::asUint(arg0));

        switch (sdcmd) {
        case LCBX_SDCMD_GET:
            cmdsEnc.parseOption<&lcb_subdocspecs_get>(i, arg1, arg2);
            break;
        case LCBX_SDCMD_GET_COUNT:
            cmdsEnc.parseOption<&lcb_subdocspecs_get_count>(i, arg1, arg2);
            break;
        case LCBX_SDCMD_EXISTS:
            cmdsEnc.parseOption<&lcb_subdocspecs_exists>(i, arg1, arg2);
            break;
        default:
            return Nan::ThrowError(Error::create("unexpected optype"));
        }
    }

    lcb_cmdsubdoc_specs(enc.cmd(), cmdsEnc.cmd());

    lcb_STATUS err = enc.execute<&lcb_subdoc>();
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(Connection::fnMutateIn)
{
    Connection *me = ObjectWrap::Unwrap<Connection>(info.This());
    Nan::HandleScope scope;
    OpBuilder<lcb_CMDSUBDOC> enc(me);

    enc.beginTrace("mutateIn");

    if (!enc.parseOption<&lcb_cmdsubdoc_collection>(info[0], info[1])) {
        return Nan::ThrowError(Error::create("bad scope/collection passed"));
    }
    if (!enc.parseOption<&lcb_cmdsubdoc_key>(info[2])) {
        return Nan::ThrowError(Error::create("bad key passed"));
    }
    if (!enc.parseOption<&lcb_cmdsubdoc_expiry>(info[3])) {
        return Nan::ThrowError(Error::create("bad expiry passed"));
    }
    if (!enc.parseCasOption<&lcb_cmdsubdoc_cas>(info[4])) {
        return Nan::ThrowError(Error::create("bad cas passed"));
    }
    uint32_t flags = ValueParser::asUint(info[5]);
    if (flags & LCBX_SDFLAG_UPSERT_DOC) {
        lcb_cmdsubdoc_store_semantics(enc.cmd(), LCB_SUBDOC_STORE_UPSERT);
    }
    if (flags & LCBX_SDFLAG_INSERT_DOC) {
        lcb_cmdsubdoc_store_semantics(enc.cmd(), LCB_SUBDOC_STORE_INSERT);
    }
    if (flags & LCBX_SDFLAG_ACCESS_DELETED) {
        lcb_cmdsubdoc_access_deleted(enc.cmd(), 1);
    }
    lcb_DURABILITY_LEVEL durabilityLevel =
        static_cast<lcb_DURABILITY_LEVEL>(ValueParser::asUint(info[7]));
    int persistTo = ValueParser::asInt(info[8]);
    int replicateTo = ValueParser::asInt(info[9]);
    if (durabilityLevel != LCB_DURABILITYLEVEL_NONE) {
        lcb_cmdsubdoc_durability(enc.cmd(), durabilityLevel);
    } else if (persistTo > 0 || replicateTo > 0) {
        // TODO(brett19): BUG JSCBC-637 -  Implement this when LCB adds support
        // lcb_cmdsubdoc_durability_observe(enc.cmd(), persistTo, replicateTo);
        return Nan::ThrowError("unimplemented functionality");
    }
    if (!enc.parseOption<&lcb_cmdsubdoc_timeout>(info[10])) {
        return Nan::ThrowError(Error::create("bad timeout passed"));
    }
    if (!enc.parseCallback(info[11])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    Local<Array> cmds = info[6].As<v8::Array>();

    size_t numCmds = cmds->Length() / 4;
    CmdBuilder<lcb_SUBDOCSPECS> cmdsEnc =
        enc.makeSubCmdBuilder<lcb_SUBDOCSPECS>(numCmds);

    for (size_t i = 0, idx = 0; i < numCmds; ++i, idx += 4) {
        Local<Value> arg0 = Nan::Get(cmds, idx + 0).ToLocalChecked();
        Local<Value> arg1 = Nan::Get(cmds, idx + 1).ToLocalChecked();
        Local<Value> arg2 = Nan::Get(cmds, idx + 2).ToLocalChecked();
        Local<Value> arg3 = Nan::Get(cmds, idx + 3).ToLocalChecked();

        lcbx_SDCMD sdcmd = static_cast<lcbx_SDCMD>(ValueParser::asUint(arg0));

        switch (sdcmd) {
        case LCBX_SDCMD_REMOVE:
            cmdsEnc.parseOption<&lcb_subdocspecs_remove>(i, arg1, arg2);
            break;
        case LCBX_SDCMD_REPLACE:
            cmdsEnc.parseOption<&lcb_subdocspecs_replace>(i, arg1, arg2, arg3);
            break;
        case LCBX_SDCMD_DICT_ADD:
            cmdsEnc.parseOption<&lcb_subdocspecs_dict_add>(i, arg1, arg2, arg3);
            break;
        case LCBX_SDCMD_DICT_UPSERT:
            cmdsEnc.parseOption<&lcb_subdocspecs_dict_upsert>(i, arg1, arg2,
                                                              arg3);
            break;
        case LCBX_SDCMD_ARRAY_ADD_UNIQUE:
            cmdsEnc.parseOption<&lcb_subdocspecs_array_add_unique>(i, arg1,
                                                                   arg2, arg3);
            break;
        case LCBX_SDCMD_COUNTER:
            cmdsEnc.parseOption<&lcb_subdocspecs_counter>(i, arg1, arg2, arg3);
            break;
        case LCBX_SDCMD_ARRAY_INSERT:
            cmdsEnc.parseOption<&lcb_subdocspecs_array_insert>(i, arg1, arg2,
                                                               arg3);
            break;
        case LCBX_SDCMD_ARRAY_ADD_FIRST:
            cmdsEnc.parseOption<&lcb_subdocspecs_array_add_first>(i, arg1, arg2,
                                                                  arg3);
            break;
        case LCBX_SDCMD_ARRAY_ADD_LAST:
            cmdsEnc.parseOption<&lcb_subdocspecs_array_add_last>(i, arg1, arg2,
                                                                 arg3);
            break;
        default:
            return Nan::ThrowError(Error::create("unexpected optype"));
        }
    }

    lcb_cmdsubdoc_specs(enc.cmd(), cmdsEnc.cmd());

    lcb_STATUS err = enc.execute<&lcb_subdoc>();
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(Connection::fnViewQuery)
{
    Connection *me = ObjectWrap::Unwrap<Connection>(info.This());
    Nan::HandleScope scope;
    OpBuilder<lcb_CMDVIEW> enc(me);

    enc.beginTrace("query::view");

    lcb_cmdview_callback(enc.cmd(), &lcbViewDataHandler);

    if (!enc.parseOption<&lcb_cmdview_design_document>(info[0])) {
        return Nan::ThrowError(Error::create("bad ddoc name passed"));
    }
    if (!enc.parseOption<&lcb_cmdview_view_name>(info[1])) {
        return Nan::ThrowError(Error::create("bad view name passed"));
    }
    if (!enc.parseOption<&lcb_cmdview_option_string>(info[2])) {
        return Nan::ThrowError(Error::create("bad options string passed"));
    }
    if (!enc.parseOption<&lcb_cmdview_post_data>(info[3])) {
        return Nan::ThrowError(Error::create("bad post data passed"));
    }
    // uint32_t flags = ValueParser::asUint(info[4]);
    if (!enc.parseOption<&lcb_cmdview_timeout>(info[5])) {
        return Nan::ThrowError(Error::create("bad timeout passed"));
    }
    if (!enc.parseCallback(info[6])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_STATUS err = enc.execute<&lcb_view>();
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(Connection::fnQuery)
{
    Connection *me = ObjectWrap::Unwrap<Connection>(info.This());
    Nan::HandleScope scope;
    OpBuilder<lcb_CMDQUERY> enc(me);

    enc.beginTrace("query");

    lcb_cmdquery_callback(enc.cmd(), &lcbQueryDataHandler);

    if (!enc.parseOption<&lcb_cmdquery_payload>(info[0])) {
        return Nan::ThrowError(Error::create("bad query passed"));
    }
    uint32_t flags = ValueParser::asUint(info[1]);
    if (flags & LCBX_QUERYFLAG_PREPCACHE) {
        lcb_cmdquery_adhoc(enc.cmd(), 0);
    } else {
        lcb_cmdquery_adhoc(enc.cmd(), 1);
    }
    if (!enc.parseOption<&lcb_cmdquery_timeout>(info[2])) {
        return Nan::ThrowError(Error::create("bad timeout passed"));
    }
    if (!enc.parseCallback(info[3])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_STATUS err = enc.execute<&lcb_query>();
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(Connection::fnAnalyticsQuery)
{
    Connection *me = ObjectWrap::Unwrap<Connection>(info.This());
    Nan::HandleScope scope;
    OpBuilder<lcb_CMDANALYTICS> enc(me);

    enc.beginTrace("analyticsQuery");

    lcb_cmdanalytics_callback(enc.cmd(), &lcbAnalyticsDataHandler);

    if (!enc.parseOption<&lcb_cmdanalytics_payload>(info[0])) {
        return Nan::ThrowError(Error::create("bad query passed"));
    }
    uint32_t flags = ValueParser::asUint(info[1]);
    if (flags & LCBX_ANALYTICSFLAG_PRIORITY) {
        lcb_cmdanalytics_priority(enc.cmd(), 1);
    } else {
        lcb_cmdanalytics_priority(enc.cmd(), 0);
    }
    if (!enc.parseOption<&lcb_cmdanalytics_timeout>(info[2])) {
        return Nan::ThrowError(Error::create("bad timeout passed"));
    }
    if (!enc.parseCallback(info[3])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_STATUS err = enc.execute<&lcb_analytics>();
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(Connection::fnSearchQuery)
{
    Connection *me = ObjectWrap::Unwrap<Connection>(info.This());
    Nan::HandleScope scope;
    OpBuilder<lcb_CMDSEARCH> enc(me);

    enc.beginTrace("searchQuery");

    lcb_cmdsearch_callback(enc.cmd(), &lcbSearchDataHandler);

    if (!enc.parseOption<&lcb_cmdsearch_payload>(info[0])) {
        return Nan::ThrowError(Error::create("bad query passed"));
    }
    // uint32_t flags = ValueParser::asUint(info[1]);
    if (!enc.parseOption<&lcb_cmdsearch_timeout>(info[2])) {
        return Nan::ThrowError(Error::create("bad timeout passed"));
    }
    if (!enc.parseCallback(info[3])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_STATUS err = enc.execute<&lcb_search>();
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(Connection::fnHttpRequest)
{
    Connection *me = ObjectWrap::Unwrap<Connection>(info.This());
    Nan::HandleScope scope;

    lcb_HTTP_TYPE mode =
        static_cast<lcb_HTTP_TYPE>(ValueParser::asUint(info[0]));

    OpBuilder<lcb_CMDHTTP> enc(me, mode);

    enc.beginTrace("http");

    lcb_cmdhttp_streaming(enc.cmd(), 1);

    // lcb_cmdhttp_username;
    // lcb_cmdhttp_password;
    // lcb_cmdhttp_host;
    // lcb_cmdhttp_skip_auth_header;

    if (!enc.parseOption<&lcb_cmdhttp_method>(info[1])) {
        return Nan::ThrowError(Error::create("bad method passed"));
    }
    if (!enc.parseOption<&lcb_cmdhttp_path>(info[2])) {
        return Nan::ThrowError(Error::create("bad path passed"));
    }
    if (!enc.parseOption<&lcb_cmdhttp_content_type>(info[3])) {
        return Nan::ThrowError(Error::create("bad content type passed"));
    }
    if (!enc.parseOption<&lcb_cmdhttp_body>(info[4])) {
        return Nan::ThrowError(Error::create("bad body passed"));
    }
    if (!enc.parseOption<&lcb_cmdhttp_timeout>(info[5])) {
        return Nan::ThrowError(Error::create("bad timeout passed"));
    }
    if (!enc.parseCallback(info[6])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_STATUS err = enc.execute<&lcb_http>();
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(Connection::fnPing)
{
    Connection *me = ObjectWrap::Unwrap<Connection>(info.This());
    Nan::HandleScope scope;

    OpBuilder<lcb_CMDPING> enc(me);

    enc.beginTrace("ping");

    lcb_cmdping_encode_json(enc.cmd(), 1, 0, 1);

    if (!enc.parseOption<&lcb_cmdping_report_id>(info[0])) {
        return Nan::ThrowError(Error::create("bad report id passed"));
    }
    uint32_t flags = ValueParser::asUint(info[1]);
    if (flags == 0) {
        lcb_cmdping_all(enc.cmd());
    } else {
        if (flags & LCBX_SERVICETYPE_KEYVALUE) {
            lcb_cmdping_kv(enc.cmd(), 1);
        }
        if (flags & LCBX_SERVICETYPE_VIEWS) {
            lcb_cmdping_views(enc.cmd(), 1);
        }
        if (flags & LCBX_SERVICETYPE_QUERY) {
            lcb_cmdping_query(enc.cmd(), 1);
        }
        if (flags & LCBX_SERVICETYPE_SEARCH) {
            lcb_cmdping_search(enc.cmd(), 1);
        }
        if (flags & LCBX_SERVICETYPE_ANALYTICS) {
            lcb_cmdping_analytics(enc.cmd(), 1);
        }
    }
    if (!enc.parseOption<&lcb_cmdping_timeout>(info[2])) {
        return Nan::ThrowError(Error::create("bad timeout passed"));
    }
    if (!enc.parseCallback(info[3])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_STATUS err = enc.execute<&lcb_ping>();
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(Connection::fnDiag)
{
    Connection *me = ObjectWrap::Unwrap<Connection>(info.This());
    Nan::HandleScope scope;

    OpBuilder<lcb_CMDDIAG> enc(me);

    enc.beginTrace("diagnostics");

    if (!enc.parseOption<&lcb_cmddiag_report_id>(info[0])) {
        return Nan::ThrowError(Error::create("bad report id passed"));
    }
    if (!enc.parseCallback(info[1])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_STATUS err = enc.execute<&lcb_diag>();
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

} // namespace couchnode
