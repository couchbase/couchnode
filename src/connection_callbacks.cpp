#include "connection.h"

#include "cas.h"
#include "error.h"
#include "mutationtoken.h"
#include "respreader.h"

namespace couchnode
{

void Connection::lcbGetRespHandler(lcb_INSTANCE *instance, int cbtype,
                                   const lcb_RESPGET *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPGET, &lcb_respget_cookie> rdr(instance, resp);

    lcb_STATUS rc = rdr.getValue<&lcb_respget_status>();

    Local<Value> errVal =
        rdr.decodeError<lcb_respget_error_context, lcb_respget_error_ref>(rc);
    Local<Value> casVal, bytesVal, flagsVal;
    if (rc == LCB_SUCCESS) {
        casVal = rdr.decodeCas<&lcb_respget_cas>();
        bytesVal = rdr.parseValue<&lcb_respget_value>();
        flagsVal = rdr.parseValue<&lcb_respget_flags>();
    } else {
        casVal = Nan::Null();
        bytesVal = Nan::Null();
        flagsVal = Nan::Null();
    }

    rdr.invokeCallback(errVal, casVal, bytesVal, flagsVal);
}

void Connection::lcbExistsRespHandler(lcb_INSTANCE *instance, int cbtype,
                                      const lcb_RESPEXISTS *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPEXISTS, &lcb_respexists_cookie> rdr(instance, resp);

    lcb_STATUS rc = rdr.getValue<&lcb_respexists_status>();

    Local<Value> errVal =
        rdr.decodeError<lcb_respexists_error_context, lcb_respexists_error_ref>(
            rc);

    Local<Value> casVal, existsVal;
    if (rc == LCB_SUCCESS) {
        casVal = rdr.decodeCas<&lcb_respexists_cas>();

        if (rdr.getValue<&lcb_respexists_is_found>() != 0) {
            existsVal = Nan::True();
        } else {
            existsVal = Nan::False();
        }
    } else {
        casVal = Nan::Null();
        existsVal = Nan::Null();
    }

    rdr.invokeCallback(errVal, casVal, existsVal);
}

void Connection::lcbGetReplicaRespHandler(lcb_INSTANCE *instance, int cbtype,
                                          const lcb_RESPGETREPLICA *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPGETREPLICA, &lcb_respgetreplica_cookie> rdr(instance,
                                                                   resp);

    lcb_STATUS rc = rdr.getValue<&lcb_respgetreplica_status>();

    Local<Value> errVal = rdr.decodeError<lcb_respgetreplica_error_context,
                                          lcb_respgetreplica_error_ref>(rc);

    uint32_t rflags = 0;
    if (rdr.getValue<&lcb_respreplica_is_final>()) {
        rflags |= LCB_RESP_F_FINAL;
    }

    Local<Value> casVal, bytesVal, flagsVal;
    if (rc == LCB_SUCCESS) {
        casVal = rdr.decodeCas<&lcb_respgetreplica_cas>();
        bytesVal = rdr.parseValue<&lcb_respgetreplica_value>();
        flagsVal = rdr.parseValue<&lcb_respgetreplica_flags>();
    } else {
        casVal = Nan::Null();
        bytesVal = Nan::Null();
        flagsVal = Nan::Null();
    }

    Local<Value> rflagsVal = Nan::New<Number>(rflags);

    if (!(rflags & LCB_RESP_F_FINAL)) {
        rdr.invokeNonFinalCallback(errVal, rflagsVal, casVal, bytesVal,
                                   flagsVal);
    } else {
        rdr.invokeCallback(errVal, rflagsVal, casVal, bytesVal, flagsVal);
    }
}

void Connection::lcbUnlockRespHandler(lcb_INSTANCE *instance, int cbtype,
                                      const lcb_RESPUNLOCK *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPUNLOCK, &lcb_respunlock_cookie> rdr(instance, resp);

    lcb_STATUS rc = rdr.getValue<&lcb_respunlock_status>();

    Local<Value> errVal =
        rdr.decodeError<lcb_respunlock_error_context, lcb_respunlock_error_ref>(
            rc);

    Local<Value> casVal;
    if (rc == LCB_SUCCESS) {
        casVal = rdr.decodeCas<&lcb_respunlock_cas>();
    } else {
        casVal = Nan::Null();
    }

    rdr.invokeCallback(errVal, casVal);
}

void Connection::lcbRemoveRespHandler(lcb_INSTANCE *instance, int cbtype,
                                      const lcb_RESPREMOVE *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPREMOVE, &lcb_respremove_cookie> rdr(instance, resp);

    lcb_STATUS rc = rdr.getValue<&lcb_respremove_status>();

    Local<Value> errVal =
        rdr.decodeError<lcb_respremove_error_context, lcb_respremove_error_ref>(
            rc);

    Local<Value> casVal;
    if (rc == LCB_SUCCESS) {
        casVal = rdr.decodeCas<&lcb_respremove_cas>();
    } else {
        casVal = Nan::Null();
    }

    rdr.invokeCallback(errVal, casVal);
}

void Connection::lcbTouchRespHandler(lcb_INSTANCE *instance, int cbtype,
                                     const lcb_RESPTOUCH *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPTOUCH, &lcb_resptouch_cookie> rdr(instance, resp);

    lcb_STATUS rc = rdr.getValue<&lcb_resptouch_status>();

    Local<Value> errVal =
        rdr.decodeError<lcb_resptouch_error_context, lcb_resptouch_error_ref>(
            rc);

    Local<Value> casVal;
    if (rc == LCB_SUCCESS) {
        casVal = rdr.decodeCas<&lcb_resptouch_cas>();
    } else {
        casVal = Nan::Null();
    }

    rdr.invokeCallback(errVal, casVal);
}

void Connection::lcbStoreRespHandler(lcb_INSTANCE *instance, int cbtype,
                                     const lcb_RESPSTORE *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPSTORE, &lcb_respstore_cookie> rdr(instance, resp);

    lcb_STATUS rc = rdr.getValue<&lcb_respstore_status>();

    Local<Value> errVal =
        rdr.decodeError<lcb_respstore_error_context, lcb_respstore_error_ref>(
            rc);

    Local<Value> casVal, tokenVal;
    if (rc == LCB_SUCCESS) {
        casVal = rdr.decodeCas<&lcb_respstore_cas>();
        tokenVal = rdr.decodeMutationToken<&lcb_respstore_mutation_token>();
    } else {
        casVal = Nan::Null();
        tokenVal = Nan::Null();
    }

    rdr.invokeCallback(errVal, tokenVal);
}

void Connection::lcbCounterRespHandler(lcb_INSTANCE *instance, int cbtype,
                                       const lcb_RESPCOUNTER *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPCOUNTER, &lcb_respcounter_cookie> rdr(instance, resp);

    lcb_STATUS rc = rdr.getValue<&lcb_respcounter_status>();

    Local<Value> errVal = rdr.decodeError<lcb_respcounter_error_context,
                                          lcb_respcounter_error_ref>(rc);

    Local<Value> casVal, tokenVal, valueVal;
    if (rc == LCB_SUCCESS) {
        casVal = rdr.decodeCas<&lcb_respcounter_cas>();
        tokenVal = rdr.decodeMutationToken<&lcb_respcounter_mutation_token>();
        valueVal = rdr.parseValue<&lcb_respcounter_value>();
    } else {
        casVal = Nan::Null();
        tokenVal = Nan::Null();
        valueVal = Nan::Null();
    }

    rdr.invokeCallback(errVal, casVal, tokenVal, valueVal);
}

void Connection::lcbLookupRespHandler(lcb_INSTANCE *instance, int cbtype,
                                      const lcb_RESPSUBDOC *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPSUBDOC, &lcb_respsubdoc_cookie> rdr(instance, resp);

    lcb_STATUS rc = rdr.getValue<&lcb_respsubdoc_status>();
    Local<Value> errVal =
        rdr.decodeError<lcb_respsubdoc_error_context, lcb_respsubdoc_error_ref>(
            rc);

    // Special handling for multi failures
    if (rc == LCB_SUBDOC_MULTI_FAILURE) {
        errVal = Nan::Null();
    }

    Local<Value> resVal;
    if (rc == LCB_SUCCESS || rc == LCB_SUBDOC_MULTI_FAILURE) {
        size_t numResults = rdr.getValue<&lcb_respsubdoc_result_size>();

        Local<Array> resArr = Nan::New<Array>(numResults);
        for (size_t i = 0; i < numResults; ++i) {
            Local<Object> resObj = Nan::New<Object>();

            lcb_STATUS itemstatus =
                rdr.getValue<&lcb_respsubdoc_result_status>(i);
            Nan::Set(resObj, Nan::New("error").ToLocalChecked(),
                        Error::create(itemstatus));

            if (itemstatus == LCB_SUCCESS) {
                Nan::Set(resObj, Nan::New("value").ToLocalChecked(),
                            rdr.parseValue<&lcb_respsubdoc_result_value>(i));
            } else {
                Nan::Set(resObj, Nan::New("value").ToLocalChecked(), Nan::Null());
            }

            Nan::Set(resArr, i, resObj);
        }

        Local<Object> resObj = Nan::New<Object>();
        Nan::Set(resObj, Nan::New("cas").ToLocalChecked(),
                    rdr.decodeCas<&lcb_respsubdoc_cas>());
        Nan::Set(resObj, Nan::New("results").ToLocalChecked(), resArr);
        resVal = resObj;
    } else {
        resVal = Nan::Null();
    }

    rdr.invokeCallback(errVal, resVal);
}

void Connection::lcbMutateRespHandler(lcb_INSTANCE *instance, int cbtype,
                                      const lcb_RESPSUBDOC *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPSUBDOC, &lcb_respsubdoc_cookie> rdr(instance, resp);

    lcb_STATUS rc = rdr.getValue<&lcb_respsubdoc_status>();
    Local<Value> errVal =
        rdr.decodeError<lcb_respsubdoc_error_context, lcb_respsubdoc_error_ref>(
            rc);

    size_t numResults = rdr.getValue<&lcb_respsubdoc_result_size>();
    for (size_t i = 0; i < numResults; ++i) {
        lcb_STATUS itemstatus = rdr.getValue<&lcb_respsubdoc_result_status>(i);
        if (itemstatus != LCB_SUCCESS) {
            errVal = Error::create(itemstatus);

            // Include the specific index that failed.
            Local<Object> errObj = errVal.As<Object>();
            Nan::Set(errObj, Nan::New("index").ToLocalChecked(),
                        Nan::New(static_cast<int>(i)));
        }
    }

    Local<Value> resVal;
    if (rc == LCB_SUCCESS) {
        Local<Object> resObj = Nan::New<Object>();

        Nan::Set(resObj, Nan::New("cas").ToLocalChecked(),
                    rdr.decodeCas<&lcb_respsubdoc_cas>());

        resVal = resObj;
    } else {
        resVal = Nan::Null();
    }

    rdr.invokeCallback(errVal, resVal);
}

void Connection::lcbViewDataHandler(lcb_INSTANCE *instance, int cbtype,
                                    const lcb_RESPVIEW *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPVIEW, &lcb_respview_cookie> rdr(instance, resp);

    lcb_STATUS rc = rdr.getValue<&lcb_respview_status>();

    Local<Value> errVal = Error::create(rc);
    Local<Value> dataRes = rdr.parseValue<&lcb_respview_row>();

    uint32_t rflags = 0;
    if (rdr.getValue<&lcb_respview_is_final>()) {
        rflags |= LCB_RESP_F_FINAL;
    }
    Local<Value> flagsVal = Nan::New<Number>(rflags);

    if (!(rflags & LCB_RESP_F_FINAL)) {
        rdr.invokeNonFinalCallback(errVal, flagsVal, dataRes);
    } else {
        rdr.invokeCallback(errVal, flagsVal, dataRes);
    }
}

void Connection::lcbN1qlDataHandler(lcb_INSTANCE *instance, int cbtype,
                                    const lcb_RESPN1QL *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPN1QL, &lcb_respn1ql_cookie> rdr(instance, resp);

    lcb_STATUS rc = rdr.getValue<&lcb_respn1ql_status>();

    Local<Value> errVal = Error::create(rc);
    Local<Value> dataRes = rdr.parseValue<&lcb_respn1ql_row>();

    uint32_t rflags = 0;
    if (rdr.getValue<&lcb_respn1ql_is_final>()) {
        rflags |= LCB_RESP_F_FINAL;
    }
    Local<Value> flagsVal = Nan::New<Number>(rflags);

    if (!(rflags & LCB_RESP_F_FINAL)) {
        rdr.invokeNonFinalCallback(errVal, flagsVal, dataRes);
    } else {
        rdr.invokeCallback(errVal, flagsVal, dataRes);
    }
}

void Connection::lcbCbasDataHandler(lcb_INSTANCE *instance, int cbtype,
                                    const lcb_RESPANALYTICS *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPANALYTICS, &lcb_respanalytics_cookie> rdr(instance,
                                                                 resp);

    lcb_STATUS rc = rdr.getValue<&lcb_respanalytics_status>();

    Local<Value> errVal = Error::create(rc);
    Local<Value> dataRes = rdr.parseValue<&lcb_respanalytics_row>();

    uint32_t rflags = 0;
    if (rdr.getValue<&lcb_respanalytics_is_final>()) {
        rflags |= LCB_RESP_F_FINAL;
    }
    Local<Value> flagsVal = Nan::New<Number>(rflags);

    if (!(rflags & LCB_RESP_F_FINAL)) {
        rdr.invokeNonFinalCallback(errVal, flagsVal, dataRes);
    } else {
        rdr.invokeCallback(errVal, flagsVal, dataRes);
    }
}

void Connection::lcbFtsDataHandler(lcb_INSTANCE *instance, int cbtype,
                                   const lcb_RESPFTS *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPFTS, &lcb_respfts_cookie> rdr(instance, resp);

    lcb_STATUS rc = rdr.getValue<&lcb_respfts_status>();

    Local<Value> errVal = Error::create(rc);
    Local<Value> dataRes = rdr.parseValue<&lcb_respfts_row>();

    uint32_t rflags = 0;
    if (rdr.getValue<&lcb_respfts_is_final>()) {
        rflags |= LCB_RESP_F_FINAL;
    }
    Local<Value> flagsVal = Nan::New<Number>(rflags);

    if (!(rflags & LCB_RESP_F_FINAL)) {
        rdr.invokeNonFinalCallback(errVal, flagsVal, dataRes);
    } else {
        rdr.invokeCallback(errVal, flagsVal, dataRes);
    }
}

void Connection::lcbHttpDataHandler(lcb_INSTANCE *instance, int cbtype,
                                    const lcb_RESPHTTP *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPHTTP, &lcb_resphttp_cookie> rdr(instance, resp);

    lcb_STATUS rc = rdr.getValue<&lcb_resphttp_status>();

    Local<Value> errVal = Error::create(rc);
    Local<Value> dataVal;

    uint32_t rflags = 0;
    if (rdr.getValue<&lcb_resphttp_is_final>()) {
        rflags |= LCB_RESP_F_FINAL;

        Local<Value> httpStatusRes =
            rdr.parseValue<&lcb_resphttp_http_status>();

        Local<Array> headersRes = Nan::New<Array>();
        const char *const *headers;
        lcb_resphttp_headers(resp, &headers);
        for (int headerIdx = 0; *headers; headerIdx++, headers++) {
            Local<String> headerVal =
                Nan::New<String>(*headers).ToLocalChecked();
            Nan::Set(headersRes, headerIdx, headerVal);
        }

        Local<Object> dataObj = Nan::New<Object>();
        Nan::Set(dataObj, Nan::New("statusCode").ToLocalChecked(), httpStatusRes);
        Nan::Set(dataObj, Nan::New("headers").ToLocalChecked(), headersRes);
        dataVal = dataObj;
    } else {
        dataVal = rdr.parseValue<&lcb_resphttp_body>();
    }

    Local<Value> flagsVal = Nan::New<Number>(rflags);

    if (!(rflags & LCB_RESP_F_FINAL)) {
        rdr.invokeNonFinalCallback(errVal, flagsVal, dataVal);
    } else {
        rdr.invokeCallback(errVal, flagsVal, dataVal);
    }
}

void Connection::lcbPingRespHandler(lcb_INSTANCE *instance, int cbtype,
                                    const lcb_RESPPING *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPPING, &lcb_respping_cookie> rdr(instance, resp);

    lcb_STATUS rc = rdr.getValue<&lcb_respping_status>();
    Local<Value> errVal = Error::create(rc);

    Local<Value> dataVal;
    if (rc == LCB_SUCCESS) {
        dataVal = rdr.parseValue<&lcb_respping_value>();
    } else {
        dataVal = Nan::Null();
    }

    rdr.invokeCallback(errVal, dataVal);
}

void Connection::lcbDiagRespHandler(lcb_INSTANCE *instance, int cbtype,
                                    const lcb_RESPDIAG *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPDIAG, &lcb_respdiag_cookie> rdr(instance, resp);

    lcb_STATUS rc = rdr.getValue<&lcb_respdiag_status>();
    Local<Value> errVal = Error::create(rc);

    Local<Value> dataVal;
    if (rc == LCB_SUCCESS) {
        dataVal = rdr.parseValue<&lcb_respdiag_value>();
    } else {
        dataVal = Nan::Null();
    }

    rdr.invokeCallback(errVal, dataVal);
}

} // namespace couchnode
