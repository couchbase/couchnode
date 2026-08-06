import { Timestamp } from "google-protobuf/google/protobuf/timestamp_pb";
import {
  BucketLevelCommand as BucketLevelCommandPb,
  Command as SdkCommandPb,
  CollectionLevelCommand as CollectionLevelCommandPb,
  ClusterLevelCommand as ClusterLevelCommandPb,
  ScopeLevelCommand as ScopeLevelCommandPb,
} from "../../proto/sdk.workload_pb";
import { Collection as CollectionPb } from "../../proto/shared.collection_pb";

import CommandCase = SdkCommandPb.CommandCase;
import CollectionCommandCase = CollectionLevelCommandPb.CommandCase;
import ScopeCommandCase = ScopeLevelCommandPb.CommandCase;
import ClusterCommandCase = ClusterLevelCommandPb.CommandCase;

import { ISdkCommand } from "./command";
import { SdkAuthCommand } from "./authCommand";
import { SdkBucketMgmtCommand } from "./bucketMgmtCommand";
import { SdkCollectionMgmtCommand } from "./collectionMgmtCommand";
import { SdkKeyValueCommandBuilder } from "./keyValueCommand";

import { SdkQueryCommand } from "./queryCommand";
import { SdkQueryIndexMgmtCommand } from "./queryIndexMgmtCommand";
import { Connection } from "../registry";
import { SdkSearchCommand } from "./searchCommand";
import { SdkSearchIndexMgmtCommand } from "./searchIndexMgmtCommand";
import { SdkUtils } from "../utils";
import { NotImplementedError } from "../error";
import { Counters } from "../bounds";
import { ISpanOwner } from "../observability/observabilityTypes";

export class CommandBuilder {
  static keyValueCommands = [
    CommandCase.GET,
    CommandCase.INSERT,
    CommandCase.RANGE_SCAN,
    CommandCase.REMOVE,
    CommandCase.REPLACE,
    CommandCase.UPSERT,
  ];

  static collectionLevelKeyValueCommands = [
    CollectionCommandCase.BINARY,
    CollectionCommandCase.EXISTS,
    CollectionCommandCase.GET_ALL_REPLICAS,
    CollectionCommandCase.GET_AND_LOCK,
    CollectionCommandCase.GET_AND_TOUCH,
    CollectionCommandCase.GET_ANY_REPLICA,
    CollectionCommandCase.LOOKUP_IN,
    CollectionCommandCase.LOOKUP_IN_ALL_REPLICAS,
    CollectionCommandCase.LOOKUP_IN_ANY_REPLICA,
    CollectionCommandCase.MUTATE_IN,
    CollectionCommandCase.TOUCH,
    CollectionCommandCase.UNLOCK,
  ];

  static streamingHTTPCommands = [
    ClusterCommandCase.SEARCH,
    ClusterCommandCase.SEARCH_V2,
    ClusterCommandCase.QUERY,
    ScopeCommandCase.SEARCH,
    ScopeCommandCase.SEARCH_V2,
    ScopeCommandCase.QUERY,
  ];

  static isStreamingHTTPComand(command: SdkCommandPb): boolean {
    if (command.hasClusterCommand()) {
      const clusterCommand =
        command.getClusterCommand() as ClusterLevelCommandPb;
      return this.streamingHTTPCommands.includes(
        clusterCommand.getCommandCase(),
      );
    } else if (command.hasScopeCommand()) {
      const scopeCommand = command.getScopeCommand() as ScopeLevelCommandPb;
      return this.streamingHTTPCommands.includes(scopeCommand.getCommandCase());
    }
    return false;
  }

  static buildSdkCommand(
    command: SdkCommandPb,
    counters: Counters,
    connection: Connection,
    initiated: Timestamp,
    spanOwner?: ISpanOwner,
  ): ISdkCommand {
    if (CommandBuilder.keyValueCommands.includes(command.getCommandCase())) {
      return SdkKeyValueCommandBuilder.buildKeyValueClusterLevelCommand(
        connection.cluster,
        command,
        initiated,
        counters,
        spanOwner,
      );
    } else if (command.hasClusterCommand()) {
      const clusterCommand =
        command.getClusterCommand() as ClusterLevelCommandPb;
      if (clusterCommand.hasBucketManager()) {
        return SdkBucketMgmtCommand.buildCommand(
          clusterCommand,
          connection.cluster,
          initiated,
          command.getReturnResult(),
          spanOwner,
        );
      } else if (clusterCommand.hasQuery()) {
        return SdkQueryCommand.buildCommand(
          clusterCommand,
          connection.cluster,
          initiated,
          command.getReturnResult(),
          spanOwner,
        );
      } else if (clusterCommand.hasSearch()) {
        return SdkSearchCommand.buildCommand(
          clusterCommand,
          connection.cluster,
          initiated,
          spanOwner,
        );
      } else if (clusterCommand.hasQueryIndexManager()) {
        return SdkQueryIndexMgmtCommand.buildCommand(
          clusterCommand,
          connection.cluster,
          initiated,
          spanOwner,
        );
      } else if (clusterCommand.hasSearchIndexManager()) {
        return SdkSearchIndexMgmtCommand.buildCommand(
          clusterCommand,
          connection.cluster,
          initiated,
          spanOwner,
        );
        // [if:4.2.10]
      } else if (clusterCommand.hasSearchV2()) {
        return SdkSearchCommand.buildCommandV2(
          clusterCommand,
          connection.cluster,
          initiated,
          spanOwner,
        );
        // [end]
        // [if:4.7.0]
      } else if (clusterCommand.hasAuthenticator()) {
        return SdkAuthCommand.buildCommand(
          clusterCommand,
          connection.cluster,
          initiated,
        );
        // [end]
      } else {
        throw new NotImplementedError("Unimplemented cluster command.");
      }
    } else if (command.hasBucketCommand()) {
      const bucketCommand = command.getBucketCommand() as BucketLevelCommandPb;
      const bucket = connection.cluster.bucket(bucketCommand.getBucketName());
      if (bucketCommand.hasCollectionManager()) {
        return SdkCollectionMgmtCommand.buildCommand(
          bucketCommand,
          bucket,
          initiated,
          command.getReturnResult(),
          spanOwner,
        );
      } else {
        throw new NotImplementedError("Unimplemented bucket command.");
      }
    } else if (command.hasScopeCommand()) {
      const scopeCommand = command.getScopeCommand() as ScopeLevelCommandPb;
      if (scopeCommand.hasSearch()) {
        throw new NotImplementedError(
          "searchQuery() is only implemented on the cluster level.",
        );
      } else if (scopeCommand.hasQuery()) {
        return SdkQueryCommand.buildCommand(
          scopeCommand,
          connection.cluster,
          initiated,
          command.getReturnResult(),
          spanOwner,
        );
        // [if:4.2.11]
      } else if (scopeCommand.hasSearchV2()) {
        return SdkSearchCommand.buildCommandV2(
          scopeCommand,
          connection.cluster,
          initiated,
          spanOwner,
        );
      } else if (scopeCommand.hasSearchIndexManager()) {
        return SdkSearchIndexMgmtCommand.buildCommand(
          scopeCommand,
          connection.cluster,
          initiated,
          spanOwner,
        );
        // [end]
      } else {
        throw new NotImplementedError("Unimplemented scope command.");
      }
    } else if (command.hasCollectionCommand()) {
      const collectionCommand =
        command.getCollectionCommand() as CollectionLevelCommandPb;

      if (
        CommandBuilder.collectionLevelKeyValueCommands.includes(
          collectionCommand.getCommandCase(),
        )
      ) {
        return SdkKeyValueCommandBuilder.buildKeyValueCollectionLevelCommand(
          connection.cluster,
          collectionCommand,
          initiated,
          counters,
          command.getReturnResult(),
          spanOwner,
        );
        // [if:4.2.2]
      } else if (collectionCommand.hasQueryIndexManager()) {
        const collection = SdkUtils.toCollection(
          connection.cluster,
          collectionCommand.getCollection() as CollectionPb,
        );

        return SdkQueryIndexMgmtCommand.buildCommand(
          collectionCommand,
          collection,
          initiated,
          spanOwner,
        );
        // [end]
      } else {
        throw new NotImplementedError("Unimplemented collection command.");
      }
    } else {
      throw new NotImplementedError("Unimplemented command.");
    }
  }
}
