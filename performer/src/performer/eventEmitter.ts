import { EventEmitter } from "events";

import { Result as ResultPb } from "../proto/run.top_level_pb";

import { StreamResult } from "./results/stream";

export enum RegistryEventType {
  RegisterStream = "registerStream",
  UnregisterStream = "unregisterStream",
  UnregisterExecutor = "unregisterRequestExecutor",
}

export enum StreamingEventType {
  CancelStream = "cancelStream",
  RegisterStream = "registerStream",
  RequestStreamItems = "requestStreamItems",
  StreamFinished = "streamFinished",
  StreamResult = "streamResult",
}

// TODO:  can/should we use generics?  Maybe something like for the base event map?
// type EventMap<T extends string> = { [k in T]: (...args: any[]) => void }

type EventMap = { [key: string]: (...args: any[]) => void };

type RegistryEventMap = {
  [RegistryEventType.RegisterStream]: (runId: string, streamId: string) => void;
  [RegistryEventType.UnregisterStream]: (runId: string) => void;
  [RegistryEventType.UnregisterExecutor]: (runId: string) => void;
};

type StreamingEventMap = {
  [StreamingEventType.CancelStream]: (streamId: string) => void;
  [StreamingEventType.RegisterStream]: (streamResult: StreamResult) => void;
  [StreamingEventType.RequestStreamItems]: (
    streamId: string,
    numItems: number,
  ) => void;
  [StreamingEventType.StreamFinished]: (streamId: string) => void;
  [StreamingEventType.StreamResult]: (result: ResultPb) => void;
};

interface PerformerEventEmitter<TEvents extends EventMap> {
  emit<TEventName extends keyof TEvents>(
    eventName: TEventName,
    ...args: Parameters<TEvents[TEventName]>
  ): void;
  on<TEventName extends keyof TEvents>(
    eventName: TEventName,
    handler: TEvents[TEventName],
  ): void;
}

export class RegistryEventEmitter implements PerformerEventEmitter<RegistryEventMap> {
  private _emitter = new EventEmitter();

  emit<TEventName extends keyof RegistryEventMap>(
    eventName: TEventName,
    ...args: Parameters<RegistryEventMap[TEventName]>
  ): void {
    this._emitter.emit(eventName, ...args);
  }

  on<TEventName extends keyof RegistryEventMap>(
    eventName: TEventName,
    handler: RegistryEventMap[TEventName],
  ): void {
    this._emitter.on(eventName, handler);
  }
}

export class StreamingEventEmitter implements PerformerEventEmitter<StreamingEventMap> {
  private _emitter = new EventEmitter();

  emit<TEventName extends keyof StreamingEventMap>(
    eventName: TEventName,
    ...args: Parameters<StreamingEventMap[TEventName]>
  ): void {
    this._emitter.emit(eventName, ...args);
  }

  on<TEventName extends keyof StreamingEventMap>(
    eventName: TEventName,
    handler: StreamingEventMap[TEventName],
  ): void {
    this._emitter.on(eventName, handler);
  }
}
