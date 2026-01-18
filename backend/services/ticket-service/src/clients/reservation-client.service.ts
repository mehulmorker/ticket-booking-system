import { Injectable, Logger, HttpException } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import { ServicePaths } from "../common/path-helper";

export interface Reservation {
  id: string;
  userId: string;
  eventId: string;
  seatIds: string[];
  totalAmount: number;
  status: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class ReservationServiceClient {
  private readonly logger = new Logger(ReservationServiceClient.name);
  private readonly reservationServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {
    this.reservationServiceUrl =
      this.configService.get<string>("services.reservationServiceUrl") ||
      "http://localhost:3004";
  }

  /**
   * Get reservation details by ID
   */
  async getReservation(reservationId: string): Promise<Reservation> {
    try {
      this.logger.log(`Fetching reservation ${reservationId}`);

      const response = await firstValueFrom(
        this.httpService.get<Reservation>(
          `${this.reservationServiceUrl}${ServicePaths.reservation(`/reservations/${reservationId}`)}`
        )
      );

      this.logger.log(`Successfully fetched reservation ${reservationId}`);
      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to fetch reservation: ${error.message}`,
        error.stack
      );

      if (error.response) {
        if (error.response.status === 404) {
          throw new HttpException("Reservation not found", 404);
        }
        throw new HttpException(
          error.response.data?.message || "Failed to fetch reservation",
          error.response.status
        );
      }

      throw new HttpException("Reservation service unavailable", 503);
    }
  }
}

