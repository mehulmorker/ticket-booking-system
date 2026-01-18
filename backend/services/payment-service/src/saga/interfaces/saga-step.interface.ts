/**
 * Interface for a saga step
 * Each step in a saga must implement this interface
 */
export interface ISagaStep {
  /**
   * Unique name of the step
   */
  stepName: string;

  /**
   * Order of execution (1, 2, 3, ...)
   */
  stepOrder: number;

  /**
   * Execute the step
   * @param payload - Input data for the step
   * @returns Result data from step execution
   */
  execute(payload: any): Promise<any>;

  /**
   * Check if step can be retried
   * @param error - Error that occurred
   * @returns True if step can be retried
   */
  canRetry(error: any): boolean;

  /**
   * Get maximum number of retries for this step
   * @returns Maximum retry count
   */
  getMaxRetries(): number;
}

