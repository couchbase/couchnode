import {
  CreateQueryIndexOptions as CreateQueryIndexOptionsPb,
  CreatePrimaryQueryIndexOptions as CreatePrimaryQueryIndexOptionsPb,
  DropIndexOptions as DropIndexOptionsPb,
  DropPrimaryIndexOptions as DropPrimaryIndexOptionsPb,
  GetAllQueryIndexOptions as GetAllQueryIndexOptionsPb,
  BuildDeferredIndexesOptions as BuildDeferredIndexesOptionsPb,
  WatchIndexesOptions as WatchIndexesOptionsPb,
} from "../../proto/sdk.query.index_manager.options_pb";

import {
  CreateQueryIndexOptions,
  CreatePrimaryQueryIndexOptions,
  DropQueryIndexOptions,
  DropPrimaryQueryIndexOptions,
  GetAllQueryIndexesOptions,
  BuildQueryIndexOptions,
  WatchQueryIndexOptions,
} from "couchbase";

export class SdkCommandQueryIndexMmgtOptions {
  static toCreateQueryIndexOptions(
    options?: CreateQueryIndexOptionsPb,
  ): CreateQueryIndexOptions {
    const opts: CreateQueryIndexOptions = {};
    if (!options) return opts;

    if (options.hasIgnoreIfExists()) {
      opts.ignoreIfExists = options.getIgnoreIfExists();
    }

    if (options.hasNumReplicas()) {
      opts.numReplicas = options.getNumReplicas();
    }

    if (options.hasDeferred()) {
      opts.deferred = options.getDeferred();
    }

    if (options.hasCollectionName()) {
      opts.collectionName = options.getCollectionName();
    }

    if (options.hasScopeName()) {
      opts.scopeName = options.getScopeName();
    }

    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }

    // TODO: Node.js SDK does not support spans atm
    // if(options.hasParentSpanId()) {
    //   opts.span = options.getParentSpanId();
    // }

    return opts;
  }

  static toCreatePrimaryQueryIndexOptions(
    options?: CreatePrimaryQueryIndexOptionsPb,
  ): CreatePrimaryQueryIndexOptions {
    const opts: CreatePrimaryQueryIndexOptions = {};
    if (!options) return opts;

    if (options.hasIgnoreIfExists()) {
      opts.ignoreIfExists = options.getIgnoreIfExists();
    }

    if (options.hasNumReplicas()) {
      opts.numReplicas = options.getNumReplicas();
    }

    if (options.hasDeferred()) {
      opts.deferred = options.getDeferred();
    }

    if (options.hasIndexName()) {
      opts.name = options.getIndexName();
    }

    if (options.hasCollectionName()) {
      opts.collectionName = options.getCollectionName();
    }

    if (options.hasScopeName()) {
      opts.scopeName = options.getScopeName();
    }

    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }

    // TODO: Node.js SDK does not support spans atm
    // if(options.hasParentSpanId()) {
    //   opts.span = options.getParentSpanId();
    // }

    return opts;
  }

  static toDropQueryIndexOptions(
    options?: DropIndexOptionsPb,
  ): DropQueryIndexOptions {
    const opts: DropQueryIndexOptions = {};
    if (!options) return opts;

    if (options.hasIgnoreIfNotExists()) {
      opts.ignoreIfNotExists = options.getIgnoreIfNotExists();
    }

    if (options.hasCollectionName()) {
      opts.collectionName = options.getCollectionName();
    }

    if (options.hasScopeName()) {
      opts.scopeName = options.getScopeName();
    }

    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }

    // TODO: Node.js SDK does not support spans atm
    // if(options.hasParentSpanId()) {
    //   opts.span = options.getParentSpanId();
    // }

    return opts;
  }

  static toDropPrimaryQueryIndexOptions(
    options?: DropPrimaryIndexOptionsPb,
  ): DropPrimaryQueryIndexOptions {
    const opts: DropPrimaryQueryIndexOptions = {};
    if (!options) return opts;

    if (options.hasIgnoreIfNotExists()) {
      opts.ignoreIfNotExists = options.getIgnoreIfNotExists();
    }

    if (options.hasCollectionName()) {
      opts.collectionName = options.getCollectionName();
    }

    if (options.hasScopeName()) {
      opts.scopeName = options.getScopeName();
    }

    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }

    // TODO: Node.js SDK does not support spans atm
    // if(options.hasParentSpanId()) {
    //   opts.span = options.getParentSpanId();
    // }

    return opts;
  }

  static toGetAllQueryIndexesOptions(
    options?: GetAllQueryIndexOptionsPb,
  ): GetAllQueryIndexesOptions {
    const opts: GetAllQueryIndexesOptions = {};
    if (!options) return opts;

    if (options.hasCollectionName()) {
      opts.collectionName = options.getCollectionName();
    }

    if (options.hasScopeName()) {
      opts.scopeName = options.getScopeName();
    }

    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }

    // TODO: Node.js SDK does not support spans atm
    // if(options.hasParentSpanId()) {
    //   opts.span = options.getParentSpanId();
    // }

    return opts;
  }

  static toWatchQueryIndexOptions(
    options?: WatchIndexesOptionsPb,
  ): WatchQueryIndexOptions {
    const opts: WatchQueryIndexOptions = {};
    if (!options) return opts;

    if (options.hasWatchPrimary()) {
      opts.watchPrimary = options.getWatchPrimary();
    }

    if (options.hasCollectionName()) {
      opts.collectionName = options.getCollectionName();
    }

    if (options.hasScopeName()) {
      opts.scopeName = options.getScopeName();
    }

    // TODO: Node.js SDK does not support spans atm
    // if(options.hasParentSpanId()) {
    //   opts.span = options.getParentSpanId();
    // }

    return opts;
  }

  static toBuildQueryIndexOptions(
    options?: BuildDeferredIndexesOptionsPb,
  ): BuildQueryIndexOptions {
    const opts: BuildQueryIndexOptions = {};
    if (!options) return opts;

    if (options.hasCollectionName()) {
      opts.collectionName = options.getCollectionName();
    }

    if (options.hasScopeName()) {
      opts.scopeName = options.getScopeName();
    }

    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }

    // TODO: Node.js SDK does not support spans atm
    // if(options.hasParentSpanId()) {
    //   opts.span = options.getParentSpanId();
    // }

    return opts;
  }
}
