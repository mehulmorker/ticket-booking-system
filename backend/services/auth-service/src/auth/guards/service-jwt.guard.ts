import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";

/**
 * Service JWT Guard
 * Validates service-to-service authentication tokens
 * Service tokens must have type: 'service' in payload
 */
@Injectable()
export class ServiceJwtGuard {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedException(
        "Missing or invalid authorization header"
      );
    }

    const token = authHeader.substring(7); // Remove "Bearer "

    try {
      const secret = this.configService.get<string>("jwt.secret");
      const payload = this.jwtService.verify(token, { secret });

      // Validate that this is a service token
      if (payload.type !== "service") {
        throw new UnauthorizedException(
          "Invalid token type. Service token required."
        );
      }

      // Attach service info to request
      request.service = {
        name: payload.serviceName || "unknown",
        type: payload.type,
      };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException("Invalid or expired service token");
    }
  }
}
