import { Injectable, Logger, HttpException } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import { ServicePaths } from "../common/path-helper";

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
   * Release seats (compensation)
   */
  async releaseSeatsCompensation(
    eventId: string,
    ownerId: string,
    seatIds: string[]
  ): Promise<void> {
    try {
      this.logger.log(
        `Releasing seats (compensation) for event ${eventId}, owner ${ownerId}, seats: ${seatIds.join(", ")}`
      );

      await firstValueFrom(
        this.httpService.post(
          `${this.seatServiceUrl}${ServicePaths.seat("/seats/release-compensation")}`,
          {
            eventId,
            ownerId,
            seatIds,
          }
        )
      );

      this.logger.log(
        `Successfully released seats (compensation) for owner ${ownerId}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to release seats (compensation): ${error.message}`,
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
}
