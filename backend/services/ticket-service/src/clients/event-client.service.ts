import { Injectable, Logger, HttpException } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import { ServicePaths } from "../common/path-helper";

export interface Event {
  id: string;
  title: string;
  description?: string;
  category?: string;
  imageUrl?: string;
  eventDate: string;
  startTime?: string;
  endTime?: string;
  status: string;
  venue?: Venue;
  createdAt: string;
  updatedAt: string;
}

export interface Venue {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  capacity?: number;
}

@Injectable()
export class EventServiceClient {
  private readonly logger = new Logger(EventServiceClient.name);
  private readonly eventServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {
    this.eventServiceUrl =
      this.configService.get<string>("services.eventServiceUrl") ||
      "http://localhost:3002";
  }

  /**
   * Get event details by ID
   */
  async getEvent(eventId: string): Promise<Event> {
    try {
      this.logger.log(`Fetching event ${eventId}`);

      const response = await firstValueFrom(
        this.httpService.get<Event>(
          `${this.eventServiceUrl}${ServicePaths.event(`/events/${eventId}`)}`
        )
      );

      this.logger.log(`Successfully fetched event ${eventId}`);
      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to fetch event: ${error.message}`,
        error.stack
      );

      if (error.response) {
        if (error.response.status === 404) {
          throw new HttpException("Event not found", 404);
        }
        throw new HttpException(
          error.response.data?.message || "Failed to fetch event",
          error.response.status
        );
      }

      throw new HttpException("Event service unavailable", 503);
    }
  }
}

