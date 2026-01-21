import {
    AttributeValue,
    SpanStatus,
    TimeInput,
  } from './observabilitytypes'

/**
 * Represents a single traced operation (span) in distributed tracing.
 *
 * A RequestSpan provides methods to add metadata (attributes), record events,
 * set the final status, and mark the completion of an operation.
 */
export interface RequestSpan {
    /**
     * The name of the span, describing the operation being traced.
     */
    readonly name: string
  
    /**
     * Sets a single attribute (key-value pair) on the span.
     *
     * @param key - The attribute key.
     * @param value - The attribute value.
     */
    setAttribute(key: string, value: AttributeValue): void
  
    /**
     * Adds a timestamped event to the span.
     *
     * @param key - The event name.
     * @param startTime - The start time of the event.
     */
    addEvent(key: string, startTime?: TimeInput): void
  
    /**
     * Sets the final status of the span.
     *
     * @param status - The span status containing code and optional message.
     */
    setStatus(status: SpanStatus): void
  
    /**
     * Marks the span as complete and records the end time.
     *
     * @param endTime - Optional end time; defaults to current time if not provided.
     */
    end(endTime?: TimeInput): void
  }

  /**
   * Interface for creating and managing distributed tracing spans.
   *
   * A RequestTracer is responsible for creating new spans to track operations.
   */
  export interface RequestTracer {
    /**
     * Creates a new span to trace an operation.
     *
     * @param name - The name of the span, describing the operation being traced.
     * @param parentSpan - Optional parent span for creating hierarchical traces.
     * @param startTime - Optional start time; defaults to current time if not provided.
     * @returns A new RequestSpan instance.
     */
    requestSpan(
      name: string,
      parentSpan?: RequestSpan,
      startTime?: TimeInput
    ): RequestSpan
  }