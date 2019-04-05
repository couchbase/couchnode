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
    if (!enc.parseOption<&lcb_cmdget_expiration>(info[3])) {
        return Nan::ThrowError(Error::create("bad expiry passed"));
    }
    if (ValueParser::asUint(info[4]) > 0) {
        if (!enc.parseOption<&lcb_cmdget_locktime>(info[4])) {
            return Nan::ThrowError(Error::create("bad locked passed"));
        }
    }
    if (!enc.parseOption<&lcb_cmdget_timeout>(info[5])) {
        return Nan::ThrowError(Error::create("bad timeout passed"));
    }
    if (!enc.parseCallback(info[6])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_STATUS err = enc.execute<&lcb_get>();
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
        static_cast<lcb_REPLICA_MODE>(ValueParser::asUint(info[3]));

    OpBuilder<lcb_CMDGETREPLICA> enc(me, mode);

    enc.beginTrace("getReplica");

    if (!enc.parseOption<&lcb_cmdgetreplica_collection>(info[0], info[1])) {
        return Nan::ThrowError(Error::create("bad scope/collection passed"));
    }
    if (!enc.parseOption<&lcb_cmdgetreplica_key>(info[2])) {
        return Nan::ThrowError(Error::create("bad key passed"));
    }
    if (!enc.parseOption<&lcb_cmdgetreplica_timeout>(info[4])) {
        return Nan::ThrowError(Error::create("bad timeout passed"));
    }
    if (!enc.parseCallback(info[5])) {
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
        static_cast<lcb_STORE_OPERATION>(ValueParser::asUint(info[10]));
    switch (opType) {
    case LCB_STORE_SET:
        opName = "upsert";
        break;
    case LCB_STORE_ADD:
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
    if (!enc.parseValue<&lcb_cmdstore_value, &lcb_cmdstore_flags,
                        &lcb_cmdstore_datatype>(info[3])) {
        return Nan::ThrowError(Error::create("bad doc passed"));
    }
    if (!enc.parseOption<&lcb_cmdstore_expiration>(info[4])) {
        return Nan::ThrowError(Error::create("bad expiry passed"));
    }
    if (!enc.parseOption<&lcb_cmdstore_cas>(info[5])) {
        return Nan::ThrowError(Error::create("bad cas passed"));
    }
    lcb_DURABILITY_LEVEL durabilityLevel =
        static_cast<lcb_DURABILITY_LEVEL>(ValueParser::asUint(info[6]));
    int persistTo = ValueParser::asInt(info[7]);
    int replicateTo = ValueParser::asInt(info[8]);
    if (durabilityLevel != LCB_DURABILITYLEVEL_NONE) {
        lcb_cmdstore_durability(enc.cmd(), durabilityLevel);
    } else if (persistTo > 0 || replicateTo > 0) {
        lcb_cmdstore_durability_observe(enc.cmd(), persistTo, replicateTo);
    }
    if (!enc.parseOption<&lcb_cmdstore_timeout>(info[9])) {
        return Nan::ThrowError(Error::create("bad timeout passed"));
    }
    if (!enc.parseCallback(info[11])) {
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
    if (!enc.parseOption<&lcb_cmdremove_cas>(info[3])) {
        return Nan::ThrowError(Error::create("bad cas passed"));
    }
    if (!enc.parseOption<&lcb_cmdremove_timeout>(info[4])) {
        return Nan::ThrowError(Error::create("bad timeout passed"));
    }
    if (!enc.parseCallback(info[5])) {
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
    if (!enc.parseOption<&lcb_cmdtouch_expiration>(info[3])) {
        return Nan::ThrowError(Error::create("bad expiry passed"));
    }
    if (!enc.parseOption<&lcb_cmdtouch_timeout>(info[4])) {
        return Nan::ThrowError(Error::create("bad timeout passed"));
    }
    if (!enc.parseCallback(info[5])) {
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
    if (!enc.parseOption<&lcb_cmdunlock_cas>(info[3])) {
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
    if (!enc.parseOption<&lcb_cmdcounter_expiration>(info[5])) {
        return Nan::ThrowError(Error::create("bad expiry passed"));
    }
    if (!enc.parseOption<&lcb_cmdcounter_timeout>(info[6])) {
        return Nan::ThrowError(Error::create("bad timeout passed"));
    }
    if (!enc.parseCallback(info[7])) {
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
    if (flags & LCBX_SDFLAG_UPSERT_DOC) {
        lcb_cmdsubdoc_create_if_missing(enc.cmd(), 1);
    }
    if (flags & LCBX_SDFLAG_INSERT_DOC) {
        // TODO: Implement lookupIn's INSERT_DOC flag
    }
    if (flags & LCBX_SDFLAG_ACCESS_DELETED) {
        // TODO: Implement lookupIn's ACCESS_DELETED flag
    }
    if (!enc.parseOption<&lcb_cmdsubdoc_timeout>(info[info.Length() - 2])) {
        return Nan::ThrowError(Error::create("bad timeout passed"));
    }
    if (!enc.parseCallback(info[info.Length() - 1])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    size_t numCmds = (info.Length() - 4 - 2) / 3;
    CmdBuilder<lcb_SUBDOCOPS> cmdsEnc =
        enc.makeSubCmdBuilder<lcb_SUBDOCOPS>(numCmds);

    for (size_t i = 0, arg = 4; i < numCmds; ++i, arg += 3) {
        lcbx_SDCMD sdcmd =
            static_cast<lcbx_SDCMD>(ValueParser::asUint(info[arg + 0]));

        switch (sdcmd) {
        case LCBX_SDCMD_GET:
            cmdsEnc.parseOption<&lcb_subdocops_get>(i, info[arg + 1],
                                                    info[arg + 2]);
            break;
        case LCBX_SDCMD_GET_COUNT:
            cmdsEnc.parseOption<&lcb_subdocops_get_count>(i, info[arg + 1],
                                                          info[arg + 2]);
            break;
        case LCBX_SDCMD_EXISTS:
            cmdsEnc.parseOption<&lcb_subdocops_exists>(i, info[arg + 1],
                                                       info[arg + 2]);
            break;
        default:
            return Nan::ThrowError(Error::create("unexpected optype"));
        }
    }

    lcb_cmdsubdoc_operations(enc.cmd(), cmdsEnc.cmd());

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
    if (!enc.parseOption<&lcb_cmdsubdoc_expiration>(info[3])) {
        return Nan::ThrowError(Error::create("bad expiry passed"));
    }
    if (!enc.parseOption<&lcb_cmdsubdoc_cas>(info[4])) {
        return Nan::ThrowError(Error::create("bad cas passed"));
    }
    uint32_t flags = ValueParser::asUint(info[5]);
    if (flags & LCBX_SDFLAG_UPSERT_DOC) {
        lcb_cmdsubdoc_create_if_missing(enc.cmd(), 1);
    }
    if (flags & LCBX_SDFLAG_INSERT_DOC) {
        // TODO: Implement lookupIn's INSERT_DOC flag
    }
    if (flags & LCBX_SDFLAG_ACCESS_DELETED) {
        // TODO: Implement lookupIn's ACCESS_DELETED flag
    }
    if (!enc.parseOption<&lcb_cmdsubdoc_timeout>(info[info.Length() - 2])) {
        return Nan::ThrowError(Error::create("bad timeout passed"));
    }
    if (!enc.parseCallback(info[info.Length() - 1])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    size_t numCmds = (info.Length() - 6 - 2) / 4;
    CmdBuilder<lcb_SUBDOCOPS> cmdsEnc =
        enc.makeSubCmdBuilder<lcb_SUBDOCOPS>(numCmds);

    for (size_t i = 0, arg = 6; i < numCmds; ++i, arg += 4) {
        lcbx_SDCMD sdcmd =
            static_cast<lcbx_SDCMD>(ValueParser::asUint(info[arg + 0]));

        switch (sdcmd) {
        case LCBX_SDCMD_REMOVE:
            cmdsEnc.parseOption<&lcb_subdocops_remove>(i, info[arg + 1],
                                                       info[arg + 2]);
            break;
        case LCBX_SDCMD_REPLACE:
            cmdsEnc.parseOption<&lcb_subdocops_replace>(
                i, info[arg + 1], info[arg + 2], info[arg + 3]);
            break;
        case LCBX_SDCMD_DICT_ADD:
            cmdsEnc.parseOption<&lcb_subdocops_dict_add>(
                i, info[arg + 1], info[arg + 2], info[arg + 3]);
            break;
        case LCBX_SDCMD_DICT_UPSERT:
            cmdsEnc.parseOption<&lcb_subdocops_dict_upsert>(
                i, info[arg + 1], info[arg + 2], info[arg + 3]);
            break;
        case LCBX_SDCMD_ARRAY_ADD_UNIQUE:
            cmdsEnc.parseOption<&lcb_subdocops_array_add_unique>(
                i, info[arg + 1], info[arg + 2], info[arg + 3]);
            break;
        case LCBX_SDCMD_COUNTER:
            cmdsEnc.parseOption<&lcb_subdocops_counter>(
                i, info[arg + 1], info[arg + 2], info[arg + 3]);
            break;
        case LCBX_SDCMD_ARRAY_INSERT:
            cmdsEnc.parseOption<&lcb_subdocops_array_insert>(
                i, info[arg + 1], info[arg + 2], info[arg + 3]);
            break;
        case LCBX_SDCMD_ARRAY_ADD_FIRST:
            cmdsEnc.parseOption<&lcb_subdocops_array_add_first>(
                i, info[arg + 1], info[arg + 2], info[arg + 3]);
            break;
        case LCBX_SDCMD_ARRAY_ADD_LAST:
            cmdsEnc.parseOption<&lcb_subdocops_array_add_last>(
                i, info[arg + 1], info[arg + 2], info[arg + 3]);
            break;
        default:
            return Nan::ThrowError(Error::create("unexpected optype"));
        }
    }

    lcb_cmdsubdoc_operations(enc.cmd(), cmdsEnc.cmd());

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

    if (!enc.parseOption<&lcb_cmdview_spatial>(info[0])) {
        return Nan::ThrowError(Error::create("bad spatial selector passed"));
    }
    if (!enc.parseOption<&lcb_cmdview_design_document>(info[1])) {
        return Nan::ThrowError(Error::create("bad ddoc name passed"));
    }
    if (!enc.parseOption<&lcb_cmdview_view_name>(info[2])) {
        return Nan::ThrowError(Error::create("bad view name passed"));
    }
    if (!enc.parseOption<&lcb_cmdview_option_string>(info[3])) {
        return Nan::ThrowError(Error::create("bad options string passed"));
    }
    if (!enc.parseOption<&lcb_cmdview_post_data>(info[4])) {
        return Nan::ThrowError(Error::create("bad post data passed"));
    }
    uint32_t flags = ValueParser::asUint(info[5]);
    if (flags & LCBX_VIEWFLAG_INCLUDEDOCS) {
        lcb_cmdview_include_docs(enc.cmd(), 1);
    } else {
        lcb_cmdview_include_docs(enc.cmd(), 0);
    }
    if (!enc.parseOption<&lcb_cmdview_timeout>(info[6])) {
        return Nan::ThrowError(Error::create("bad timeout passed"));
    }
    if (!enc.parseCallback(info[7])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_STATUS err = enc.execute<&lcb_view>();
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(Connection::fnN1qlQuery)
{
    Connection *me = ObjectWrap::Unwrap<Connection>(info.This());
    Nan::HandleScope scope;
    OpBuilder<lcb_CMDN1QL> enc(me);

    enc.beginTrace("query::n1ql");

    lcb_cmdn1ql_callback(enc.cmd(), &lcbN1qlDataHandler);

    if (!enc.parseOption<&lcb_cmdn1ql_query>(info[0])) {
        return Nan::ThrowError(Error::create("bad query passed"));
    }
    uint32_t flags = ValueParser::asUint(info[1]);
    if (flags & LCBX_N1QLFLAG_PREPCACHE) {
        lcb_cmdn1ql_adhoc(enc.cmd(), 0);
    } else {
        lcb_cmdn1ql_adhoc(enc.cmd(), 1);
    }
    if (!enc.parseOption<&lcb_cmdn1ql_timeout>(info[2])) {
        return Nan::ThrowError(Error::create("bad timeout passed"));
    }
    if (!enc.parseCallback(info[3])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_STATUS err = enc.execute<&lcb_n1ql>();
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(Connection::fnCbasQuery)
{
    Connection *me = ObjectWrap::Unwrap<Connection>(info.This());
    Nan::HandleScope scope;
    OpBuilder<lcb_CMDANALYTICS> enc(me);

    enc.beginTrace("query::analytics");

    lcb_cmdanalytics_callback(enc.cmd(), &lcbCbasDataHandler);

    if (!enc.parseOption<&lcb_cmdanalytics_query>(info[0])) {
        return Nan::ThrowError(Error::create("bad query passed"));
    }
    // uint32_t flags = ValueParser::asUint(info[1]);
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

NAN_METHOD(Connection::fnFtsQuery)
{
    Connection *me = ObjectWrap::Unwrap<Connection>(info.This());
    Nan::HandleScope scope;
    OpBuilder<lcb_CMDFTS> enc(me);

    enc.beginTrace("query::search");

    lcb_cmdfts_callback(enc.cmd(), &lcbFtsDataHandler);

    if (!enc.parseOption<&lcb_cmdfts_query>(info[0])) {
        return Nan::ThrowError(Error::create("bad query passed"));
    }
    // uint32_t flags = ValueParser::asUint(info[1]);
    if (!enc.parseOption<&lcb_cmdfts_timeout>(info[2])) {
        return Nan::ThrowError(Error::create("bad timeout passed"));
    }
    if (!enc.parseCallback(info[3])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_STATUS err = enc.execute<&lcb_fts>();
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

} // namespace couchnode
