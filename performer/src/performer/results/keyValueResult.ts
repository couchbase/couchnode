import { CounterResult as CounterResultPb } from "../../proto/sdk.kv.binary.commands_pb";
import {
  ExistsResult as ExistsResultPb,
  GetReplicaResult as GetReplicaResultPb,
  GetResult as GetResultPb,
  MutationResult as MutationResultPb,
} from "../../proto/sdk.kv.commands_pb";

import {
  // [if:4.2.7]
  LookupInReplicaResult as LookupInReplicaResultPb,
  LookupInAllReplicasResult as LookupInAllReplicasResultPb,
  // [end]
  LookupInResult as LookupInResultPb,
  LookupInSpecResult as LookupInSpecResultPb,
  // [if:4.8.0]
  BooleanOrError as BooleanOrErrorPb,
  // [end]
} from "../../proto/sdk.kv.lookup_in_pb";

import {
  MutateInResult as MutateInResultPb,
  MutateInSpecResult as MutateInSpecResultPb,
} from "../../proto/sdk.kv.mutate_in_pb";
// [if:4.2.6]
import { ScanResult as ScanResultPb } from "../../proto/sdk.kv.rangescan.top_level_pb";
// [end]
import {
  ContentAs as ContentAsPb,
  ContentOrError as ContentOrErrorPb,
} from "../../proto/shared.content_pb";

import {
  CounterResult,
  ExistsResult,
  GetReplicaResult,
  GetResult,
  // [if:4.2.7]
  LookupInReplicaResult,
  // [end]
  LookupInResult,
  LookupInResultEntry,
  MutateInResult,
  MutateInResultEntry,
  MutationResult,
  // [if:4.2.6]
  ScanResult,
  // [end]
} from "couchbase";

import { SdkError } from "../error";
import { SdkUtils } from "../utils";

export class SdkKeyValueCommandResult {
  static toCounterResultPb(result: CounterResult): CounterResultPb {
    const counterResult = new CounterResultPb();
    counterResult.setCas(result.cas.toString());
    counterResult.setContent(result.value);
    if (result.token) {
      counterResult.setMutationToken(SdkUtils.toTokenPb(result.token));
    }
    return counterResult;
  }

  static toExistsResultPb(result: ExistsResult): ExistsResultPb {
    const existsResult = new ExistsResultPb();
    if (result.cas) {
      existsResult.setCas(result.cas.toString());
    }
    existsResult.setExists(result.exists);
    return existsResult;
  }

  static toGetReplicaResultPb(
    result: GetReplicaResult,
    contentAs?: ContentAsPb,
    streamId?: string,
  ): GetReplicaResultPb {
    const getReplicaResult = new GetReplicaResultPb();
    getReplicaResult.setCas(result.cas.toString());
    getReplicaResult.setContent(
      SdkUtils.getContentTypes(contentAs, result.content),
    );
    getReplicaResult.setIsReplica(result.isReplica);
    // TODO:  SDK does not set expiryTime, but I don't think it is needed...
    // if (result.expiryTime) {
    //   getReplicaResult.setExpiryTime(result.expiryTime);
    // }
    if (streamId) {
      getReplicaResult.setStreamId(streamId);
    }
    return getReplicaResult;
  }

  static toGetResultPb(
    result: GetResult,
    contentAs?: ContentAsPb,
  ): GetResultPb {
    const getResult = new GetResultPb();
    getResult.setCas(result.cas.toString());
    getResult.setContent(SdkUtils.getContentTypes(contentAs, result.content));
    if (result.expiryTime) {
      getResult.setExpiryTime(result.expiryTime);
    }
    return getResult;
  }

  static toLookupInSpecResultPbList(
    results: LookupInResultEntry[],
    contentAsList: ContentAsPb[],
    existsFn: (index: number) => boolean,
  ): LookupInSpecResultPb[] {
    const lookupInSpecResults: LookupInSpecResultPb[] = [];
    for (let i = 0; i < results.length; i++) {
      const result = new LookupInSpecResultPb();
      const contentOrError = new ContentOrErrorPb();
      if (results[i].value != null) {
        contentOrError.setContent(
          SdkUtils.getContentTypes(contentAsList[i], results[i].value),
        );
      }
      if (results[i].error) {
        contentOrError.setException(SdkError.toExceptionPb(results[i].error));
      }

      result.setContentAsResult(contentOrError);

      // exists_result: LookupInResult.exists() returns true/false for
      // success/path-not-found and throws for any other subdoc status, which we
      // surface as the exception arm of BooleanOrError.
      // [if:4.8.0]
      const existsResult = new BooleanOrErrorPb();
      try {
        existsResult.setValue(existsFn(i));
      } catch (err) {
        existsResult.setException(SdkError.toExceptionPb(err));
      }
      result.setExistsResult(existsResult);
      // [end]

      lookupInSpecResults.push(result);
    }
    return lookupInSpecResults;
  }

  // [if:4.2.7]
  static toLookupInReplicaResultPb(
    result: LookupInReplicaResult,
    contentAsList: ContentAsPb[],
  ): LookupInReplicaResultPb {
    const res = new LookupInReplicaResultPb();
    res.setCas(result.cas.toString());
    res.setIsReplica(result.isReplica);
    // [if:4.8.0]
    // delta is a JS_STRING int64 on the wire (see performer/scripts/update-protobuf.sh); pass
    // it to the SDK as a bigint so values up to Long.MAX_VALUE survive.
    const existsFn = (index: number) => result.exists(index);
    // [else]
    //? const existsFn = (_: number) => false;
    // [end]
    res.setResultsList(
      SdkKeyValueCommandResult.toLookupInSpecResultPbList(
        result.content,
        contentAsList,
        existsFn,
      ),
    );
    return res;
  }

  static toLookupInAllReplicasResultPb(
    result: LookupInReplicaResult,
    contentAsList: ContentAsPb[],
    streamId: string,
  ): LookupInAllReplicasResultPb {
    const res = new LookupInAllReplicasResultPb();
    res.setStreamId(streamId);
    res.setLookupInReplicaResult(
      SdkKeyValueCommandResult.toLookupInReplicaResultPb(result, contentAsList),
    );
    return res;
  }
  // [end]

  static toLookupInResultPb(
    result: LookupInResult,
    contentAsList: ContentAsPb[],
  ): LookupInResultPb {
    if (result.content.length !== contentAsList.length) {
      throw new Error("Result spec length not equal to requested specs");
    }
    const lookupInResult = new LookupInResultPb();
    // [if:4.8.0]
    // delta is a JS_STRING int64 on the wire (see performer/scripts/update-protobuf.sh); pass
    // it to the SDK as a bigint so values up to Long.MAX_VALUE survive.
    const existsFn = (index: number) => result.exists(index);
    // [else]
    //? const existsFn = (_: number) => false;
    // [end]
    lookupInResult.setCas(result.cas.toString());
    lookupInResult.setResultsList(
      SdkKeyValueCommandResult.toLookupInSpecResultPbList(
        result.content,
        contentAsList,
        existsFn,
      ),
    );
    return lookupInResult;
  }

  static toMutateInSpecResultPbList(
    results: MutateInResultEntry[],
    contentAsList: ContentAsPb[],
  ): MutateInSpecResultPb[] {
    // TODO:  error?
    const mutateInSpecResults: MutateInSpecResultPb[] = [];
    for (let i = 0; i < results.length; i++) {
      const result = new MutateInSpecResultPb();
      const contentOrError = new ContentOrErrorPb();
      if (results[i].value != null) {
        contentOrError.setContent(
          SdkUtils.getContentTypes(contentAsList[i], results[i].value),
        );
      }
      // if (results[i].error) {
      //   contentOrError.setException(
      //     SdkUtils.fromException(results[i].error)
      //   );
      // }

      result.setContentAsResult(contentOrError);
      mutateInSpecResults.push(result);
    }
    return mutateInSpecResults;
  }

  static toMutateInResultPb(
    result: MutateInResult,
    contentAsList: ContentAsPb[],
  ): MutateInResultPb {
    if (result.content.length !== contentAsList.length) {
      throw new Error("Result spec length not equal to requested specs");
    }
    const mutateInResult = new MutateInResultPb();
    // [if:4.2.1]
    if (result.token) {
      mutateInResult.setMutationToken(SdkUtils.toTokenPb(result.token));
    }
    // [end]
    mutateInResult.setCas(result.cas.toString());
    mutateInResult.setResultsList(
      SdkKeyValueCommandResult.toMutateInSpecResultPbList(
        result.content,
        contentAsList,
      ),
    );
    return mutateInResult;
  }

  static toMutationResultPb(result: MutationResult): MutationResultPb {
    const mutationResult = new MutationResultPb();
    if (result.token) {
      mutationResult.setMutationToken(SdkUtils.toTokenPb(result.token));
    }
    mutationResult.setCas(result.cas.toString());
    return mutationResult;
  }

  // [if:4.2.6]
  static toRangeScanResultPb(
    result: ScanResult,
    streamId: string,
    contentAs?: ContentAsPb,
    idsOnly = false,
  ): ScanResultPb {
    const scanResult = new ScanResultPb();
    scanResult.setId(result.id);
    scanResult.setStreamId(streamId);
    scanResult.setIdOnly(idsOnly);
    if (result.content) {
      const encodedContent = SdkUtils.getContentTypes(
        contentAs,
        result.content,
      );
      scanResult.setContent(encodedContent);
    }
    if (result.expiryTime) {
      scanResult.setExpiryTime(result.expiryTime);
    }
    if (result.cas) {
      scanResult.setCas(result.cas.toString());
    }
    return scanResult;
  }
  // [end]
}
