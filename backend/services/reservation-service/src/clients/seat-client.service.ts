import { Injectable, Logger, HttpException } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import { ServicePaths } from "../common/path-helper";

export interface LockSeatsRequest {
  eventId: string;
  ownerId: string;
  seats: string[];
}

export interface ReleaseSeatsRequest {
  eventId: string;
  ownerId: string;
  seats: string[];
}

export interface LockSeatsResponse {
  success: boolean;
  lockedSeatIds: string[];
  ownerId: string;
  eventId: string;
  expiresAt: string;
}

@Injectable()
export class SeatServiceClient {
  private readonly logger = new Logger(SeatServiceClient.name);
  private readonly seatServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {
    this.seatServiceUrl =
      this.configService.get<string>("services.seatServiceUrl") ||
      "http://localhost:3003";
  }

  /**
   * Lock seats for a reservation
   */
  async lockSeats(
    eventId: string,
    ownerId: string,
    seatIds: string[]
  ): Promise<LockSeatsResponse> {
    try {
      const payload: LockSeatsRequest = {
        eventId,
        ownerId,
        seats: seatIds,
      };

      this.logger.log(
        `Locking seats for event ${eventId}, owner ${ownerId}, seats: ${seatIds.join(", ")}`
      );

      const response = await firstValueFrom(
        this.httpService.post<LockSeatsResponse>(
          `${this.seatServiceUrl}${ServicePaths.seat("/seats/lock")}`,
          payload
        )
      );

      this.logger.log(`Successfully locked seats for reservation ${ownerId}`);

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to lock seats: ${error.message}`, error.stack);

      if (error.response) {
        throw new HttpException(
          error.response.data?.message || "Failed to lock seats",
          error.response.status
        );
      }

      throw new HttpException("Seat service unavailable", 503);
    }
  }

  /**
   * Release locked seats
   */
  async releaseSeats(
    eventId: string,
    ownerId: string,
    seatIds: string[]
  ): Promise<void> {
    try {
      const payload: ReleaseSeatsRequest = {
        eventId,
        ownerId,
        seats: seatIds,
      };

      this.logger.log(
        `Releasing seats for event ${eventId}, owner ${ownerId}, seats: ${seatIds.join(", ")}`
      );

      await firstValueFrom(
        this.httpService.post(
          `${this.seatServiceUrl}${ServicePaths.seat("/seats/release")}`,
          payload
        )
      );

      this.logger.log(`Successfully released seats for reservation ${ownerId}`);
    } catch (error) {
      this.logger.error(
        `Failed to release seats: ${error.message}`,
        error.stack
      );

      if (error.response) {
        throw new HttpException(
          error.response.data?.message || "Failed to release seats",
          error.response.status
        );
      }

      throw new HttpException("Seat service unavailable", 503);
    }
  }

  /**
   * Confirm seats after payment (mark as sold)
   */
  async confirmSeats(
    eventId: string,
    ownerId: string,
    seatIds: string[]
  ): Promise<void> {
    try {
      this.logger.log(
        `Confirming seats for event ${eventId}, owner ${ownerId}, seats: ${seatIds.join(", ")}`
      );

      await firstValueFrom(
        this.httpService.patch(
          `${this.seatServiceUrl}${ServicePaths.seat(`/seats/confirm/${eventId}/${ownerId}`)}`,
          seatIds
        )
      );

      this.logger.log(
        `Successfully confirmed seats for reservation ${ownerId}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to confirm seats: ${error.message}`,
        error.stack
      );

      if (error.response) {
        throw new HttpException(
          error.response.data?.message || "Failed to confirm seats",
          error.response.status
        );
      }

      throw new HttpException("Seat service unavailable", 503);
    }
  }

  /**
   * Validate seats are available or locked by the user
   */
  async validateSeats(
    eventId: string,
    seatIds: string[],
    userId?: string
  ): Promise<boolean> {
    try {
      this.logger.log(
        `Validating seats for event ${eventId}, seats: ${seatIds.join(", ")}, userId: ${userId || "none"}`
      );

      // Get seats by IDs to check their actual status
      const seatsResponse = await firstValueFrom(
        this.httpService.post<
          Array<{
            id: string;
            status: string;
            lockedBy?: string;
            reservationId?: string | null;
          }>
        >(`${this.seatServiceUrl}${ServicePaths.seat("/seats/by-ids")}`, {
          eventId,
          seatIds,
        })
      );

      const seats = seatsResponse.data;

      // Check if all requested seats exist
      if (seats.length !== seatIds.length) {
        this.logger.warn(
          `Not all seats found. Requested: ${seatIds.length}, Found: ${seats.length}`
        );
        return false;
      }

      // Validate each seat:
      // 1. Must be AVAILABLE or LOCKED by the current user
      // 2. Must NOT be RESERVED (already sold)
      // 3. Must NOT have a reservationId (already reserved by another reservation)
      const allSeatsValid = seats.every((seat) => {
        // Reject if seat is RESERVED (already sold)
        if (seat.status === "RESERVED") {
          this.logger.warn(
            `Seat ${seat.id} is RESERVED (already sold), cannot create reservation`
          );
          return false;
        }

        // Reject if seat already has a reservationId (already reserved)
        if (seat.reservationId) {
          this.logger.warn(
            `Seat ${seat.id} already has reservationId ${seat.reservationId}, cannot create duplicate reservation`
          );
          return false;
        }

        // Allow if seat is AVAILABLE
        if (seat.status === "AVAILABLE") {
          return true;
        }

        // Allow if seat is LOCKED by the current user (and no reservationId)
        if (seat.status === "LOCKED" && userId && seat.lockedBy === userId) {
          return true;
        }

        // Reject all other cases
        return false;
      });

      this.logger.log(
        `Seat validation result: ${allSeatsValid ? "valid" : "invalid"}`
      );

      return allSeatsValid;
    } catch (error) {
      this.logger.error(
        `Failed to validate seats: ${error.message}`,
        error.stack
      );

      if (error.response) {
        throw new HttpException(
          error.response.data?.message || "Failed to validate seats",
          error.response.status
        );
      }

      throw new HttpException("Seat service unavailable", 503);
    }
  }

  /**
   * Update reservationId for seats when reservation is created
   */
  async updateReservationId(
    eventId: string,
    userId: string,
    reservationId: string,
    seatIds: string[]
  ): Promise<void> {
    try {
      this.logger.log(
        `Updating reservationId for seats: event ${eventId}, user ${userId}, reservation ${reservationId}, seats: ${seatIds.join(", ")}`
      );

      await firstValueFrom(
        this.httpService.patch(
          `${this.seatServiceUrl}${ServicePaths.seat("/seats/update-reservation-id")}`,
          {
            eventId,
            userId,
            reservationId,
            seatIds,
          }
        )
      );

      this.logger.log(
        `Successfully updated reservationId for reservation ${reservationId}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to update reservationId: ${error.message}`,
        error.stack
      );

      if (error.response) {
        throw new HttpException(
          error.response.data?.message || "Failed to update reservationId",
          error.response.status
        );
      }

      throw new HttpException("Seat service unavailable", 503);
    }
  }
}
