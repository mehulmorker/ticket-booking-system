import { Injectable, Logger } from "@nestjs/common";
import { ISagaStep, ICompensatableStep } from "../../interfaces";
import { SeatServiceClient } from "../../../clients/seat-client.service";
import { ReservationServiceClient } from "../../../clients/reservation-client.service";

export interface ConfirmSeatsPayload {
  eventId: string;
  reservationId: string;
  seatIds: string[];
}

@Injectable()
export class ConfirmSeatsStep implements ISagaStep, ICompensatableStep {
  private readonly logger = new Logger(ConfirmSeatsStep.name);

  constructor(
    private readonly seatServiceClient: SeatServiceClient,
    private readonly reservationServiceClient: ReservationServiceClient
  ) {}

  get stepName(): string {
    return "CONFIRM_SEATS";
  }

  get stepOrder(): number {
    return 3;
  }

  async execute(payload: any): Promise<any> {
    const { eventId, reservationId, seatIds } = payload as ConfirmSeatsPayload;

    this.logger.log(
      `Executing step: ${this.stepName} for reservation ${reservationId}, seats: ${seatIds.join(", ")}`
    );

    // Get reservation to ensure we have seat IDs
    const reservation =
      await this.reservationServiceClient.getReservation(reservationId);

    const seatsToConfirm = seatIds || reservation.seatIds;

    // Confirm seats via HTTP
    await this.seatServiceClient.confirmSeats(
      eventId,
      reservationId,
      seatsToConfirm
    );

    this.logger.log(
      `Seats confirmed successfully for reservation ${reservationId}`
    );

    return {
      reservationId,
      eventId,
      seatIds: seatsToConfirm,
      confirmed: true,
    };
  }

  async compensate(payload: any, result?: any): Promise<any> {
    const { eventId, reservationId, seatIds } = payload as ConfirmSeatsPayload;

    this.logger.log(
      `Compensating step: ${this.stepName} for reservation ${reservationId}`
    );

    try {
      // Release seats (compensation)
      // Note: We'll need to add releaseSeatsCompensation method to SeatServiceClient
      await this.seatServiceClient.releaseSeatsCompensation(
        eventId,
        reservationId,
        seatIds || result?.seatIds || []
      );

      this.logger.log(
        `Seats released successfully for reservation ${reservationId} (compensated)`
      );

      return {
        compensated: true,
        reservationId,
        eventId,
        seatIds: seatIds || result?.seatIds || [],
      };
    } catch (error) {
      this.logger.error(
        `Failed to release seats for reservation ${reservationId}: ${error.message}`,
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

