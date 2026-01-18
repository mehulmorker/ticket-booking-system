import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Request,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ReservationsService } from "./reservations.service";
import { CreateReservationDto } from "./dto/create-reservation.dto";
import { ExtendReservationDto } from "./dto/extend-reservation.dto";

@Controller("reservations")
export class ReservationsController {
  constructor(
    private readonly reservationsService: ReservationsService,
    private readonly jwtService: JwtService
  ) {}

  @Post()
  create(@Request() req: any, @Body() dto: CreateReservationDto) {
    // Extract userId from JWT token
    let userId: string;

    if (req.user?.sub || req.user?.id) {
      // If user is already set (from guard)
      userId = req.user.sub || req.user.id;
    } else {
      // Extract from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new UnauthorizedException(
          "Missing or invalid authorization token"
        );
      }

      try {
        const token = authHeader.substring(7); // Remove "Bearer "
        const payload = this.jwtService.decode(token) as any;
        if (!payload || !payload.sub) {
          throw new UnauthorizedException("Invalid token payload");
        }
        userId = payload.sub;
      } catch (error) {
        throw new UnauthorizedException("Failed to decode token");
      }
    }

    return this.reservationsService.create(userId, dto);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.reservationsService.findOne(id);
  }

  @Get("user/:userId")
  findByUser(@Request() req: any, @Param("userId") userId: string) {
    // Extract authenticated userId from JWT token
    let authenticatedUserId: string;

    if (req.user?.sub || req.user?.id) {
      // If user is already set (from guard)
      authenticatedUserId = req.user.sub || req.user.id;
    } else {
      // Extract from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new UnauthorizedException(
          "Missing or invalid authorization token"
        );
      }

      try {
        const token = authHeader.substring(7); // Remove "Bearer "
        const payload = this.jwtService.decode(token) as any;
        if (!payload || !payload.sub) {
          throw new UnauthorizedException("Invalid token payload");
        }
        authenticatedUserId = payload.sub;
      } catch (error) {
        throw new UnauthorizedException("Failed to decode token");
      }
    }

    // Security: Only allow users to fetch their own reservations
    // Ignore the userId parameter and use the authenticated user's ID
    return this.reservationsService.findByUser(authenticatedUserId);
  }

  @Put(":id/extend")
  extend(@Body() dto: ExtendReservationDto) {
    return this.reservationsService.extend(dto);
  }

  @Delete(":id")
  cancel(@Request() req: any, @Param("id") id: string) {
    // Extract userId from JWT token
    let userId: string;

    if (req.user?.sub || req.user?.id) {
      userId = req.user.sub || req.user.id;
    } else {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new UnauthorizedException(
          "Missing or invalid authorization token"
        );
      }

      try {
        const token = authHeader.substring(7);
        const payload = this.jwtService.decode(token) as any;
        if (!payload || !payload.sub) {
          throw new UnauthorizedException("Invalid token payload");
        }
        userId = payload.sub;
      } catch (error) {
        throw new UnauthorizedException("Failed to decode token");
      }
    }

    return this.reservationsService.cancel(id, userId);
  }

  @Patch(":id/confirm")
  confirm(@Param("id") id: string) {
    return this.reservationsService.confirm(id);
  }

  @Post(":id/cancel")
  cancelReservation(@Param("id") id: string) {
    // Compensation endpoint - no userId validation required
    return this.reservationsService.cancelReservation(id);
  }
}
