import { Injectable, Logger } from "@nestjs/common";
import { ISagaStep, ICompensatableStep } from "../../interfaces";
import { SqsService } from "../../../sqs/sqs.service";
import { TicketServiceClient } from "../../../clients/ticket-client.service";
import { ReservationServiceClient } from "../../../clients/reservation-client.service";

export interface GenerateTicketPayload {
  reservationId: string;
  paymentId: string;
  userId: string;
  eventId: string;
  seatIds: string[];
}

@Injectable()
export class GenerateTicketStep implements ISagaStep, ICompensatableStep {
  private readonly logger = new Logger(GenerateTicketStep.name);

  constructor(
    private readonly sqsService: SqsService,
    private readonly ticketServiceClient: TicketServiceClient,
    private readonly reservationServiceClient: ReservationServiceClient
  ) {}

  get stepName(): string {
    return "GENERATE_TICKET";
  }

  get stepOrder(): number {
    return 4;
  }

  async execute(payload: any): Promise<any> {
    const { reservationId, paymentId, userId, eventId, seatIds } =
      payload as GenerateTicketPayload;

    this.logger.log(
      `Executing step: ${this.stepName} for reservation ${reservationId}`
    );

    // Get reservation to ensure we have all data
    const reservation =
      await this.reservationServiceClient.getReservation(reservationId);

    const finalSeatIds = seatIds || reservation.seatIds;

    // Try SQS first (preferred async method)
    try {
      await this.sqsService.sendTicketGenerationMessage(
        reservationId,
        paymentId,
        userId,
        eventId,
        finalSeatIds
      );

      this.logger.log(
        `Ticket generation message sent via SQS for reservation ${reservationId}`
      );

      return {
        reservationId,
        paymentId,
        method: "SQS",
        messageSent: true,
      };
    } catch (sqsError) {
      // Fallback to direct HTTP call if SQS fails
      this.logger.warn(
        `SQS ticket generation failed, using HTTP fallback: ${sqsError.message}`
      );

      try {
        await this.ticketServiceClient.generateTicket({
          reservationId,
          paymentId,
          userId,
          eventId,
          seatIds: finalSeatIds,
        });

        this.logger.log(
          `Ticket generated via HTTP for reservation ${reservationId}`
        );

        return {
          reservationId,
          paymentId,
          method: "HTTP",
          ticketGenerated: true,
        };
      } catch (httpError) {
        this.logger.error(
          `Both SQS and HTTP ticket generation failed: ${httpError.message}`,
          httpError.stack
        );
        throw httpError;
      }
    }
  }

  async compensate(payload: any, result?: any): Promise<any> {
    const { reservationId, paymentId } = payload as GenerateTicketPayload;

    this.logger.log(
      `Compensating step: ${this.stepName} for reservation ${reservationId}`
    );

    try {
      // Delete ticket if it was generated (compensation)
      // Note: We'll need to add deleteTicketCompensation method to TicketServiceClient
      await this.ticketServiceClient.deleteTicketCompensation(reservationId);

      this.logger.log(
        `Ticket deleted successfully for reservation ${reservationId} (compensated)`
      );

      return {
        compensated: true,
        reservationId,
        paymentId,
      };
    } catch (error) {
      this.logger.error(
        `Failed to delete ticket for reservation ${reservationId}: ${error.message}`,
        error.stack
      );
      // Don't throw - ticket deletion failure is not critical
      return {
        compensated: false,
        reservationId,
        error: error.message,
      };
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

