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
   * Get reservation details
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

  /**
   * Validate reservation exists and is valid for payment
   */
  async validateReservation(reservationId: string): Promise<Reservation> {
    const reservation = await this.getReservation(reservationId);

    if (reservation.status !== "PENDING") {
      throw new HttpException(
        `Reservation is not pending. Current status: ${reservation.status}`,
        400
      );
    }

    const expiresAt = new Date(reservation.expiresAt);
    if (new Date() >= expiresAt) {
      throw new HttpException("Reservation has expired", 400);
    }

    return reservation;
  }

  /**
   * Confirm reservation after payment
   */
  async confirmReservation(reservationId: string): Promise<void> {
    try {
      this.logger.log(`Confirming reservation ${reservationId}`);

      await firstValueFrom(
        this.httpService.patch(
          `${this.reservationServiceUrl}${ServicePaths.reservation(`/reservations/${reservationId}/confirm`)}`
        )
      );

      this.logger.log(`Successfully confirmed reservation ${reservationId}`);
    } catch (error) {
      this.logger.error(
        `Failed to confirm reservation: ${error.message}`,
        error.stack
      );

      if (error.response) {
        throw new HttpException(
          error.response.data?.message || "Failed to confirm reservation",
          error.response.status
        );
      }

      throw new HttpException("Reservation service unavailable", 503);
    }
  }

  /**
   * Cancel reservation (compensation)
   */
  async cancelReservation(reservationId: string): Promise<void> {
    try {
      this.logger.log(`Cancelling reservation ${reservationId} (compensation)`);

      await firstValueFrom(
        this.httpService.post(
          `${this.reservationServiceUrl}${ServicePaths.reservation(`/reservations/${reservationId}/cancel`)}`
        )
      );

      this.logger.log(`Successfully cancelled reservation ${reservationId}`);
    } catch (error) {
      this.logger.error(
        `Failed to cancel reservation: ${error.message}`,
        error.stack
      );

      if (error.response) {
        throw new HttpException(
          error.response.data?.message || "Failed to cancel reservation",
          error.response.status
        );
      }

      throw new HttpException("Reservation service unavailable", 503);
    }
  }
}
