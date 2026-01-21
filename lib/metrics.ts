/**
 * @internal
 */

/**
 * Abstract interface for recording metric values.
 *
 * Implementations should record values that will be aggregated and tracked over time,
 * typically for latency or performance metrics.
 */
export interface ValueRecorder {
  /**
   * Records a single value.
   *
   * @param value - The value to record (typically latency in microseconds).
   */
  recordValue(value: number): void
}

/**
 * Abstract interface for creating and managing value recorders.
 *
 * Implementations should allow creating value recorders with specific names
 * and tags for organizing and categorizing metrics.
 */
export interface Meter {
  /**
   * Gets or creates a value recorder with the specified name and tags.
   *
   * @param name - The name of the recorder (typically operation name).
   * @param tags - Key-value pairs that categorize the metric (e.g., service, operation).
   * @returns {ValueRecorder} A value recorder for recording values.
   */
  valueRecorder(name: string, tags: Record<string, any>): ValueRecorder
}
