import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";

/**
 * Utility to generate service-to-service JWT tokens
 * Services use these tokens to authenticate with other services
 */
export class ServiceJwtUtil {
  /**
   * Generate a service JWT token
   * @param jwtService - JWT service instance
   * @param configService - Config service instance
   * @param serviceName - Name of the service requesting the token
   * @returns Service JWT token
   */
  static generateServiceToken(
    jwtService: JwtService,
    configService: ConfigService,
    serviceName: string
  ): string {
    const payload = {
      type: "service",
      serviceName,
      iat: Math.floor(Date.now() / 1000),
    };

    const secret = configService.get<string>("jwt.secret");
    if (!secret) {
      throw new Error("JWT_SECRET not configured");
    }

    // Service tokens expire in 1 hour (longer than user tokens for service-to-service calls)
    return jwtService.sign(payload, {
      secret,
      expiresIn: "1h",
    });
  }
}
