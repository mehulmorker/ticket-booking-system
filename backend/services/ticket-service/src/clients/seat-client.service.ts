import { Injectable, Logger, HttpException } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import { ServicePaths } from "../common/path-helper";

export interface Seat {
  id: string;
  eventId: string;
  seatNumber: string;
  rowLabel?: string;
  section?: string;
  seatType?: string;
  price: number;
  status: string;
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
   * Get seat details by IDs (regardless of status - for tickets)
   */
  async getSeats(eventId: string, seatIds: string[]): Promise<Seat[]> {
    try {
      this.logger.log(
        `Fetching seats for event ${eventId}, seats: ${seatIds.join(", ")}`
      );

      // Use the new endpoint that gets seats by IDs regardless of status
      const response = await firstValueFrom(
        this.httpService.post<Seat[]>(
          `${this.seatServiceUrl}${ServicePaths.seat("/seats/by-ids")}`,
          { eventId, seatIds }
        )
      );

      if (response.data.length !== seatIds.length) {
        this.logger.warn(
          `Some seats not found. Requested: ${seatIds.length}, Found: ${response.data.length}`
        );
      }

      this.logger.log(
        `Successfully fetched ${response.data.length} seats for event ${eventId}`
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to fetch seats: ${error.message}`,
        error.stack
      );

      if (error.response) {
        throw new HttpException(
          error.response.data?.message || "Failed to fetch seats",
          error.response.status
        );
      }

      throw new HttpException("Seat service unavailable", 503);
    }
  }
}

