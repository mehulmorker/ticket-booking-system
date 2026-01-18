import { Injectable, Logger } from "@nestjs/common";
import { ISagaStep, ICompensatableStep } from "../../interfaces";
import { ReservationServiceClient } from "../../../clients/reservation-client.service";

export interface ConfirmReservationPayload {
  reservationId: string;
  paymentId: string;
}

@Injectable()
export class ConfirmReservationStep implements ISagaStep, ICompensatableStep {
  private readonly logger = new Logger(ConfirmReservationStep.name);

  constructor(
    private readonly reservationServiceClient: ReservationServiceClient
  ) {}

  get stepName(): string {
    return "CONFIRM_RESERVATION";
  }

  get stepOrder(): number {
    return 2;
  }

  async execute(payload: any): Promise<any> {
    const { reservationId } = payload as ConfirmReservationPayload;

    this.logger.log(
      `Executing step: ${this.stepName} for reservation ${reservationId}`
    );

    // Confirm reservation via HTTP
    await this.reservationServiceClient.confirmReservation(reservationId);

    this.logger.log(`Reservation ${reservationId} confirmed successfully`);

    return {
      reservationId,
      confirmed: true,
    };
  }

  async compensate(payload: any, result?: any): Promise<any> {
    const { reservationId } = payload as ConfirmReservationPayload;

    this.logger.log(
      `Compensating step: ${this.stepName} for reservation ${reservationId}`
    );

    try {
      // Cancel reservation (compensation)
      // Note: We'll need to add cancelReservation method to ReservationServiceClient
      // For now, we'll call the reservation service directly
      await this.reservationServiceClient.cancelReservation(reservationId);

      this.logger.log(
        `Reservation ${reservationId} cancelled successfully (compensated)`
      );

      return {
        compensated: true,
        reservationId,
      };
    } catch (error) {
      this.logger.error(
        `Failed to cancel reservation ${reservationId}: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  canRetry(error: any): boolean {
    // Retry on network errors, timeouts, or 5xx errors
    if (error.response) {
      const status = error.response.status;
      return status >= 500 || status === 408; // 5xx or timeout
    }
    // Retry on network errors
    return (
      error.code === "ECONNREFUSED" ||
      error.code === "ETIMEDOUT" ||
      error.message?.includes("timeout")
    );
  }

  getMaxRetries(): number {
    return 3;
  }

  requiresCompensation(stepStatus: string): boolean {
    return stepStatus === "COMPLETED";
  }
}

