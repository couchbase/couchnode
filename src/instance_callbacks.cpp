#include "connection.h"

#include "cas.h"
#include "error.h"
#include "mutationtoken.h"
#include "respreader.h"

namespace couchnode
{

void Instance::lcbGetRespHandler(lcb_INSTANCE *instance, int cbtype,
                                 const lcb_RESPGET *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPGET, &lcb_respget_cookie> rdr(instance, resp);

    lcb_STATUS rc = rdr.getValue<&lcb_respget_status>();
    Local<Value> errVal = rdr.decodeError<lcb_respget_error_context>(rc);

    Local<Value> casVal, valueVal;
    if (rc == LCB_SUCCESS) {
        casVal = rdr.decodeCas<&lcb_respget_cas>();

        {
            Nan::TryCatch tryCatch;
            valueVal =
                rdr.parseDocValue<&lcb_respget_value, lcb_respget_flags>();
            if (tryCatch.HasCaught()) {
                errVal = tryCatch.Exception();
            }
        }
    } else {
        casVal = Nan::Null();
        valueVal = Nan::Null();
    }

    rdr.invokeCallback(errVal, casVal, valueVal);
}

void Instance::lcbExistsRespHandler(lcb_INSTANCE *instance, int cbtype,
                                    const lcb_RESPEXISTS *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPEXISTS, &lcb_respexists_cookie> rdr(instance, resp);

    lcb_STATUS rc = rdr.getValue<&lcb_respexists_status>();

    Local<Value> errVal = rdr.decodeError<lcb_respexists_error_context>(rc);

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

void Instance::lcbGetReplicaRespHandler(lcb_INSTANCE *instance, int cbtype,
                                        const lcb_RESPGETREPLICA *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPGETREPLICA, &lcb_respgetreplica_cookie> rdr(instance,
                                                                   resp);

    lcb_STATUS rc = rdr.getValue<&lcb_respgetreplica_status>();
    Local<Value> errVal = rdr.decodeError<lcb_respgetreplica_error_context>(rc);

    uint32_t rflags = 0;
    if (!rdr.getValue<&lcb_respgetreplica_is_final>()) {
        rflags |= LCBX_RESP_F_NONFINAL;
    }

    Local<Value> casVal, valueVal;
    if (rc == LCB_SUCCESS) {
        casVal = rdr.decodeCas<&lcb_respgetreplica_cas>();

        {
            Nan::TryCatch tryCatch;
            valueVal = rdr.parseDocValue<&lcb_respgetreplica_value,
                                         &lcb_respgetreplica_flags>();
            if (tryCatch.HasCaught()) {
                errVal = tryCatch.Exception();
                tryCatch.Reset();
            }
        }
    } else {
        casVal = Nan::Null();
        valueVal = Nan::Null();
    }

    Local<Value> rflagsVal = Nan::New<Number>(rflags);

    if (rflags & LCBX_RESP_F_NONFINAL) {
        rdr.invokeNonFinalCallback(errVal, rflagsVal, casVal, valueVal);
    } else {
        rdr.invokeCallback(errVal, rflagsVal, casVal, valueVal);
    }
}

void Instance::lcbUnlockRespHandler(lcb_INSTANCE *instance, int cbtype,
                                    const lcb_RESPUNLOCK *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPUNLOCK, &lcb_respunlock_cookie> rdr(instance, resp);

    lcb_STATUS rc = rdr.getValue<&lcb_respunlock_status>();
    Local<Value> errVal = rdr.decodeError<lcb_respunlock_error_context>(rc);

    rdr.invokeCallback(errVal);
}

void Instance::lcbRemoveRespHandler(lcb_INSTANCE *instance, int cbtype,
                                    const lcb_RESPREMOVE *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPREMOVE, &lcb_respremove_cookie> rdr(instance, resp);

    lcb_STATUS rc = rdr.getValue<&lcb_respremove_status>();
    Local<Value> errVal = rdr.decodeError<lcb_respremove_error_context>(rc);

    Local<Value> casVal;
    if (rc == LCB_SUCCESS) {
        casVal = rdr.decodeCas<&lcb_respremove_cas>();
    } else {
        casVal = Nan::Null();
    }

    rdr.invokeCallback(errVal, casVal);
}

void Instance::lcbTouchRespHandler(lcb_INSTANCE *instance, int cbtype,
                                   const lcb_RESPTOUCH *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPTOUCH, &lcb_resptouch_cookie> rdr(instance, resp);

    lcb_STATUS rc = rdr.getValue<&lcb_resptouch_status>();
    Local<Value> errVal = rdr.decodeError<lcb_resptouch_error_context>(rc);

    Local<Value> casVal;
    if (rc == LCB_SUCCESS) {
        casVal = rdr.decodeCas<&lcb_resptouch_cas>();
    } else {
        casVal = Nan::Null();
    }

    rdr.invokeCallback(errVal, casVal);
}

void Instance::lcbStoreRespHandler(lcb_INSTANCE *instance, int cbtype,
                                   const lcb_RESPSTORE *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPSTORE, &lcb_respstore_cookie> rdr(instance, resp);

    lcb_STATUS rc = rdr.getValue<&lcb_respstore_status>();
    Local<Value> errVal = rdr.decodeError<lcb_respstore_error_context>(rc);

    Local<Value> casVal, tokenVal;
    if (rc == LCB_SUCCESS) {
        casVal = rdr.decodeCas<&lcb_respstore_cas>();
        tokenVal = rdr.decodeMutationToken<&lcb_respstore_mutation_token>();
    } else {
        casVal = Nan::Null();
        tokenVal = Nan::Null();
    }

    rdr.invokeCallback(errVal, casVal, tokenVal);
}

void Instance::lcbCounterRespHandler(lcb_INSTANCE *instance, int cbtype,
                                     const lcb_RESPCOUNTER *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPCOUNTER, &lcb_respcounter_cookie> rdr(instance, resp);

    lcb_STATUS rc = rdr.getValue<&lcb_respcounter_status>();
    Local<Value> errVal = rdr.decodeError<lcb_respcounter_error_context>(rc);

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

void Instance::lcbLookupRespHandler(lcb_INSTANCE *instance, int cbtype,
                                    const lcb_RESPSUBDOC *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPSUBDOC, &lcb_respsubdoc_cookie> rdr(instance, resp);

    lcb_STATUS rc = rdr.getValue<&lcb_respsubdoc_status>();
    Local<Value> errVal = rdr.decodeError<lcb_respsubdoc_error_context>(rc);

    Local<Value> resVal;
    if (rc == LCB_SUCCESS) {
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
                Nan::Set(resObj, Nan::New("value").ToLocalChecked(),
                         Nan::Null());
            }

            Nan::Set(resArr, i, resObj);
        }

        Local<Object> resObj = Nan::New<Object>();
        Nan::Set(resObj, Nan::New("cas").ToLocalChecked(),
                 rdr.decodeCas<&lcb_respsubdoc_cas>());
        Nan::Set(resObj, Nan::New("content").ToLocalChecked(), resArr);
        resVal = resObj;
    } else {
        resVal = Nan::Null();
    }

    rdr.invokeCallback(errVal, resVal);
}

void Instance::lcbMutateRespHandler(lcb_INSTANCE *instance, int cbtype,
                                    const lcb_RESPSUBDOC *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPSUBDOC, &lcb_respsubdoc_cookie> rdr(instance, resp);

    lcb_STATUS rc = rdr.getValue<&lcb_respsubdoc_status>();
    Local<Value> errVal = rdr.decodeError<lcb_respsubdoc_error_context>(rc);

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
        size_t numResults = rdr.getValue<&lcb_respsubdoc_result_size>();

        Local<Array> resArr = Nan::New<Array>(numResults);
        for (size_t i = 0; i < numResults; ++i) {
            Local<Object> resObj = Nan::New<Object>();

            lcb_STATUS itemstatus =
                rdr.getValue<&lcb_respsubdoc_result_status>(i);
            if (itemstatus == LCB_SUCCESS) {
                Nan::Set(resObj, Nan::New("value").ToLocalChecked(),
                         rdr.parseValue<&lcb_respsubdoc_result_value>(i));
            } else {
                Nan::Set(resObj, Nan::New("value").ToLocalChecked(),
                         Nan::Null());
            }

            Nan::Set(resArr, i, resObj);
        }

        Local<Object> resObj = Nan::New<Object>();
        Nan::Set(resObj, Nan::New("cas").ToLocalChecked(),
                 rdr.decodeCas<&lcb_respsubdoc_cas>());
        Nan::Set(resObj, Nan::New("content").ToLocalChecked(), resArr);
        resVal = resObj;
    } else {
        resVal = Nan::Null();
    }

    rdr.invokeCallback(errVal, resVal);
}

void Instance::lcbViewDataHandler(lcb_INSTANCE *instance, int cbtype,
                                  const lcb_RESPVIEW *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPVIEW, &lcb_respview_cookie> rdr(instance, resp);

    lcb_STATUS rc = rdr.getValue<&lcb_respview_status>();
    Local<Value> errVal = rdr.decodeError<lcb_respview_error_context>(rc);

    Local<Value> idRes = rdr.parseValue<&lcb_respview_doc_id>();
    Local<Value> keyRes = rdr.parseValue<&lcb_respview_key>();
    Local<Value> valueRes = rdr.parseValue<&lcb_respview_row>();

    uint32_t rflags = 0;
    if (!rdr.getValue<&lcb_respview_is_final>()) {
        rflags |= LCBX_RESP_F_NONFINAL;
    }
    Local<Value> flagsVal = Nan::New<Number>(rflags);

    if (rflags & LCBX_RESP_F_NONFINAL) {
        rdr.invokeNonFinalCallback(errVal, flagsVal, valueRes, idRes, keyRes);
    } else {
        rdr.invokeCallback(errVal, flagsVal, valueRes, idRes, keyRes);
    }
}

void Instance::lcbQueryDataHandler(lcb_INSTANCE *instance, int cbtype,
                                   const lcb_RESPQUERY *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPQUERY, &lcb_respquery_cookie> rdr(instance, resp);

    lcb_STATUS rc = rdr.getValue<&lcb_respquery_status>();
    Local<Value> errVal = rdr.decodeError<lcb_respquery_error_context>(rc);

    Local<Value> dataRes = rdr.parseValue<&lcb_respquery_row>();

    uint32_t rflags = 0;
    if (!rdr.getValue<&lcb_respquery_is_final>()) {
        rflags |= LCBX_RESP_F_NONFINAL;
    }
    Local<Value> flagsVal = Nan::New<Number>(rflags);

    if (rflags & LCBX_RESP_F_NONFINAL) {
        rdr.invokeNonFinalCallback(errVal, flagsVal, dataRes);
    } else {
        rdr.invokeCallback(errVal, flagsVal, dataRes);
    }
}

void Instance::lcbAnalyticsDataHandler(lcb_INSTANCE *instance, int cbtype,
                                       const lcb_RESPANALYTICS *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPANALYTICS, &lcb_respanalytics_cookie> rdr(instance,
                                                                 resp);

    lcb_STATUS rc = rdr.getValue<&lcb_respanalytics_status>();
    Local<Value> errVal = rdr.decodeError<lcb_respanalytics_error_context>(rc);

    Local<Value> dataRes = rdr.parseValue<&lcb_respanalytics_row>();

    uint32_t rflags = 0;
    if (!rdr.getValue<&lcb_respanalytics_is_final>()) {
        rflags |= LCBX_RESP_F_NONFINAL;
    }
    Local<Value> flagsVal = Nan::New<Number>(rflags);

    if (rflags & LCBX_RESP_F_NONFINAL) {
        rdr.invokeNonFinalCallback(errVal, flagsVal, dataRes);
    } else {
        rdr.invokeCallback(errVal, flagsVal, dataRes);
    }
}

void Instance::lcbSearchDataHandler(lcb_INSTANCE *instance, int cbtype,
                                    const lcb_RESPSEARCH *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPSEARCH, &lcb_respsearch_cookie> rdr(instance, resp);

    lcb_STATUS rc = rdr.getValue<&lcb_respsearch_status>();
    Local<Value> errVal = rdr.decodeError<lcb_respsearch_error_context>(rc);

    Local<Value> dataRes = rdr.parseValue<&lcb_respsearch_row>();

    uint32_t rflags = 0;
    if (!rdr.getValue<&lcb_respsearch_is_final>()) {
        rflags |= LCBX_RESP_F_NONFINAL;
    }
    Local<Value> flagsVal = Nan::New<Number>(rflags);

    if (rflags & LCBX_RESP_F_NONFINAL) {
        rdr.invokeNonFinalCallback(errVal, flagsVal, dataRes);
    } else {
        rdr.invokeCallback(errVal, flagsVal, dataRes);
    }
}

void Instance::lcbHttpDataHandler(lcb_INSTANCE *instance, int cbtype,
                                  const lcb_RESPHTTP *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPHTTP, &lcb_resphttp_cookie> rdr(instance, resp);

    lcb_STATUS rc = rdr.getValue<&lcb_resphttp_status>();
    Local<Value> errVal = Error::create(rc);

    Local<Value> dataVal;

    uint32_t rflags = 0;
    if (rdr.getValue<&lcb_resphttp_is_final>()) {
        Local<Value> httpStatusRes =
            rdr.parseValue<&lcb_resphttp_http_status>();

        Local<Array> headersRes = Nan::New<Array>();
        const char *const *headers;
        lcb_resphttp_headers(resp, &headers);
        if (headers) {
            for (int headerIdx = 0; *headers; headerIdx++, headers++) {
                Local<String> headerVal =
                    Nan::New<String>(*headers).ToLocalChecked();
                Nan::Set(headersRes, headerIdx, headerVal);
            }
        }

        Local<Object> dataObj = Nan::New<Object>();
        Nan::Set(dataObj, Nan::New("statusCode").ToLocalChecked(),
                 httpStatusRes);
        Nan::Set(dataObj, Nan::New("headers").ToLocalChecked(), headersRes);
        dataVal = dataObj;
    } else {
        rflags |= LCBX_RESP_F_NONFINAL;
        dataVal = rdr.parseValue<&lcb_resphttp_body>();
    }

    Local<Value> flagsVal = Nan::New<Number>(rflags);

    if (rflags & LCBX_RESP_F_NONFINAL) {
        rdr.invokeNonFinalCallback(errVal, flagsVal, dataVal);
    } else {
        rdr.invokeCallback(errVal, flagsVal, dataVal);
    }
}

void Instance::lcbPingRespHandler(lcb_INSTANCE *instance, int cbtype,
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

void Instance::lcbDiagRespHandler(lcb_INSTANCE *instance, int cbtype,
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
