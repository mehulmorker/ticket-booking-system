import { Injectable, Logger, HttpException } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { firstValueFrom } from "rxjs";
import { ServiceJwtUtil } from "../common/service-jwt.util";

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
}

@Injectable()
export class AuthServiceClient {
  private readonly logger = new Logger(AuthServiceClient.name);
  private readonly authServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService
  ) {
    this.authServiceUrl =
      this.configService.get<string>("services.authServiceUrl") ||
      "http://localhost:3001";
  }

  /**
   * Get user details by ID using service-to-service authentication
   * Uses service JWT token to authenticate with auth service
   */
  async getUserById(userId: string): Promise<User | null> {
    try {
      this.logger.log(`Fetching user ${userId} from auth service`);

      // Generate service JWT token
      const serviceToken = ServiceJwtUtil.generateServiceToken(
        this.jwtService,
        this.configService,
        "ticket-service"
      );

      // Call auth service endpoint (no /api prefix for auth service)
      const response = await firstValueFrom(
        this.httpService.get<User>(`${this.authServiceUrl}/users/${userId}`, {
          headers: {
            Authorization: `Bearer ${serviceToken}`,
          },
        })
      );

      this.logger.log(`Successfully fetched user ${userId} from auth service`);
      return response.data;
    } catch (error) {
      this.logger.warn(
        `Failed to fetch user ${userId}: ${error.message}. Notification will be skipped.`
      );

      // Return null if user not found or service unavailable
      // This allows ticket generation to continue even if user lookup fails
      return null;
    }
  }
}
