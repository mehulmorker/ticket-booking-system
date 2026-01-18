import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { SqsService } from "../../sqs/sqs.service";
import { TicketsService } from "../tickets.service";
import { ReservationServiceClient } from "../../clients/reservation-client.service";

@Injectable()
export class TicketConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TicketConsumerService.name);
  private isRunning = false;
  private pollingInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly sqsService: SqsService,
    private readonly ticketsService: TicketsService,
    private readonly reservationServiceClient: ReservationServiceClient
  ) {}

  onModuleInit() {
    this.logger.log("Starting SQS consumer for ticket generation");
    this.startPolling();
  }

  onModuleDestroy() {
    this.stopPolling();
  }

  private startPolling() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.pollMessages();
  }

  private stopPolling() {
    this.isRunning = false;
    if (this.pollingInterval) {
      clearTimeout(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.logger.log("Stopped SQS consumer");
  }

  private async pollMessages() {
    if (!this.isRunning) {
      return;
    }

    try {
      const messages = await this.sqsService.receiveMessages(10);

      for (const message of messages) {
        if (!message.Body || !message.ReceiptHandle) {
          continue;
        }

        try {
          const messageBody = JSON.parse(message.Body);
          await this.processMessage(messageBody);

          if (message.ReceiptHandle) {
            await this.sqsService.deleteMessage(message.ReceiptHandle);
          }
        } catch (error) {
          this.logger.error(
            `Failed to process message: ${error.message}`,
            error.stack
          );
        }
      }
    } catch (error) {
      this.logger.error(`Error polling SQS: ${error.message}`, error.stack);
    }

    if (this.isRunning) {
      this.pollingInterval = setTimeout(() => this.pollMessages(), 5000);
    }
  }

  private async processMessage(messageBody: any): Promise<void> {
    if (messageBody.type !== "TICKET_GENERATION") {
      this.logger.warn(`Unknown message type: ${messageBody.type}`);
      return;
    }

    const { reservationId, paymentId, userId } = messageBody;

    if (!reservationId || !paymentId || !userId) {
      this.logger.error("Invalid message: missing required fields");
      return;
    }

    this.logger.log(
      `Processing ticket generation for payment ${paymentId}, reservation ${reservationId}`
    );

    try {
      // Fetch reservation details if eventId or seatIds are missing
      let eventId = messageBody.eventId;
      let seatIds = messageBody.seatIds;

      if (!eventId || !seatIds || seatIds.length === 0) {
        this.logger.log(
          `Fetching reservation details for ${reservationId} to get eventId and seatIds`
        );
        const reservation =
          await this.reservationServiceClient.getReservation(reservationId);
        eventId = eventId || reservation.eventId;
        seatIds = seatIds && seatIds.length > 0 ? seatIds : reservation.seatIds;
      }

      // Use generateTicketWithDetails to fetch event, seat, and reservation data
      await this.ticketsService.generateTicketWithDetails({
        reservationId,
        paymentId,
        userId,
        eventId,
        seatIds,
      });

      this.logger.log(
        `Successfully generated ticket for payment ${paymentId}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to generate ticket for payment ${paymentId}: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }
}

