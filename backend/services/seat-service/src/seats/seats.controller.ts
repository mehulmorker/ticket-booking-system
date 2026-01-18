import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from "@nestjs/common";
import { SeatsService } from "./seats.service";
import { LockSeatsDto } from "./dto/lock-seats.dto";
import { ReleaseSeatsDto } from "./dto/release-seats.dto";
import { ExtendLockDto } from "./dto/extend-lock.dto";
import { ReleaseSeatsCompensationDto } from "./dto/release-seats-compensation.dto";

@Controller("seats")
export class SeatsController {
  constructor(private readonly seatsService: SeatsService) {}

  @Get("event/:eventId/available")
  findAvailable(@Param("eventId") eventId: string) {
    return this.seatsService.findAvailableByEvent(eventId);
  }

  @Get("availability/:eventId")
  getAvailability(@Param("eventId") eventId: string) {
    return this.seatsService.findAvailableByEvent(eventId);
  }

  @Get("event/:eventId")
  getAllSeats(@Param("eventId") eventId: string) {
    return this.seatsService.findAllByEvent(eventId);
  }

  @Get("my-locks/:userId/event/:eventId")
  getMyLocksForEvent(
    @Param("userId") userId: string,
    @Param("eventId") eventId: string
  ) {
    return this.seatsService.findLocksByUser(userId, eventId);
  }

  @Get("my-locks/:userId")
  getMyLocks(@Param("userId") userId: string) {
    return this.seatsService.findLocksByUser(userId);
  }

  @Post("by-ids")
  getSeatsByIds(@Body() body: { eventId: string; seatIds: string[] }) {
    return this.seatsService.findSeatsByIds(body.eventId, body.seatIds);
  }

  @Post("lock")
  lockSeats(@Body() dto: LockSeatsDto) {
    return this.seatsService.lockSeats(dto);
  }

  @Post("release")
  releaseSeats(@Body() dto: ReleaseSeatsDto) {
    return this.seatsService.releaseSeats(dto);
  }

  @Patch("confirm/:eventId/:ownerId")
  confirmReservation(
    @Param("eventId") eventId: string,
    @Param("ownerId") ownerId: string,
    @Body() seatIds: string[] | string
  ) {
    // Ensure seatIds is always an array
    let seatIdsArray: string[];
    if (Array.isArray(seatIds)) {
      seatIdsArray = seatIds;
    } else if (typeof seatIds === "string") {
      // Handle case where it might come as a comma-separated string
      seatIdsArray = seatIds.split(",").map((id) => id.trim());
    } else {
      throw new BadRequestException("seatIds must be an array of seat IDs");
    }

    if (!seatIdsArray || seatIdsArray.length === 0) {
      throw new BadRequestException("At least one seat ID is required");
    }

    return this.seatsService.confirmReservation(eventId, ownerId, seatIdsArray);
  }

  @Put("extend-lock")
  extendLock(@Body() dto: ExtendLockDto) {
    return this.seatsService.extendLocks(dto);
  }

  @Post("release-compensation")
  releaseSeatsCompensation(@Body() dto: ReleaseSeatsCompensationDto) {
    return this.seatsService.releaseSeatsCompensation(dto);
  }

  @Patch("update-reservation-id")
  updateReservationId(
    @Body()
    body: {
      eventId: string;
      userId: string;
      reservationId: string;
      seatIds: string[];
    }
  ) {
    return this.seatsService.updateReservationId(
      body.eventId,
      body.userId,
      body.reservationId,
      body.seatIds
    );
  }
}
