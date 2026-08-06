import { Duration } from "google-protobuf/google/protobuf/duration_pb";
import { Timestamp } from "google-protobuf/google/protobuf/timestamp_pb";

import { Result as ResultPb } from "../../proto/run.top_level_pb";
import {
  Append as AppendPb,
  CounterResult,
  Decrement as DecrementPb,
  Increment as IncrementPb,
  Prepend as PrependPb,
} from "../../proto/sdk.kv.binary.commands_pb";
import {
  DecrementOptions as DecrementOptionsPb,
  IncrementOptions as IncrementOptionsPb,
} from "../../proto/sdk.kv.binary.options_pb";
import {
  Get as GetPb,
  GetAllReplicas as GetAllReplicasPb,
  GetAndLock as GetAndLockPb,
  GetAndTouch as GetAndTouchPb,
  GetAnyReplica as GetAnyReplicaPb,
  Exists as ExistsPb,
  Insert as InsertPb,
  Remove as RemovePb,
  Replace as ReplacePb,
  Touch as TouchPb,
  // [if:4.3.1]
  Unlock as UnlockPb,
  // [end]
  Upsert as UpsertPb,
} from "../../proto/sdk.kv.commands_pb";
import {
  ExistsOperation as ExistsOperationPb,
  LookupIn as LookupInPb,
  // [if:4.2.7]
  LookupInAllReplicas as LookupInAllReplicasPb,
  LookupInAnyReplica as LookupInAnyReplicaPb,
  // [end]
  LookupInSpec as LookupInSpecPb,
  GetOperation as GetOperationPb,
  CountOperation as CountOperationPb,
} from "../../proto/sdk.kv.lookup_in_pb";
import {
  ArrayAddUniqueOperation as ArrayAddUniqueOperationPb,
  ArrayAppendOperation as ArrayAppendOperationPb,
  ArrayInsertOperation as ArrayInsertOperationPb,
  ArrayPrependOperation as ArrayPrependOperationPb,
  ContentOrMacro as ContentOrMacroPb,
  DecrementOperation as DecrementOperationPb,
  IncrementOperation as IncrementOperationPb,
  InsertOperation as InsertOperationPb,
  MutateIn as MutateInPb,
  MutateInMacro as MutateInMacroPb,
  MutateInSpec as MutateInSpecPb,
  RemoveOperation as RemoveOperationPb,
  ReplaceOperation as ReplaceOperationPb,
  UpsertOperation as UpsertOperationPb,
} from "../../proto/sdk.kv.mutate_in_pb";
// [if:4.2.6]
import {
  Scan as ScanPb,
  ScanType as ScanTypePb,
  SamplingScan as SamplingScanPb,
  RangeScan as RangeScanPb,
  Range as RangePb,
  ScanTermChoice as ScanTermChoicePb,
  ScanTerm as ScanTermPb,
} from "../../proto/sdk.kv.rangescan.top_level_pb";
// [end]
import {
  BinaryCollectionLevelCommand as BinaryCollectionLevelCommandPb,
  CollectionLevelCommand as CollectionLevelCommandPb,
  Command as SdkCommandPb,
  Result as SdkKeyValueCommandResultPb,
} from "../../proto/sdk.workload_pb";
import { Expiry as ExpiryPb } from "../../proto/shared.basic_pb";
import { Collection as CollectionPb } from "../../proto/shared.collection_pb";
import {
  Content as ContentPb,
  ContentAs as ContentAsPb,
} from "../../proto/shared.content_pb";
import { DocLocation as DocLocationPb } from "../../proto/shared.doc_location_pb";
import {
  Config as StreamConfigPb,
  Type as StreamTypePb,
} from "../../proto/streams.top_level_pb";

import {
  AppendOptions,
  Collection,
  Cluster,
  DecrementOptions,
  ExistsOptions,
  ExistsResult,
  GetAllReplicasOptions,
  GetAndLockOptions,
  GetAndTouchOptions,
  GetAnyReplicaOptions,
  GetOptions,
  GetResult,
  IncrementOptions,
  InsertOptions,
  // [if:4.2.7]
  LookupInAnyReplicaOptions,
  LookupInAllReplicasOptions,
  LookupInReplicaResult,
  // [end]
  LookupInOptions,
  LookupInResult,
  LookupInSpec,
  MutateInMacro,
  MutateInOptions,
  MutateInSpec,
  MutateInResult,
  MutationResult,
  PrependOptions,
  RemoveOptions,
  ReplaceOptions,
  // [if:4.2.6]
  ScanOptions,
  ScanResult,
  // [end]
  TouchOptions,
  // [if:4.3.1]
  UnlockOptions,
  // [end]
  UpsertOptions,
  GetReplicaResult,
} from "couchbase";
// [if:4.2.6]
import {
  PrefixScan,
  RangeScan,
  SamplingScan,
  ScanTerm,
} from "couchbase/dist/rangeScan";
// [end]
// [if:4.2.6]
import { StreamableScanPromise } from "couchbase/dist/streamablepromises";
// [end]
// [if:4.2.7]
import { StreamableReplicasPromise } from "couchbase/dist/streamablepromises";
// [end]

import { ISdkCommand } from "./command";

import { NotImplementedError, SdkError } from "../error";
import { SdkCommandKeyValueOptions } from "../options/keyValueOptions";
import { SdkKeyValueCommandResult } from "../results/keyValueResult";
import { SdkCommandResult } from "../results/result";

import { StreamConfig, StreamResult } from "../results/stream";
import { SdkUtils } from "../utils";
import { Counters } from "../bounds";
import { ISpanOwner } from "../observability/observabilityTypes";
import { maybeAddParentSpan } from "../observability/utils";

type KVCommandsPb =
  | AppendPb
  | DecrementPb
  | ExistsPb
  | GetAllReplicasPb
  | GetAnyReplicaPb
  | GetPb
  | IncrementPb
  | InsertPb
  // [if:4.2.7]
  | LookupInAllReplicasPb
  | LookupInAnyReplicaPb
  // [end]
  | LookupInPb
  | MutateInPb
  | PrependPb
  | RemovePb
  | ReplacePb
  // [if:4.3.1]
  | UnlockPb
  // [end]
  | UpsertPb;

type PerformerLookupInSpec = {
  spec: LookupInSpec;
  contentAs?: ContentAsPb;
};

type PerformerMutateInSpec = {
  spec: MutateInSpec;
  contentAs?: ContentAsPb;
};

// TODO:  change name if only related to KV ops, otherwise move to command.ts so other commands can use
class SdkCommand {
  // [if:4.2.6]
  static getCollection(cmd: ScanPb, connection: Cluster): Collection {
    return SdkUtils.toCollection(
      connection,
      cmd.getCollection() as CollectionPb,
    );
  }
  // [end]

  static getCollectionFromLocation(
    cmd: KVCommandsPb,
    connection: Cluster,
  ): Collection {
    const locationType = SdkUtils.getLocationType(
      cmd.getLocation() as DocLocationPb,
    );
    const collectionPb = locationType.getCollection() as CollectionPb;
    return SdkUtils.toCollection(connection, collectionPb);
  }

  static getDocId(cmd: KVCommandsPb, counters: Counters): string {
    return SdkUtils.getId(cmd.getLocation() as DocLocationPb, counters);
  }

  // [if:4.2.6]
  static toRangeScan(
    scanType: ScanTypePb,
  ): RangeScan | PrefixScan | SamplingScan {
    if (scanType.hasSampling()) {
      const sampling = scanType.getSampling() as SamplingScanPb;
      return new SamplingScan(sampling.getLimit(), sampling.getSeed());
    }
    if (scanType.hasRange()) {
      const range = scanType.getRange() as RangeScanPb;
      if (range.hasFromTo()) {
        const fromToRange = range.getFromTo() as RangePb;
        const fromPb = fromToRange.getFrom() as ScanTermChoicePb;
        const toPb = fromToRange.getTo() as ScanTermChoicePb;
        let from = undefined;
        let to = undefined;
        if (!fromPb.getDefault()) {
          const term = fromPb.getTerm() as ScanTermPb;
          from = new ScanTerm(term.getAsString(), term.getExclusive());
        }
        if (!toPb.getDefault()) {
          const term = toPb.getTerm() as ScanTermPb;
          to = new ScanTerm(term.getAsString(), term.getExclusive());
        }
        return new RangeScan(from, to);
      } else if (range.hasDocIdPrefix()) {
        return new PrefixScan(range.getDocIdPrefix());
      }
    }
    throw new Error("Unhandled scan type");
  }
  // [end]

  static toSdkContentFromContentPb(content?: ContentPb): any {
    if (!content) {
      throw new Error("Mutation does not have content");
    }

    if (content.hasPassthroughString()) {
      return content.getPassthroughString();
    } else if (content.hasConvertToJson()) {
      const decoder = new TextDecoder("utf-8");
      const decodedMessage = decoder.decode(content.getConvertToJson_asU8());
      return JSON.parse(decodedMessage);
    } else if (content.hasNull()) {
      return null;
    } else if (content.hasByteArray()) {
      return Buffer.from(content.getByteArray_asU8());
    }
    throw new Error("Unsupported content type" + content);
  }

  static toSdkContent(content: string | Uint8Array): string | Buffer {
    if (content instanceof Uint8Array) {
      return Buffer.from(content);
    }
    return content;
  }
}

export class SdkBinaryAppendCommand implements ISdkCommand {
  private _collection: Collection;
  private _docId: string;
  private _initiated: Timestamp;
  private _returnResult: boolean;
  private _options: AppendOptions | undefined;
  private _content: string | Buffer;

  constructor(
    cb: Collection,
    docId: string,
    content: any,
    returnResult: boolean,
    initiated: Timestamp,
    options?: AppendOptions,
  ) {
    this._collection = cb;
    this._docId = docId;
    this._content = content;
    this._initiated = initiated;
    this._returnResult = returnResult;
    this._options = options;
  }

  async executeCommand(): Promise<ResultPb> {
    const start = performance.now();
    const appendResult = await this._collection
      .binary()
      .append(this._docId, this._content, this._options);
    const end = performance.now();

    const sdkCommandResult = new SdkKeyValueCommandResultPb();
    sdkCommandResult.setSuccess(appendResult instanceof MutationResult);
    if (this._returnResult) {
      sdkCommandResult.setMutationResult(
        SdkKeyValueCommandResult.toMutationResultPb(appendResult),
      );
    }
    return SdkCommandResult.getTopLevelResult(
      this._initiated,
      sdkCommandResult,
      start,
      end,
    );
  }

  hasStreamConfig(): boolean {
    return false;
  }

  getStreamConfig(): undefined {
    return undefined;
  }
}

export class SdkBinaryDecrementCommand implements ISdkCommand {
  private _collection: Collection;
  private _docId: string;
  // TODO:  move to options
  private _delta: number;
  private _initiated: Timestamp;
  private _returnResult: boolean;
  private _options: DecrementOptions | undefined;

  constructor(
    cb: Collection,
    docId: string,
    delta: number,
    returnResult: boolean,
    initiated: Timestamp,
    options?: DecrementOptions,
  ) {
    this._collection = cb;
    this._docId = docId;
    this._delta = delta;
    this._initiated = initiated;
    this._returnResult = returnResult;
    this._options = options;
  }

  async executeCommand(): Promise<ResultPb> {
    const start = performance.now();
    const decrementResult = await this._collection
      .binary()
      .decrement(this._docId, this._delta, this._options);
    const end = performance.now();

    const sdkCommandResult = new SdkKeyValueCommandResultPb();
    sdkCommandResult.setSuccess(decrementResult instanceof CounterResult);
    if (this._returnResult) {
      sdkCommandResult.setCounterResult(
        SdkKeyValueCommandResult.toCounterResultPb(decrementResult),
      );
    }
    return SdkCommandResult.getTopLevelResult(
      this._initiated,
      sdkCommandResult,
      start,
      end,
    );
  }

  hasStreamConfig(): boolean {
    return false;
  }

  getStreamConfig(): undefined {
    return undefined;
  }
}

export class SdkBinaryIncrementCommand implements ISdkCommand {
  private _collection: Collection;
  private _docId: string;
  // TODO:  move to options
  private _delta: number;
  private _initiated: Timestamp;
  private _returnResult: boolean;
  private _options: IncrementOptions | undefined;

  constructor(
    cb: Collection,
    docId: string,
    delta: number,
    returnResult: boolean,
    initiated: Timestamp,
    options?: IncrementOptions,
  ) {
    this._collection = cb;
    this._docId = docId;
    this._delta = delta;
    this._initiated = initiated;
    this._returnResult = returnResult;
    this._options = options;
  }

  async executeCommand(): Promise<ResultPb> {
    const start = performance.now();
    const incrementResult = await this._collection
      .binary()
      .increment(this._docId, this._delta, this._options);
    const end = performance.now();

    const sdkCommandResult = new SdkKeyValueCommandResultPb();
    sdkCommandResult.setSuccess(incrementResult instanceof CounterResult);
    if (this._returnResult) {
      sdkCommandResult.setCounterResult(
        SdkKeyValueCommandResult.toCounterResultPb(incrementResult),
      );
    }
    return SdkCommandResult.getTopLevelResult(
      this._initiated,
      sdkCommandResult,
      start,
      end,
    );
  }

  hasStreamConfig(): boolean {
    return false;
  }

  getStreamConfig(): undefined {
    return undefined;
  }
}

export class SdkBinaryPrependCommand implements ISdkCommand {
  private _collection: Collection;
  private _docId: string;
  private _initiated: Timestamp;
  private _returnResult: boolean;
  private _options: PrependOptions | undefined;
  private _content: string | Buffer;

  constructor(
    cb: Collection,
    docId: string,
    content: any,
    returnResult: boolean,
    initiated: Timestamp,
    options?: PrependOptions,
  ) {
    this._collection = cb;
    this._docId = docId;
    this._content = content;
    this._initiated = initiated;
    this._returnResult = returnResult;
    this._options = options;
  }

  async executeCommand(): Promise<ResultPb> {
    const start = performance.now();
    const prependResult = await this._collection
      .binary()
      .prepend(this._docId, this._content, this._options);
    const end = performance.now();

    const sdkCommandResult = new SdkKeyValueCommandResultPb();
    sdkCommandResult.setSuccess(prependResult instanceof MutationResult);
    if (this._returnResult) {
      sdkCommandResult.setMutationResult(
        SdkKeyValueCommandResult.toMutationResultPb(prependResult),
      );
    }
    return SdkCommandResult.getTopLevelResult(
      this._initiated,
      sdkCommandResult,
      start,
      end,
    );
  }

  hasStreamConfig(): boolean {
    return false;
  }

  getStreamConfig(): undefined {
    return undefined;
  }
}

export class SdkExistsCommand implements ISdkCommand {
  private _collection: Collection;
  private _docId: string;
  private _initiated: Timestamp;
  private _returnResult: boolean;
  private _options: ExistsOptions | undefined;

  constructor(
    cb: Collection,
    docId: string,
    returnResult: boolean,
    initiated: Timestamp,
    options?: ExistsOptions,
  ) {
    this._collection = cb;
    this._docId = docId;
    this._initiated = initiated;
    this._returnResult = returnResult;
    this._options = options;
  }

  async executeCommand(): Promise<ResultPb> {
    const start = performance.now();
    const existsResult = await this._collection.exists(
      this._docId,
      this._options,
    );
    const end = performance.now();

    const sdkCommandResult = new SdkKeyValueCommandResultPb();
    sdkCommandResult.setSuccess(existsResult instanceof ExistsResult);
    if (this._returnResult) {
      sdkCommandResult.setExistsResult(
        SdkKeyValueCommandResult.toExistsResultPb(existsResult),
      );
    }
    return SdkCommandResult.getTopLevelResult(
      this._initiated,
      sdkCommandResult,
      start,
      end,
    );
  }

  hasStreamConfig(): boolean {
    return false;
  }

  getStreamConfig(): undefined {
    return undefined;
  }
}

export class SdkGetAllReplicasCommand implements ISdkCommand {
  private _collection: Collection;
  private _docId: string;
  private _streamConfig: StreamConfig;
  private _contentAs: ContentAsPb | undefined;
  private _options: GetAllReplicasOptions | undefined;

  constructor(
    cb: Collection,
    docId: string,
    streamConfig: StreamConfig,
    contentAs?: ContentAsPb,
    options?: GetAllReplicasOptions,
  ) {
    this._collection = cb;
    this._docId = docId;
    this._streamConfig = streamConfig;
    this._contentAs = contentAs;
    this._options = options;
  }

  async executeCommand(): Promise<GetReplicaResult[]> {
    return this._collection.getAllReplicas(this._docId, this._options);
  }

  getContentAsPb(): ContentAsPb | undefined {
    return this._contentAs;
  }

  hasStreamConfig(): boolean {
    return true;
  }

  getStreamConfig(): StreamConfig {
    return this._streamConfig;
  }
}

export class SdkGetAndLockCommand implements ISdkCommand {
  private _collection: Collection;
  private _docId: string;
  private _lockTime: number;
  private _initiated: Timestamp;
  private _returnResult: boolean;
  private _contentAs: ContentAsPb | undefined;
  private _options: GetAndLockOptions | undefined;

  constructor(
    cb: Collection,
    docId: string,
    lockTime: number,
    returnResult: boolean,
    initiated: Timestamp,
    contentAs?: ContentAsPb,
    options?: GetAndLockOptions,
  ) {
    this._collection = cb;
    this._docId = docId;
    this._lockTime = lockTime;
    this._initiated = initiated;
    this._returnResult = returnResult;
    this._contentAs = contentAs;
    this._options = options;
  }

  async executeCommand(): Promise<ResultPb> {
    const start = performance.now();
    const getResult = await this._collection.getAndLock(
      this._docId,
      this._lockTime,
      this._options,
    );
    const end = performance.now();

    const sdkCommandResult = new SdkKeyValueCommandResultPb();
    sdkCommandResult.setSuccess(getResult instanceof GetResult);
    if (this._returnResult) {
      sdkCommandResult.setGetResult(
        SdkKeyValueCommandResult.toGetResultPb(
          getResult,
          this._contentAs as ContentAsPb,
        ),
      );
    }
    return SdkCommandResult.getTopLevelResult(
      this._initiated,
      sdkCommandResult,
      start,
      end,
    );
  }

  hasStreamConfig(): boolean {
    return false;
  }

  getStreamConfig(): undefined {
    return undefined;
  }
}

export class SdkGetAndTouchCommand implements ISdkCommand {
  private _collection: Collection;
  private _docId: string;
  private _expiry: number;
  private _initiated: Timestamp;
  private _returnResult: boolean;
  private _contentAs: ContentAsPb | undefined;
  private _options: GetAndTouchOptions | undefined;

  constructor(
    cb: Collection,
    docId: string,
    expiry: number,
    returnResult: boolean,
    initiated: Timestamp,
    contentAs?: ContentAsPb,
    options?: GetAndLockOptions,
  ) {
    this._collection = cb;
    this._docId = docId;
    this._expiry = expiry;
    this._initiated = initiated;
    this._returnResult = returnResult;
    this._contentAs = contentAs;
    this._options = options;
  }

  async executeCommand(): Promise<ResultPb> {
    const start = performance.now();
    const getResult = await this._collection.getAndTouch(
      this._docId,
      this._expiry,
      this._options,
    );
    const end = performance.now();

    const sdkCommandResult = new SdkKeyValueCommandResultPb();
    sdkCommandResult.setSuccess(getResult instanceof GetResult);
    if (this._returnResult) {
      sdkCommandResult.setGetResult(
        SdkKeyValueCommandResult.toGetResultPb(
          getResult,
          this._contentAs as ContentAsPb,
        ),
      );
    }
    return SdkCommandResult.getTopLevelResult(
      this._initiated,
      sdkCommandResult,
      start,
      end,
    );
  }

  hasStreamConfig(): boolean {
    return false;
  }

  getStreamConfig(): undefined {
    return undefined;
  }
}

export class SdkGetAnyReplicaCommand implements ISdkCommand {
  private _collection: Collection;
  private _docId: string;
  private _initiated: Timestamp;
  private _returnResult: boolean;
  private _contentAs: ContentAsPb | undefined;
  private _options: GetAnyReplicaOptions | undefined;

  constructor(
    cb: Collection,
    docId: string,
    returnResult: boolean,
    initiated: Timestamp,
    contentAs?: ContentAsPb,
    options?: GetAnyReplicaOptions,
  ) {
    this._collection = cb;
    this._docId = docId;
    this._initiated = initiated;
    this._returnResult = returnResult;
    this._contentAs = contentAs;
    this._options = options;
  }

  async executeCommand(): Promise<ResultPb> {
    const start = performance.now();
    const getReplicaResult = await this._collection.getAnyReplica(
      this._docId,
      this._options,
    );
    const end = performance.now();

    const sdkCommandResult = new SdkKeyValueCommandResultPb();
    sdkCommandResult.setSuccess(getReplicaResult instanceof GetReplicaResult);
    if (this._returnResult) {
      sdkCommandResult.setGetReplicaResult(
        SdkKeyValueCommandResult.toGetReplicaResultPb(
          getReplicaResult,
          this._contentAs,
        ),
      );
    }
    return SdkCommandResult.getTopLevelResult(
      this._initiated,
      sdkCommandResult,
      start,
      end,
    );
  }

  hasStreamConfig(): boolean {
    return false;
  }

  getStreamConfig(): undefined {
    return undefined;
  }
}

export class SdkGetCommand implements ISdkCommand {
  private _collection: Collection;
  private _docId: string;
  private _initiated: Timestamp;
  private _returnResult: boolean;
  private _contentAs: ContentAsPb | undefined;
  private _options: GetOptions | undefined;

  constructor(
    cb: Collection,
    docId: string,
    returnResult: boolean,
    initiated: Timestamp,
    contentAs?: ContentAsPb,
    options?: GetOptions,
  ) {
    this._collection = cb;
    this._docId = docId;
    this._initiated = initiated;
    this._returnResult = returnResult;
    this._contentAs = contentAs;
    this._options = options;
  }

  async executeCommand(): Promise<ResultPb> {
    const start = performance.now();
    const getResult = await this._collection.get(this._docId, this._options);
    const end = performance.now();

    const sdkCommandResult = new SdkKeyValueCommandResultPb();
    sdkCommandResult.setSuccess(getResult instanceof GetResult);
    if (this._returnResult) {
      sdkCommandResult.setGetResult(
        SdkKeyValueCommandResult.toGetResultPb(
          getResult,
          this._contentAs as ContentAsPb,
        ),
      );
    }
    return SdkCommandResult.getTopLevelResult(
      this._initiated,
      sdkCommandResult,
      start,
      end,
    );
  }

  hasStreamConfig(): boolean {
    return false;
  }

  getStreamConfig(): undefined {
    return undefined;
  }
}

export class SdkInsertCommand implements ISdkCommand {
  private _collection: Collection;
  private _docId: string;
  private _initiated: Timestamp;
  private _returnResult: boolean;
  private _content: any;
  private _options: InsertOptions | undefined;

  constructor(
    cb: Collection,
    docId: string,
    content: any,
    returnResult: boolean,
    initiated: Timestamp,
    options?: InsertOptions,
  ) {
    this._collection = cb;
    this._docId = docId;
    this._content = content;
    this._initiated = initiated;
    this._returnResult = returnResult;
    this._options = options;
  }

  async executeCommand(): Promise<ResultPb> {
    const start = performance.now();
    const insertResult = await this._collection.insert(
      this._docId,
      this._content,
      this._options,
    );
    const end = performance.now();
    const sdkCommandResult = new SdkKeyValueCommandResultPb();
    sdkCommandResult.setSuccess(insertResult instanceof MutationResult);
    if (this._returnResult) {
      sdkCommandResult.setMutationResult(
        SdkKeyValueCommandResult.toMutationResultPb(insertResult),
      );
    }
    return SdkCommandResult.getTopLevelResult(
      this._initiated,
      sdkCommandResult,
      start,
      end,
    );
  }

  hasStreamConfig(): boolean {
    return false;
  }

  getStreamConfig(): undefined {
    return undefined;
  }
}

// [if:4.2.7]
export class SdkLookupInAllReplicasCommand implements ISdkCommand {
  private _collection: Collection;
  private _docId: string;
  private _initiated: Timestamp;
  private _streamConfig: StreamConfig;
  private _specs: PerformerLookupInSpec[];
  private _options: LookupInAllReplicasOptions | undefined;

  constructor(
    cb: Collection,
    docId: string,
    specs: PerformerLookupInSpec[],
    streamConfig: StreamConfig,
    initiated: Timestamp,
    options?: LookupInAllReplicasOptions,
  ) {
    this._collection = cb;
    this._docId = docId;
    this._specs = specs;
    this._streamConfig = streamConfig;
    this._initiated = initiated;
    this._options = options;
  }

  async executeCommand(streamResult: StreamResult): Promise<void> {
    // TODO:  fix return types in SDK
    const lookupInResult = this._collection.lookupInAllReplicas(
      this._docId,
      this._specs.map((s) => s.spec),
      this._options,
    ) as StreamableReplicasPromise<
      LookupInReplicaResult[],
      LookupInReplicaResult
    >;

    lookupInResult
      .on("replica", (result: LookupInReplicaResult) => {
        const sdkCommandResult = new SdkKeyValueCommandResultPb();
        sdkCommandResult.setLookupInAllReplicasResult(
          SdkKeyValueCommandResult.toLookupInAllReplicasResultPb(
            result,
            this._specs.map((s) => s.contentAs as ContentAsPb),
            streamResult.streamId,
          ),
        );
        streamResult.newItem(
          SdkCommandResult.getTopLevelResult(this._initiated, sdkCommandResult),
        );
      })
      .on("end", () => {
        streamResult.streamFinished();
      })
      .on("error", (err) => {
        const sdkCommandResult = new SdkKeyValueCommandResultPb();
        sdkCommandResult.setException(SdkError.toExceptionPb(err));
        streamResult.newItem(
          SdkCommandResult.getTopLevelResult(this._initiated, sdkCommandResult),
        );
        streamResult.streamFinished();
      });
  }

  hasStreamConfig(): boolean {
    return true;
  }

  getStreamConfig(): StreamConfig {
    return this._streamConfig;
  }
}

export class SdkLookupInAnyReplicaCommand implements ISdkCommand {
  private _collection: Collection;
  private _docId: string;
  private _initiated: Timestamp;
  private _returnResult: boolean;
  private _specs: PerformerLookupInSpec[];
  private _options: LookupInAnyReplicaOptions | undefined;

  constructor(
    cb: Collection,
    docId: string,
    specs: PerformerLookupInSpec[],
    returnResult: boolean,
    initiated: Timestamp,
    options?: LookupInAnyReplicaOptions,
  ) {
    this._collection = cb;
    this._docId = docId;
    this._specs = specs;
    this._initiated = initiated;
    this._returnResult = returnResult;
    this._options = options;
  }

  async executeCommand(): Promise<ResultPb> {
    const start = performance.now();
    const lookupInResult = await this._collection.lookupInAnyReplica(
      this._docId,
      this._specs.map((s) => s.spec),
      this._options,
    );
    const end = performance.now();

    const sdkCommandResult = new SdkKeyValueCommandResultPb();
    sdkCommandResult.setSuccess(
      lookupInResult instanceof LookupInReplicaResult,
    );
    if (this._returnResult) {
      sdkCommandResult.setLookupInAnyReplicaResult(
        SdkKeyValueCommandResult.toLookupInReplicaResultPb(
          lookupInResult,
          this._specs.map((s) => s.contentAs as ContentAsPb),
        ),
      );
    }
    return SdkCommandResult.getTopLevelResult(
      this._initiated,
      sdkCommandResult,
      start,
      end,
    );
  }

  hasStreamConfig(): boolean {
    return false;
  }

  getStreamConfig(): undefined {
    return undefined;
  }
}
// [end]

export class SdkLookupInCommand implements ISdkCommand {
  private _collection: Collection;
  private _docId: string;
  private _initiated: Timestamp;
  private _returnResult: boolean;
  private _specs: PerformerLookupInSpec[];
  private _options: LookupInOptions | undefined;

  constructor(
    cb: Collection,
    docId: string,
    specs: PerformerLookupInSpec[],
    returnResult: boolean,
    initiated: Timestamp,
    options?: LookupInOptions,
  ) {
    this._collection = cb;
    this._docId = docId;
    this._specs = specs;
    this._initiated = initiated;
    this._returnResult = returnResult;
    this._options = options;
  }

  async executeCommand(): Promise<ResultPb> {
    const start = performance.now();
    const lookupInResult = await this._collection.lookupIn(
      this._docId,
      this._specs.map((s) => s.spec),
      this._options,
    );
    const end = performance.now();

    const sdkCommandResult = new SdkKeyValueCommandResultPb();
    sdkCommandResult.setSuccess(lookupInResult instanceof LookupInResult);
    if (this._returnResult) {
      sdkCommandResult.setLookupInResult(
        SdkKeyValueCommandResult.toLookupInResultPb(
          lookupInResult,
          this._specs.map((s) => s.contentAs as ContentAsPb),
        ),
      );
    }
    return SdkCommandResult.getTopLevelResult(
      this._initiated,
      sdkCommandResult,
      start,
      end,
    );
  }

  hasStreamConfig(): boolean {
    return false;
  }

  getStreamConfig(): undefined {
    return undefined;
  }
}

export class SdkMutateInCommand implements ISdkCommand {
  private _collection: Collection;
  private _docId: string;
  private _initiated: Timestamp;
  private _returnResult: boolean;
  private _specs: PerformerMutateInSpec[];
  private _options: MutateInOptions | undefined;

  constructor(
    cb: Collection,
    docId: string,
    specs: PerformerMutateInSpec[],
    returnResult: boolean,
    initiated: Timestamp,
    options?: MutateInOptions,
  ) {
    this._collection = cb;
    this._docId = docId;
    this._specs = specs;
    this._initiated = initiated;
    this._returnResult = returnResult;
    this._options = options;
  }

  async executeCommand(): Promise<ResultPb> {
    const start = performance.now();
    const mutateInResult = await this._collection.mutateIn(
      this._docId,
      this._specs.map((s) => s.spec),
      this._options,
    );
    const end = performance.now();

    const sdkCommandResult = new SdkKeyValueCommandResultPb();
    sdkCommandResult.setSuccess(mutateInResult instanceof MutateInResult);
    if (this._returnResult) {
      sdkCommandResult.setMutateInResult(
        SdkKeyValueCommandResult.toMutateInResultPb(
          mutateInResult,
          this._specs.map((s) => s.contentAs as ContentAsPb),
        ),
      );
    }
    return SdkCommandResult.getTopLevelResult(
      this._initiated,
      sdkCommandResult,
      start,
      end,
    );
  }

  hasStreamConfig(): boolean {
    return false;
  }

  getStreamConfig(): undefined {
    return undefined;
  }
}

export class SdkRemoveCommand implements ISdkCommand {
  private _collection: Collection;
  private _docId: string;
  private _initiated: Timestamp;
  private _returnResult: boolean;
  private _options: RemoveOptions | undefined;

  constructor(
    cb: Collection,
    docId: string,
    returnResult: boolean,
    initiated: Timestamp,
    options?: RemoveOptions,
  ) {
    this._collection = cb;
    this._docId = docId;
    this._initiated = initiated;
    this._returnResult = returnResult;
    this._options = options;
  }

  async executeCommand(): Promise<ResultPb> {
    const start = performance.now();
    const removeResult = await this._collection.remove(
      this._docId,
      this._options,
    );
    const end = performance.now();
    const sdkCommandResult = new SdkKeyValueCommandResultPb();
    sdkCommandResult.setSuccess(removeResult instanceof MutationResult);
    if (this._returnResult) {
      sdkCommandResult.setMutationResult(
        SdkKeyValueCommandResult.toMutationResultPb(removeResult),
      );
    }
    return SdkCommandResult.getTopLevelResult(
      this._initiated,
      sdkCommandResult,
      start,
      end,
    );
  }

  hasStreamConfig(): boolean {
    return false;
  }

  getStreamConfig(): undefined {
    return undefined;
  }
}

export class SdkReplaceCommand implements ISdkCommand {
  private _collection: Collection;
  private _docId: string;
  private _initiated: Timestamp;
  private _returnResult: boolean;
  private _options: ReplaceOptions | undefined;
  private _content: any;

  constructor(
    cb: Collection,
    docId: string,
    content: any,
    returnResult: boolean,
    initiated: Timestamp,
    options?: ReplaceOptions,
  ) {
    this._collection = cb;
    this._docId = docId;
    this._content = content;
    this._initiated = initiated;
    this._returnResult = returnResult;
    this._options = options;
  }

  async executeCommand(): Promise<ResultPb> {
    const start = performance.now();
    const replaceResult = await this._collection.replace(
      this._docId,
      this._content,
      this._options,
    );
    const end = performance.now();

    const sdkCommandResult = new SdkKeyValueCommandResultPb();
    sdkCommandResult.setSuccess(replaceResult instanceof MutationResult);
    if (this._returnResult) {
      sdkCommandResult.setMutationResult(
        SdkKeyValueCommandResult.toMutationResultPb(replaceResult),
      );
    }
    return SdkCommandResult.getTopLevelResult(
      this._initiated,
      sdkCommandResult,
      start,
      end,
    );
  }

  hasStreamConfig(): boolean {
    return false;
  }

  getStreamConfig(): undefined {
    return undefined;
  }
}

// [if:4.2.6]
export class SdkScanCommand implements ISdkCommand {
  private _collection: Collection;
  private _scan: RangeScan | PrefixScan | SamplingScan;
  private _initiated: Timestamp;
  private _streamConfig: StreamConfig;
  private _contentAs: ContentAsPb | undefined;
  private _options: ScanOptions | undefined;

  constructor(
    cb: Collection,
    scan: RangeScan | PrefixScan | SamplingScan,
    contentAs: ContentAsPb | undefined,
    streamConfig: StreamConfig,
    initiated: Timestamp,
    options: ScanOptions | undefined,
  ) {
    this._collection = cb;
    this._scan = scan;
    this._contentAs = contentAs;
    this._streamConfig = streamConfig;
    this._initiated = initiated;
    this._options = options;
  }

  async executeCommand(streamResult: StreamResult): Promise<void> {
    // TODO:  fix range scan types
    const scanResult = this._collection.scan(
      this._scan,
      this._options,
    ) as StreamableScanPromise<ScanResult[], ScanResult>;
    scanResult
      .on("result", (result: ScanResult) => {
        const sdkCommandResult = new SdkKeyValueCommandResultPb();
        sdkCommandResult.setRangeScanResult(
          SdkKeyValueCommandResult.toRangeScanResultPb(
            result,
            streamResult.streamId,
            this._contentAs,
            this._options?.idsOnly,
          ),
        );
        streamResult.newItem(
          SdkCommandResult.getTopLevelResult(this._initiated, sdkCommandResult),
        );
      })
      .on("end", () => {
        streamResult.streamFinished();
      })
      .on("error", (err) => {
        streamResult.streamError(err);
      });
  }

  hasStreamConfig(): boolean {
    return true;
  }

  getStreamConfig(): StreamConfig {
    return this._streamConfig;
  }
}
// [end]

export class SdkTouchCommand implements ISdkCommand {
  private _collection: Collection;
  private _docId: string;
  private _expiry: number;
  private _returnResult: boolean;
  private _initiated: Timestamp;
  private _options: TouchOptions | undefined;

  constructor(
    cb: Collection,
    docId: string,
    expiry: number,
    returnResult: boolean,
    initiated: Timestamp,
    options?: TouchOptions,
  ) {
    this._collection = cb;
    this._docId = docId;
    this._expiry = expiry;
    this._initiated = initiated;
    this._options = options;
    this._returnResult = returnResult;
  }

  async executeCommand(): Promise<ResultPb> {
    const start = performance.now();
    const touchResult = await this._collection.touch(
      this._docId,
      this._expiry,
      this._options,
    );
    const end = performance.now();

    const sdkCommandResult = new SdkKeyValueCommandResultPb();
    sdkCommandResult.setSuccess(touchResult instanceof MutationResult);
    if (this._returnResult) {
      sdkCommandResult.setMutationResult(
        SdkKeyValueCommandResult.toMutationResultPb(touchResult),
      );
    }
    return SdkCommandResult.getTopLevelResult(
      this._initiated,
      sdkCommandResult,
      start,
      end,
    );
  }

  hasStreamConfig(): boolean {
    return false;
  }

  getStreamConfig(): undefined {
    return undefined;
  }
}

// [if:4.3.1]
export class SdkUnlockCommand implements ISdkCommand {
  private _collection: Collection;
  private _docId: string;
  private _cas: string;
  private _initiated: Timestamp;
  private _options: UnlockOptions | undefined;

  constructor(
    cb: Collection,
    docId: string,
    cas: string,
    initiated: Timestamp,
    options?: UnlockOptions,
  ) {
    this._collection = cb;
    this._docId = docId;
    this._cas = cas;
    this._initiated = initiated;
    this._options = options;
  }

  async executeCommand(): Promise<ResultPb> {
    const start = performance.now();
    await this._collection.unlock(this._docId, this._cas, this._options);
    const end = performance.now();
    const sdkCommandResult = new SdkKeyValueCommandResultPb();
    sdkCommandResult.setSuccess(true);
    return SdkCommandResult.getTopLevelResult(
      this._initiated,
      sdkCommandResult,
      start,
      end,
    );
  }

  hasStreamConfig(): boolean {
    return false;
  }

  getStreamConfig(): undefined {
    return undefined;
  }
}
// [end]

export class SdkUpsertCommand implements ISdkCommand {
  private _collection: Collection;
  private _docId: string;
  private _initiated: Timestamp;
  private _returnResult: boolean;
  private _options: UpsertOptions | undefined;
  private _content: any;

  constructor(
    cb: Collection,
    docId: string,
    content: any,
    returnResult: boolean,
    initiated: Timestamp,
    options?: UpsertOptions,
  ) {
    this._collection = cb;
    this._docId = docId;
    this._content = content;
    this._initiated = initiated;
    this._returnResult = returnResult;
    this._options = options;
  }

  async executeCommand(): Promise<ResultPb> {
    const start = performance.now();
    const upsertResult = await this._collection.upsert(
      this._docId,
      this._content,
      this._options,
    );

    const end = performance.now();
    const sdkCommandResult = new SdkKeyValueCommandResultPb();
    sdkCommandResult.setSuccess(upsertResult instanceof MutationResult);
    if (this._returnResult) {
      sdkCommandResult.setMutationResult(
        SdkKeyValueCommandResult.toMutationResultPb(upsertResult),
      );
    }
    return SdkCommandResult.getTopLevelResult(
      this._initiated,
      sdkCommandResult,
      start,
      end,
    );
  }

  hasStreamConfig(): boolean {
    return false;
  }

  getStreamConfig(): undefined {
    return undefined;
  }
}

export class SdkKeyValueCommandBuilder {
  static toLookupInSpecs(specs: LookupInSpecPb[]): PerformerLookupInSpec[] {
    const lookupInSpecs: PerformerLookupInSpec[] = [];
    specs.forEach((spec) => {
      if (spec.hasExists()) {
        const exists = spec.getExists() as ExistsOperationPb;
        lookupInSpecs.push({
          spec: LookupInSpec.exists(exists.getPath(), {
            xattr: exists.getXattr(),
          }),
          contentAs: spec.getContentAs(),
        });
      } else if (spec.hasCount()) {
        const count = spec.getCount() as CountOperationPb;
        lookupInSpecs.push({
          spec: LookupInSpec.count(count.getPath(), {
            xattr: count.getXattr(),
          }),
          contentAs: spec.getContentAs(),
        });
      } else if (spec.hasGet()) {
        const get = spec.getGet() as GetOperationPb;
        lookupInSpecs.push({
          spec: LookupInSpec.get(get.getPath(), { xattr: get.getXattr() }),
          contentAs: spec.getContentAs(),
        });
      } else {
        throw new NotImplementedError("Unimplemented Spec type");
      }
    });
    return lookupInSpecs;
  }

  static toMutateInMacro(macro: MutateInMacroPb): MutateInMacro {
    if (macro === MutateInMacroPb.CAS) {
      return MutateInMacro.Cas;
    } else if (macro === MutateInMacroPb.SEQ_NO) {
      return MutateInMacro.SeqNo;
    } else if (macro === MutateInMacroPb.VALUE_CRC_32C) {
      return MutateInMacro.ValueCrc32c;
    } else {
      throw new Error("Invalid MutateInMacro.");
    }
  }

  static toMutateInSpecs(specs: MutateInSpecPb[]): PerformerMutateInSpec[] {
    const mutateInSpecs: PerformerMutateInSpec[] = [];
    specs.forEach((spec) => {
      if (spec.hasArrayAddUnique()) {
        const arrayAddUnique =
          spec.getArrayAddUnique() as ArrayAddUniqueOperationPb;
        const contentOrMacro = arrayAddUnique.getContent() as ContentOrMacroPb;
        const content = contentOrMacro.hasMacro()
          ? SdkKeyValueCommandBuilder.toMutateInMacro(contentOrMacro.getMacro())
          : SdkCommand.toSdkContentFromContentPb(contentOrMacro.getContent());
        mutateInSpecs.push({
          spec: MutateInSpec.arrayAddUnique(arrayAddUnique.getPath(), content, {
            createPath: arrayAddUnique.getCreatePath(),
            xattr: arrayAddUnique.getXattr(),
          }),
          contentAs: spec.getContentAs(),
        });
      } else if (spec.hasArrayAppend()) {
        const arrayAppend = spec.getArrayAppend() as ArrayAppendOperationPb;
        const contentList = [];
        for (const contentOrMacro of arrayAppend.getContentList()) {
          contentList.push(
            contentOrMacro.hasMacro()
              ? SdkKeyValueCommandBuilder.toMutateInMacro(
                  contentOrMacro.getMacro(),
                )
              : SdkCommand.toSdkContentFromContentPb(
                  contentOrMacro.getContent(),
                ),
          );
        }
        mutateInSpecs.push({
          spec: MutateInSpec.arrayAppend(arrayAppend.getPath(), contentList, {
            createPath: arrayAppend.getCreatePath(),
            multi: true,
            xattr: arrayAppend.getXattr(),
          }),
          contentAs: spec.getContentAs(),
        });
      } else if (spec.hasArrayInsert()) {
        const arrayInsert = spec.getArrayInsert() as ArrayInsertOperationPb;
        const contentList = [];
        for (const contentOrMacro of arrayInsert.getContentList()) {
          contentList.push(
            contentOrMacro.hasMacro()
              ? SdkKeyValueCommandBuilder.toMutateInMacro(
                  contentOrMacro.getMacro(),
                )
              : SdkCommand.toSdkContentFromContentPb(
                  contentOrMacro.getContent(),
                ),
          );
        }
        mutateInSpecs.push({
          spec: MutateInSpec.arrayInsert(arrayInsert.getPath(), contentList, {
            createPath: arrayInsert.getCreatePath(),
            multi: true,
            xattr: arrayInsert.getXattr(),
          }),
          contentAs: spec.getContentAs(),
        });
      } else if (spec.hasArrayPrepend()) {
        const arrayPrepend = spec.getArrayPrepend() as ArrayPrependOperationPb;
        const contentList = [];
        for (const contentOrMacro of arrayPrepend.getContentList()) {
          contentList.push(
            contentOrMacro.hasMacro()
              ? SdkKeyValueCommandBuilder.toMutateInMacro(
                  contentOrMacro.getMacro(),
                )
              : SdkCommand.toSdkContentFromContentPb(
                  contentOrMacro.getContent(),
                ),
          );
        }
        mutateInSpecs.push({
          spec: MutateInSpec.arrayPrepend(arrayPrepend.getPath(), contentList, {
            createPath: arrayPrepend.getCreatePath(),
            multi: true,
            xattr: arrayPrepend.getXattr(),
          }),
          contentAs: spec.getContentAs(),
        });
      } else if (spec.hasDecrement()) {
        const decrement = spec.getDecrement() as DecrementOperationPb;
        // [if:4.8.0]
        // delta is a JS_STRING int64 on the wire (see performer/scripts/update-protobuf.sh); pass
        // it to the SDK as a bigint so values up to Long.MAX_VALUE survive.
        const decrementValue = BigInt(decrement.getDelta());
        // [else]
        //? const decrementValue = decrement.getDelta();
        // [end]
        mutateInSpecs.push({
          spec: MutateInSpec.decrement(decrement.getPath(), decrementValue, {
            createPath: decrement.getCreatePath(),
            xattr: decrement.getXattr(),
          }),
          contentAs: spec.getContentAs(),
        });
      } else if (spec.hasIncrement()) {
        const increment = spec.getIncrement() as IncrementOperationPb;
        // [if:4.8.0]
        // delta is a JS_STRING int64 on the wire (see performer/scripts/update-protobuf.sh); pass
        // it to the SDK as a bigint so values up to Long.MAX_VALUE survive.
        const incrementValue = BigInt(increment.getDelta());
        // [else]
        //? const incrementValue = increment.getDelta();
        // [end]
        mutateInSpecs.push({
          spec: MutateInSpec.increment(increment.getPath(), incrementValue, {
            createPath: increment.getCreatePath(),
            xattr: increment.getXattr(),
          }),
          contentAs: spec.getContentAs(),
        });
      } else if (spec.hasInsert()) {
        const insert = spec.getInsert() as InsertOperationPb;
        const contentOrMacro = insert.getContent() as ContentOrMacroPb;
        const content = contentOrMacro.hasMacro()
          ? SdkKeyValueCommandBuilder.toMutateInMacro(contentOrMacro.getMacro())
          : SdkCommand.toSdkContentFromContentPb(contentOrMacro.getContent());
        mutateInSpecs.push({
          spec: MutateInSpec.insert(insert.getPath(), content, {
            createPath: insert.getCreatePath(),
            xattr: insert.getXattr(),
          }),
          contentAs: spec.getContentAs(),
        });
      } else if (spec.hasRemove()) {
        const remove = spec.getRemove() as RemoveOperationPb;
        mutateInSpecs.push({
          spec: MutateInSpec.remove(remove.getPath(), {
            xattr: remove.getXattr(),
          }),
          contentAs: spec.getContentAs(),
        });
      } else if (spec.hasReplace()) {
        const replace = spec.getReplace() as ReplaceOperationPb;
        const contentOrMacro = replace.getContent() as ContentOrMacroPb;
        const content = contentOrMacro.hasMacro()
          ? SdkKeyValueCommandBuilder.toMutateInMacro(contentOrMacro.getMacro())
          : SdkCommand.toSdkContentFromContentPb(contentOrMacro.getContent());
        mutateInSpecs.push({
          spec: MutateInSpec.replace(replace.getPath(), content, {
            xattr: replace.getXattr(),
          }),
          contentAs: spec.getContentAs(),
        });
      } else if (spec.hasUpsert()) {
        const upsert = spec.getUpsert() as UpsertOperationPb;
        const contentOrMacro = upsert.getContent() as ContentOrMacroPb;
        const content = contentOrMacro.hasMacro()
          ? SdkKeyValueCommandBuilder.toMutateInMacro(contentOrMacro.getMacro())
          : SdkCommand.toSdkContentFromContentPb(contentOrMacro.getContent());
        mutateInSpecs.push({
          spec: MutateInSpec.upsert(upsert.getPath(), content, {
            createPath: upsert.getCreatePath(),
            xattr: upsert.getXattr(),
          }),
          contentAs: spec.getContentAs(),
        });
      } else {
        throw new NotImplementedError("Unimplemented MutateInSpec.");
      }
    });
    return mutateInSpecs;
  }

  static buildKeyValueClusterLevelCommand(
    connection: Cluster,
    command: SdkCommandPb,
    initiated: Timestamp,
    counters: Counters,
    spanOwner?: ISpanOwner,
  ): ISdkCommand {
    if (command.hasGet()) {
      const cmd = command.getGet() as GetPb;
      return new SdkGetCommand(
        SdkCommand.getCollectionFromLocation(cmd, connection),
        SdkCommand.getDocId(cmd, counters),
        command.getReturnResult(),
        initiated,
        cmd.getContentAs() as ContentAsPb,
        maybeAddParentSpan(
          SdkCommandKeyValueOptions.toSdkGetOptions(cmd.getOptions()),
          cmd.getOptions(),
          spanOwner,
        ),
      );
    } else if (command.hasInsert()) {
      const cmd = command.getInsert() as InsertPb;
      return new SdkInsertCommand(
        SdkCommand.getCollectionFromLocation(cmd, connection),
        SdkCommand.getDocId(cmd, counters),
        SdkCommand.toSdkContentFromContentPb(cmd.getContent()),
        command.getReturnResult(),
        initiated,
        maybeAddParentSpan(
          SdkCommandKeyValueOptions.toSdkInsertOptions(cmd.getOptions()),
          cmd.getOptions(),
          spanOwner,
        ),
      );
      // [if:4.2.6]
    } else if (command.hasRangeScan()) {
      const cmd = command.getRangeScan() as ScanPb;
      const rangeScan = SdkCommand.toRangeScan(cmd.getScanType() as ScanTypePb);
      const streamConfigPb = cmd.getStreamConfig() as StreamConfigPb;
      return new SdkScanCommand(
        SdkCommand.getCollection(cmd, connection),
        rangeScan,
        cmd.getContentAs(),
        {
          streamId: streamConfigPb.getStreamId(),
          onDemand: streamConfigPb.hasOnDemand(),
          streamType: StreamTypePb.STREAM_KV_RANGE_SCAN,
        },
        initiated,
        SdkCommandKeyValueOptions.toSdkRangeScanOptions(cmd.getOptions()),
      );
      // [end]
    } else if (command.hasRemove()) {
      const cmd = command.getRemove() as RemovePb;
      return new SdkRemoveCommand(
        SdkCommand.getCollectionFromLocation(cmd, connection),
        SdkCommand.getDocId(cmd, counters),
        command.getReturnResult(),
        initiated,
        maybeAddParentSpan(
          SdkCommandKeyValueOptions.toSdkRemoveOptions(cmd.getOptions()),
          cmd.getOptions(),
          spanOwner,
        ),
      );
    } else if (command.hasReplace()) {
      const cmd = command.getReplace() as ReplacePb;
      return new SdkReplaceCommand(
        SdkCommand.getCollectionFromLocation(cmd, connection),
        SdkCommand.getDocId(cmd, counters),
        SdkCommand.toSdkContentFromContentPb(cmd.getContent()),
        command.getReturnResult(),
        initiated,
        maybeAddParentSpan(
          SdkCommandKeyValueOptions.toSdkReplaceOptions(cmd.getOptions()),
          cmd.getOptions(),
          spanOwner,
        ),
      );
    } else if (command.hasUpsert()) {
      const cmd = command.getUpsert() as UpsertPb;
      return new SdkUpsertCommand(
        SdkCommand.getCollectionFromLocation(cmd, connection),
        SdkCommand.getDocId(cmd, counters),
        SdkCommand.toSdkContentFromContentPb(cmd.getContent()),
        command.getReturnResult(),
        initiated,
        maybeAddParentSpan(
          SdkCommandKeyValueOptions.toSdkUpsertOptions(cmd.getOptions()),
          cmd.getOptions(),
          spanOwner,
        ),
      );
    } else {
      throw new Error("Invalid key value command type.");
    }
  }

  static buildKeyValueCollectionLevelCommand(
    connection: Cluster,
    command: CollectionLevelCommandPb,
    initiated: Timestamp,
    counters: Counters,
    returnResult: boolean,
    spanOwner?: ISpanOwner,
  ): ISdkCommand {
    if (command.hasBinary()) {
      const binaryCommand =
        command.getBinary() as BinaryCollectionLevelCommandPb;
      if (binaryCommand.hasAppend()) {
        const cmd = binaryCommand.getAppend() as AppendPb;
        const collection = cmd.hasLocation()
          ? SdkCommand.getCollectionFromLocation(cmd, connection)
          : SdkUtils.toCollection(
              connection,
              command.getCollection() as CollectionPb,
            );
        return new SdkBinaryAppendCommand(
          collection,
          SdkCommand.getDocId(cmd, counters),
          SdkCommand.toSdkContent(cmd.getContent()),
          returnResult,
          initiated,
          maybeAddParentSpan(
            SdkCommandKeyValueOptions.toSdkBinaryAppendOptions(
              cmd.getOptions(),
            ),
            cmd.getOptions(),
            spanOwner,
          ),
        );
      } else if (binaryCommand.hasDecrement()) {
        const cmd = binaryCommand.getDecrement() as DecrementPb;
        const collection = cmd.hasLocation()
          ? SdkCommand.getCollectionFromLocation(cmd, connection)
          : SdkUtils.toCollection(
              connection,
              command.getCollection() as CollectionPb,
            );
        // TODO: remove once Node.js SDK has delta w/in options
        const opts = cmd.getOptions() as DecrementOptionsPb;
        let delta = 1;
        if (opts && opts.hasDelta()) {
          delta = opts.getDelta() as number;
        }
        return new SdkBinaryDecrementCommand(
          collection,
          SdkCommand.getDocId(cmd, counters),
          delta,
          returnResult,
          initiated,
          maybeAddParentSpan(
            SdkCommandKeyValueOptions.toSdkBinaryDecrementOptions(opts),
            opts,
            spanOwner,
          ),
        );
      } else if (binaryCommand.hasIncrement()) {
        const cmd = binaryCommand.getIncrement() as IncrementPb;
        const collection = cmd.hasLocation()
          ? SdkCommand.getCollectionFromLocation(cmd, connection)
          : SdkUtils.toCollection(
              connection,
              command.getCollection() as CollectionPb,
            );
        // TODO: remove once Node.js SDK has delta w/in options
        const opts = cmd.getOptions() as IncrementOptionsPb;
        let delta = 1;
        if (opts && opts.hasDelta()) {
          delta = opts.getDelta() as number;
        }
        return new SdkBinaryIncrementCommand(
          collection,
          SdkCommand.getDocId(cmd, counters),
          delta,
          returnResult,
          initiated,
          maybeAddParentSpan(
            SdkCommandKeyValueOptions.toSdkBinaryIncrementOptions(opts),
            opts,
            spanOwner,
          ),
        );
      } else if (binaryCommand.hasPrepend()) {
        const cmd = binaryCommand.getPrepend() as PrependPb;
        const collection = cmd.hasLocation()
          ? SdkCommand.getCollectionFromLocation(cmd, connection)
          : SdkUtils.toCollection(
              connection,
              command.getCollection() as CollectionPb,
            );
        return new SdkBinaryPrependCommand(
          collection,
          SdkCommand.getDocId(cmd, counters),
          SdkCommand.toSdkContent(cmd.getContent()),
          returnResult,
          initiated,
          maybeAddParentSpan(
            SdkCommandKeyValueOptions.toSdkBinaryPrependOptions(
              cmd.getOptions(),
            ),
            cmd.getOptions(),
            spanOwner,
          ),
        );
      } else {
        throw new Error("Invalid key value binary command type.");
      }
    } else if (command.hasExists()) {
      const cmd = command.getExists() as ExistsPb;
      const collection = cmd.hasLocation()
        ? SdkCommand.getCollectionFromLocation(cmd, connection)
        : SdkUtils.toCollection(
            connection,
            command.getCollection() as CollectionPb,
          );
      return new SdkExistsCommand(
        collection,
        SdkCommand.getDocId(cmd, counters),
        returnResult,
        initiated,
        maybeAddParentSpan(
          SdkCommandKeyValueOptions.toSdkExistsOptions(cmd.getOptions()),
          cmd.getOptions(),
          spanOwner,
        ),
      );
    } else if (command.hasGetAllReplicas()) {
      const cmd = command.getGetAllReplicas() as GetAllReplicasPb;
      const collection = cmd.hasLocation()
        ? SdkCommand.getCollectionFromLocation(cmd, connection)
        : SdkUtils.toCollection(
            connection,
            command.getCollection() as CollectionPb,
          );
      const streamConfigPb = cmd.getStreamConfig() as StreamConfigPb;
      return new SdkGetAllReplicasCommand(
        collection,
        SdkCommand.getDocId(cmd, counters),
        {
          streamId: streamConfigPb.getStreamId(),
          onDemand: streamConfigPb.hasOnDemand(),
          streamType: StreamTypePb.STREAM_KV_GET_ALL_REPLICAS,
        },
        cmd.getContentAs(),
        maybeAddParentSpan(
          SdkCommandKeyValueOptions.toSdkGetAllReplicasOptions(
            cmd.getOptions(),
          ),
          cmd.getOptions(),
          spanOwner,
        ),
      );
    } else if (command.hasGetAndLock()) {
      const cmd = command.getGetAndLock() as GetAndLockPb;
      const collection = cmd.hasLocation()
        ? SdkCommand.getCollectionFromLocation(cmd, connection)
        : SdkUtils.toCollection(
            connection,
            command.getCollection() as CollectionPb,
          );
      const duration = cmd.getDuration() as Duration;
      return new SdkGetAndLockCommand(
        collection,
        SdkCommand.getDocId(cmd, counters),
        duration.getSeconds(),
        returnResult,
        initiated,
        cmd.getContentAs(),
        maybeAddParentSpan(
          SdkCommandKeyValueOptions.toSdkGetAndLockOptions(cmd.getOptions()),
          cmd.getOptions(),
          spanOwner,
        ),
      );
    } else if (command.hasGetAndTouch()) {
      const cmd = command.getGetAndTouch() as GetAndTouchPb;
      const collection = cmd.hasLocation()
        ? SdkCommand.getCollectionFromLocation(cmd, connection)
        : SdkUtils.toCollection(
            connection,
            command.getCollection() as CollectionPb,
          );
      const expiryPb = cmd.getExpiry() as ExpiryPb;
      return new SdkGetAndTouchCommand(
        collection,
        SdkCommand.getDocId(cmd, counters),
        expiryPb.hasAbsoluteepochsecs()
          ? expiryPb.getAbsoluteepochsecs()
          : expiryPb.getRelativesecs(),
        returnResult,
        initiated,
        cmd.getContentAs(),
        maybeAddParentSpan(
          SdkCommandKeyValueOptions.toSdkGetAndTouchOptions(cmd.getOptions()),
          cmd.getOptions(),
          spanOwner,
        ),
      );
    } else if (command.hasGetAnyReplica()) {
      const cmd = command.getGetAnyReplica() as GetAnyReplicaPb;
      const collection = cmd.hasLocation()
        ? SdkCommand.getCollectionFromLocation(cmd, connection)
        : SdkUtils.toCollection(
            connection,
            command.getCollection() as CollectionPb,
          );
      return new SdkGetAnyReplicaCommand(
        collection,
        SdkCommand.getDocId(cmd, counters),
        returnResult,
        initiated,
        cmd.getContentAs(),
        maybeAddParentSpan(
          SdkCommandKeyValueOptions.toSdkGetAnyReplicaOptions(cmd.getOptions()),
          cmd.getOptions(),
          spanOwner,
        ),
      );
    } else if (command.hasLookupIn()) {
      const cmd = command.getLookupIn() as LookupInPb;
      const collection = cmd.hasLocation()
        ? SdkCommand.getCollectionFromLocation(cmd, connection)
        : SdkUtils.toCollection(
            connection,
            command.getCollection() as CollectionPb,
          );
      return new SdkLookupInCommand(
        collection,
        SdkCommand.getDocId(cmd, counters),
        SdkKeyValueCommandBuilder.toLookupInSpecs(cmd.getSpecList()),
        returnResult,
        initiated,
        maybeAddParentSpan(
          SdkCommandKeyValueOptions.toSdkLookupInOptions(cmd.getOptions()),
          cmd.getOptions(),
          spanOwner,
        ),
      );
      // [if:4.2.7]
    } else if (command.hasLookupInAllReplicas()) {
      const cmd = command.getLookupInAllReplicas() as LookupInAllReplicasPb;
      const collection = cmd.hasLocation()
        ? SdkCommand.getCollectionFromLocation(cmd, connection)
        : SdkUtils.toCollection(
            connection,
            command.getCollection() as CollectionPb,
          );
      const streamConfigPb = cmd.getStreamConfig() as StreamConfigPb;
      return new SdkLookupInAllReplicasCommand(
        collection,
        SdkCommand.getDocId(cmd, counters),
        SdkKeyValueCommandBuilder.toLookupInSpecs(cmd.getSpecList()),
        {
          streamId: streamConfigPb.getStreamId(),
          onDemand: streamConfigPb.hasOnDemand(),
          streamType: StreamTypePb.STREAM_LOOKUP_IN_ALL_REPLICAS,
        },
        initiated,
        maybeAddParentSpan(
          SdkCommandKeyValueOptions.toSdkLookupInAllReplicasOptions(
            cmd.getOptions(),
          ),
          cmd.getOptions(),
          spanOwner,
        ),
      );
    } else if (command.hasLookupInAnyReplica()) {
      const cmd = command.getLookupInAnyReplica() as LookupInAnyReplicaPb;
      const collection = cmd.hasLocation()
        ? SdkCommand.getCollectionFromLocation(cmd, connection)
        : SdkUtils.toCollection(
            connection,
            command.getCollection() as CollectionPb,
          );
      return new SdkLookupInAnyReplicaCommand(
        collection,
        SdkCommand.getDocId(cmd, counters),
        SdkKeyValueCommandBuilder.toLookupInSpecs(cmd.getSpecList()),
        returnResult,
        initiated,
        maybeAddParentSpan(
          SdkCommandKeyValueOptions.toSdkLookupInAnyReplicaOptions(
            cmd.getOptions(),
          ),
          cmd.getOptions(),
          spanOwner,
        ),
      );
      // [end]
    } else if (command.hasMutateIn()) {
      const cmd = command.getMutateIn() as MutateInPb;
      const collection = cmd.hasLocation()
        ? SdkCommand.getCollectionFromLocation(cmd, connection)
        : SdkUtils.toCollection(
            connection,
            command.getCollection() as CollectionPb,
          );
      return new SdkMutateInCommand(
        collection,
        SdkCommand.getDocId(cmd, counters),
        SdkKeyValueCommandBuilder.toMutateInSpecs(cmd.getSpecList()),
        returnResult,
        initiated,
        maybeAddParentSpan(
          SdkCommandKeyValueOptions.toSdkMutateInOptions(cmd.getOptions()),
          cmd.getOptions(),
          spanOwner,
        ),
      );
    } else if (command.hasTouch()) {
      const cmd = command.getTouch() as TouchPb;
      const collection = cmd.hasLocation()
        ? SdkCommand.getCollectionFromLocation(cmd, connection)
        : SdkUtils.toCollection(
            connection,
            command.getCollection() as CollectionPb,
          );
      const expiryPb = cmd.getExpiry() as ExpiryPb;
      return new SdkTouchCommand(
        collection,
        SdkCommand.getDocId(cmd, counters),
        expiryPb.hasAbsoluteepochsecs()
          ? expiryPb.getAbsoluteepochsecs()
          : expiryPb.getRelativesecs(),
        returnResult,
        initiated,
        maybeAddParentSpan(
          SdkCommandKeyValueOptions.toSdkTouchOptions(cmd.getOptions()),
          cmd.getOptions(),
          spanOwner,
        ),
      );
      // [if:4.3.1]
    } else if (command.hasUnlock()) {
      const cmd = command.getUnlock() as UnlockPb;
      const collection = cmd.hasLocation()
        ? SdkCommand.getCollectionFromLocation(cmd, connection)
        : SdkUtils.toCollection(
            connection,
            command.getCollection() as CollectionPb,
          );
      return new SdkUnlockCommand(
        collection,
        SdkCommand.getDocId(cmd, counters),
        cmd.getCas(),
        initiated,
        maybeAddParentSpan(
          SdkCommandKeyValueOptions.toSdkUnlockOptions(cmd.getOptions()),
          cmd.getOptions(),
          spanOwner,
        ),
      );
      // [end]
    } else {
      throw new Error("Invalid key value command type.");
    }
  }
}
