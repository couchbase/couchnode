import {
  GetSearchIndexOptions as GetSearchIndexOptionsPb,
  GetAllSearchIndexesOptions as GetAllSearchIndexesOptionsPb,
  UpsertSearchIndexOptions as UpsertSearchIndexOptionsPb,
  DropSearchIndexOptions as DropSearchIndexOptionsPb,
  GetIndexedSearchIndexOptions as GetIndexedSearchIndexOptionsPb,
  PauseIngestSearchIndexOptions as PauseIngestSearchIndexOptionsPb,
  ResumeIngestSearchIndexOptions as ResumeIngestSearchIndexOptionsPb,
  AllowQueryingSearchIndexOptions as AllowQueryingSearchIndexOptionsPb,
  DisallowQueryingSearchIndexOptions as DisallowQueryingSearchIndexOptionsPb,
  FreezePlanSearchIndexOptions as FreezePlanSearchIndexOptionsPb,
  UnfreezePlanSearchIndexOptions as UnfreezePlanSearchIndexOptionsPb,
  AnalyzeDocumentOptions as AnalyzeDocumentOptionsPb,
} from "../../proto/sdk.search.index_manager_pb";

import {
  GetSearchIndexOptions,
  GetAllSearchIndexesOptions,
  UpsertSearchIndexOptions,
  DropSearchIndexOptions,
  GetSearchIndexedDocumentsCountOptions,
  PauseSearchIngestOptions,
  ResumeSearchIngestOptions,
  AllowSearchQueryingOptions,
  DisallowSearchQueryingOptions,
  FreezeSearchPlanOptions,
  UnfreezeSearchPlanOptions,
  AnalyzeSearchDocumentOptions,
} from "couchbase";

export class SdkCommandSearchIndexMmgtOptions {
  static toGetSearchIndexOptions(
    options?: GetSearchIndexOptionsPb,
  ): GetSearchIndexOptions {
    const opts: GetSearchIndexOptions = {};
    if (!options) return opts;

    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }

    // TODO: Node.js SDK does not support spans atm
    // if(options.hasParentSpanId()) {
    //   opts.span = options.getParentSpanId
    // }

    return opts;
  }

  static toGetAllSearchIndexesOptions(
    options?: GetAllSearchIndexesOptionsPb,
  ): GetAllSearchIndexesOptions {
    const opts: GetAllSearchIndexesOptions = {};
    if (!options) return opts;

    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }

    // TODO: Node.js SDK does not support spans atm
    // if(options.hasParentSpanId()) {
    //   opts.span = options.getParentSpanId
    // }

    return opts;
  }

  static toUpsertSearchIndexOptions(
    options?: UpsertSearchIndexOptionsPb,
  ): UpsertSearchIndexOptions {
    const opts: UpsertSearchIndexOptions = {};
    if (!options) return opts;

    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }

    // TODO: Node.js SDK does not support spans atm
    // if(options.hasParentSpanId()) {
    //   opts.span = options.getParentSpanId
    // }

    return opts;
  }

  static toDropSearchIndexOptions(
    options?: DropSearchIndexOptionsPb,
  ): DropSearchIndexOptions {
    const opts: DropSearchIndexOptions = {};
    if (!options) return opts;

    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }

    // TODO: Node.js SDK does not support spans atm
    // if(options.hasParentSpanId()) {
    //   opts.span = options.getParentSpanId
    // }

    return opts;
  }

  static toGetSearchIndexedDocumentsCountOptions(
    options?: GetIndexedSearchIndexOptionsPb,
  ): GetSearchIndexedDocumentsCountOptions {
    const opts: GetSearchIndexedDocumentsCountOptions = {};
    if (!options) return opts;

    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }

    // TODO: Node.js SDK does not support spans atm
    // if(options.hasParentSpanId()) {
    //   opts.span = options.getParentSpanId
    // }

    return opts;
  }

  static toPauseSearchIngestOptions(
    options?: PauseIngestSearchIndexOptionsPb,
  ): PauseSearchIngestOptions {
    const opts: PauseSearchIngestOptions = {};
    if (!options) return opts;

    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }

    // TODO: Node.js SDK does not support spans atm
    // if(options.hasParentSpanId()) {
    //   opts.span = options.getParentSpanId
    // }

    return opts;
  }

  static toResumeSearchIngestOptions(
    options?: ResumeIngestSearchIndexOptionsPb,
  ): ResumeSearchIngestOptions {
    const opts: ResumeSearchIngestOptions = {};
    if (!options) return opts;

    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }

    // TODO: Node.js SDK does not support spans atm
    // if(options.hasParentSpanId()) {
    //   opts.span = options.getParentSpanId
    // }

    return opts;
  }

  static toAllowSearchQueryingOptions(
    options?: AllowQueryingSearchIndexOptionsPb,
  ): AllowSearchQueryingOptions {
    const opts: AllowSearchQueryingOptions = {};
    if (!options) return opts;

    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }

    // TODO: Node.js SDK does not support spans atm
    // if(options.hasParentSpanId()) {
    //   opts.span = options.getParentSpanId
    // }

    return opts;
  }

  static toDisallowSearchQueryingOptions(
    options?: DisallowQueryingSearchIndexOptionsPb,
  ): DisallowSearchQueryingOptions {
    const opts: DisallowSearchQueryingOptions = {};
    if (!options) return opts;

    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }

    // TODO: Node.js SDK does not support spans atm
    // if(options.hasParentSpanId()) {
    //   opts.span = options.getParentSpanId
    // }

    return opts;
  }

  static toFreezeSearchPlanOptions(
    options?: FreezePlanSearchIndexOptionsPb,
  ): FreezeSearchPlanOptions {
    const opts: FreezeSearchPlanOptions = {};
    if (!options) return opts;

    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }

    // TODO: Node.js SDK does not support spans atm
    // if(options.hasParentSpanId()) {
    //   opts.span = options.getParentSpanId
    // }

    return opts;
  }

  static toUnfreezeSearchPlanOptions(
    options?: UnfreezePlanSearchIndexOptionsPb,
  ): UnfreezeSearchPlanOptions {
    const opts: UnfreezeSearchPlanOptions = {};
    if (!options) return opts;

    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }

    // TODO: Node.js SDK does not support spans atm
    // if(options.hasParentSpanId()) {
    //   opts.span = options.getParentSpanId
    // }

    return opts;
  }

  static toAnalyzeSearchDocumentOptions(
    options?: AnalyzeDocumentOptionsPb,
  ): AnalyzeSearchDocumentOptions {
    const opts: AnalyzeSearchDocumentOptions = {};
    if (!options) return opts;

    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }

    // TODO: Node.js SDK does not support spans atm
    // if(options.hasParentSpanId()) {
    //   opts.span = options.getParentSpanId
    // }

    return opts;
  }
}
