import { ISagaStep } from "./saga-step.interface";

/**
 * Interface for a compensatable saga step
 * Steps that can be rolled back must implement this interface
 */
export interface ICompensatableStep extends ISagaStep {
  /**
   * Compensate (rollback) the step
   * @param payload - Original execution payload
   * @param result - Result from step execution (if available)
   * @returns Compensation result
   */
  compensate(payload: any, result?: any): Promise<any>;

  /**
   * Check if compensation is required
   * @param stepStatus - Current status of the step
   * @returns True if compensation is needed
   */
  requiresCompensation(stepStatus: string): boolean;
}

