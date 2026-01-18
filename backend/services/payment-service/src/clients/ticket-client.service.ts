import { Injectable, Logger, HttpException } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import { ServicePaths } from "../common/path-helper";

export interface GenerateTicketRequest {
  reservationId: string;
  paymentId: string;
  userId: string;
  eventId: string;
  seatIds: string[];
}

@Injectable()
export class TicketServiceClient {
  private readonly logger = new Logger(TicketServiceClient.name);
  private readonly ticketServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {
    this.ticketServiceUrl =
      this.configService.get<string>("services.ticketServiceUrl") ||
      "http://localhost:3006";
  }

  /**
   * Generate ticket directly via HTTP (fallback when SQS is not configured)
   */
  async generateTicket(request: GenerateTicketRequest): Promise<void> {
    try {
      this.logger.log(
        `Generating ticket via HTTP for payment ${request.paymentId}, reservation ${request.reservationId}`
      );

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.ticketServiceUrl}${ServicePaths.ticket("/tickets/generate")}`,
          request
        )
      );

      this.logger.log(
        `Successfully generated ticket for payment ${request.paymentId}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to generate ticket via HTTP: ${error.message}`,
        error.stack
      );

      if (error.response) {
        throw new HttpException(
          error.response.data?.message || "Failed to generate ticket",
          error.response.status
        );
      }

      throw new HttpException("Ticket service unavailable", 503);
    }
  }

  /**
   * Delete ticket (compensation)
   */
  async deleteTicketCompensation(reservationId: string): Promise<void> {
    try {
      this.logger.log(
        `Deleting ticket (compensation) for reservation ${reservationId}`
      );

      // First, get ticket by reservation ID
      const ticketsResponse = await firstValueFrom(
        this.httpService.get(
          `${this.ticketServiceUrl}${ServicePaths.ticket(`/tickets/reservation/${reservationId}`)}`
        )
      );

      const tickets = ticketsResponse.data;
      if (!tickets || tickets.length === 0) {
        this.logger.log(
          `No ticket found for reservation ${reservationId}, nothing to delete`
        );
        return;
      }

      // Delete each ticket
      for (const ticket of tickets) {
        await firstValueFrom(
          this.httpService.delete(
            `${this.ticketServiceUrl}${ServicePaths.ticket(`/tickets/${ticket.id}/compensate`)}`
          )
        );
      }

      this.logger.log(
        `Successfully deleted ticket(s) (compensation) for reservation ${reservationId}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to delete ticket (compensation): ${error.message}`,
        error.stack
      );

      if (error.response) {
        // Don't throw on 404 - ticket might not exist
        if (error.response.status === 404) {
          this.logger.log(
            `Ticket not found for reservation ${reservationId}, compensation skipped`
          );
          return;
        }
        throw new HttpException(
          error.response.data?.message || "Failed to delete ticket",
          error.response.status
        );
      }

      throw new HttpException("Ticket service unavailable", 503);
    }
  }
}
