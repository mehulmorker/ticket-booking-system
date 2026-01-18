import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { Seat } from "./entities/seat.entity";
import { LockSeatsDto } from "./dto/lock-seats.dto";
import { ReleaseSeatsDto } from "./dto/release-seats.dto";
import { ExtendLockDto } from "./dto/extend-lock.dto";
import { ReleaseSeatsCompensationDto } from "./dto/release-seats-compensation.dto";
import { RedisService } from "../redis/redis.service";

@Injectable()
export class SeatsService {
  private readonly logger = new Logger(SeatsService.name);

  constructor(
    @InjectRepository(Seat)
    private readonly seatRepository: Repository<Seat>,
    private readonly redisService: RedisService
  ) {}

  async findAvailableByEvent(eventId: string): Promise<Seat[]> {
    return this.seatRepository.find({
      where: { eventId, status: "AVAILABLE" },
      order: { rowLabel: "ASC", seatNumber: "ASC" },
    });
  }

  /**
   * Get all seats locked by a specific user
   * Used to restore lock state when user returns to seat selection page
   * Only returns seats with valid (non-expired) locks
   */
  async findLocksByUser(userId: string, eventId?: string): Promise<Seat[]> {
    const now = new Date();
    const queryBuilder = this.seatRepository
      .createQueryBuilder("seat")
      .where("seat.status = :status", { status: "LOCKED" })
      .andWhere("seat.lockedBy = :userId", { userId })
      .andWhere("seat.lockExpiresAt > :now", { now })
      .orderBy("seat.eventId", "ASC")
      .addOrderBy("seat.rowLabel", "ASC")
      .addOrderBy("seat.seatNumber", "ASC");

    if (eventId) {
      queryBuilder.andWhere("seat.eventId = :eventId", { eventId });
    }

    return queryBuilder.getMany();
  }

  async findAllByEvent(eventId: string): Promise<Seat[]> {
    return this.seatRepository.find({
      where: { eventId },
      order: { rowLabel: "ASC", seatNumber: "ASC" },
    });
  }

  async findSeatsByIds(eventId: string, seatIds: string[]): Promise<Seat[]> {
    return this.seatRepository.find({
      where: { id: In(seatIds), eventId },
      order: { rowLabel: "ASC", seatNumber: "ASC" },
    });
  }

  async lockSeats(dto: LockSeatsDto) {
    const { eventId, ownerId, seats, ttlSeconds } = dto;

    const seatEntities = await this.seatRepository.find({
      where: { id: In(seats), eventId },
      order: { rowLabel: "ASC", seatNumber: "ASC" },
    });

    if (seatEntities.length !== seats.length) {
      throw new NotFoundException("One or more seats not found for this event");
    }

    const now = new Date();
    // Use provided ttlSeconds or default to 5 minutes (300 seconds)
    const lockDurationMs = 1000 * (ttlSeconds || 300);
    const lockExpiresAt = new Date(now.getTime() + lockDurationMs);

    // Check for seats already locked by this user
    const alreadyLockedByUser: string[] = [];
    const needsLocking: Seat[] = [];
    const lockedByOthers: Seat[] = [];
    const notAvailable: Seat[] = [];

    for (const seat of seatEntities) {
      if (seat.status === "LOCKED" && seat.lockedBy === ownerId) {
        // Already locked by this user - extend lock instead
        alreadyLockedByUser.push(seat.id);
      } else if (seat.status === "LOCKED" && seat.lockedBy !== ownerId) {
        // Locked by another user
        lockedByOthers.push(seat);
      } else if (seat.status !== "AVAILABLE") {
        // Reserved or sold
        notAvailable.push(seat);
      } else {
        // Available - needs locking
        needsLocking.push(seat);
      }
    }

    // If any seats are locked by others or not available, throw error
    if (lockedByOthers.length > 0 || notAvailable.length > 0) {
      throw new BadRequestException("One or more seats are not available");
    }

    // If all seats are already locked by this user, extend locks and return success
    if (
      alreadyLockedByUser.length === seats.length &&
      needsLocking.length === 0
    ) {
      // Extend locks for all seats
      for (const seatId of alreadyLockedByUser) {
        const key = `seat-lock:${seatId}`;
        await this.redisService.extendLock(key, ownerId, ttlSeconds);
      }

      await this.seatRepository.update(
        { id: In(alreadyLockedByUser), eventId, lockedBy: ownerId },
        {
          lockExpiresAt,
        }
      );

      return {
        success: true,
        lockedSeatIds: seats,
        ownerId,
        eventId,
        expiresAt: lockExpiresAt.toISOString(),
        alreadyLocked: true, // Indicate these were already locked
      };
    }

    // Lock new seats
    for (const seat of needsLocking) {
      const key = `seat-lock:${seat.id}`;
      // Pass ttlSeconds to Redis if provided, otherwise use default
      const acquired = await this.redisService.acquireLock(
        key,
        ownerId,
        ttlSeconds
      );

      if (!acquired) {
        throw new BadRequestException(
          "Failed to acquire lock for one or more seats"
        );
      }
    }

    // Update database for new locks
    if (needsLocking.length > 0) {
      await this.seatRepository.update(
        { id: In(needsLocking.map((s) => s.id)) },
        {
          status: "LOCKED",
          lockedBy: ownerId,
          reservationId: null, // No reservation yet when user locks
          lockedAt: now,
          lockExpiresAt,
        }
      );
    }

    // Extend locks for already locked seats
    if (alreadyLockedByUser.length > 0) {
      for (const seatId of alreadyLockedByUser) {
        const key = `seat-lock:${seatId}`;
        await this.redisService.extendLock(key, ownerId, ttlSeconds);
      }

      await this.seatRepository.update(
        { id: In(alreadyLockedByUser), eventId, lockedBy: ownerId },
        {
          lockExpiresAt,
        }
      );
    }

    return {
      success: true,
      lockedSeatIds: seats,
      ownerId,
      eventId,
      expiresAt: lockExpiresAt.toISOString(),
      alreadyLocked: alreadyLockedByUser.length > 0,
    };
  }

  async releaseSeats(dto: ReleaseSeatsDto) {
    const { eventId, ownerId, seats } = dto;

    const seatEntities = await this.seatRepository.find({
      where: { id: In(seats), eventId },
    });

    if (seatEntities.length !== seats.length) {
      throw new NotFoundException("One or more seats not found for this event");
    }

    for (const seat of seatEntities) {
      const key = `seat-lock:${seat.id}`;
      await this.redisService.releaseLock(key, ownerId);
    }

    await this.seatRepository.update(
      { id: In(seats), eventId, lockedBy: ownerId },
      {
        status: "AVAILABLE",
        lockedBy: null,
        reservationId: null, // Clear reservationId when releasing
        lockedAt: null,
        lockExpiresAt: null,
      }
    );

    return {
      success: true,
      releasedSeatIds: seats,
      ownerId,
      eventId,
    };
  }

  async confirmReservation(
    eventId: string,
    ownerId: string, // This is actually reservationId when called from saga/payment
    seatIds: string[]
  ) {
    // Find seats by eventId and seatIds first
    const seatEntities = await this.seatRepository.find({
      where: { id: In(seatIds), eventId },
    });

    if (seatEntities.length !== seatIds.length) {
      throw new NotFoundException("One or more seats not found for this event");
    }

    // Validate seats are locked
    const notLocked = seatEntities.some(
      (s) => s.status !== "LOCKED" || !s.lockedBy
    );

    if (notLocked) {
      throw new BadRequestException("Seats are not locked");
    }

    // Validate reservationId if it exists (for new reservations)
    // If reservationId is null (old reservations), we'll validate by lockedBy only
    const seatsWithReservationId = seatEntities.filter((s) => s.reservationId);
    if (seatsWithReservationId.length > 0) {
      // Some seats have reservationId - validate they all match
      const wrongReservation = seatsWithReservationId.some(
        (s) => s.reservationId !== ownerId
      );
      if (wrongReservation) {
        throw new BadRequestException(
          "Seats do not belong to this reservation"
        );
      }
    }
    // If no seats have reservationId (old reservation), we'll proceed with lockedBy validation only

    // Get userId from first seat's lockedBy (all seats should have same userId)
    const userId = seatEntities[0].lockedBy;
    if (!userId) {
      throw new BadRequestException("Seats are not locked");
    }

    // Validate all seats are locked by the same user
    const differentUsers = seatEntities.some((s) => s.lockedBy !== userId);
    if (differentUsers) {
      throw new BadRequestException("Seats are locked by different users");
    }

    // Idempotency check: If ALL seats are already RESERVED, return success
    // This handles the case where seats were confirmed in a previous attempt
    const allReserved = seatEntities.every((s) => s.status === "RESERVED");
    if (allReserved) {
      this.logger.log(
        `All seats are already RESERVED, skipping confirmation (idempotent operation)`
      );
      return {
        success: true,
        reservedSeatIds: seatIds,
        ownerId,
        eventId,
        alreadyReserved: true,
      };
    }

    // If some seats are RESERVED but not all, that's an error state
    const someReserved = seatEntities.some((s) => s.status === "RESERVED");
    if (someReserved) {
      throw new BadRequestException(
        "Some seats are already RESERVED while others are not - inconsistent state"
      );
    }

    // Update seats - use reservationId in where clause only if seats have it set
    // This handles both old reservations (no reservationId) and new ones (with reservationId)
    // Also ensure seats are still LOCKED (prevent race conditions)
    const updateWhere: any = { id: In(seatIds), eventId, status: "LOCKED" };
    const hasReservationId = seatsWithReservationId.length > 0;
    if (hasReservationId) {
      // If seats have reservationId, include it in where clause for safety
      updateWhere.reservationId = ownerId;
    }

    const updateResult = await this.seatRepository.update(updateWhere, {
      status: "RESERVED",
      lockedBy: null,
      reservationId: null, // Clear reservationId when confirming
      lockedAt: null,
      lockExpiresAt: null,
    });

    // Verify update actually affected rows (prevent silent failures)
    if (updateResult.affected === 0) {
      throw new BadRequestException(
        "Failed to confirm seats - seats may have been modified by another process"
      );
    }

    // Release Redis locks using userId (not reservationId)
    for (const seat of seatEntities) {
      const key = `seat-lock:${seat.id}`;
      await this.redisService.releaseLock(key, userId);
    }

    return {
      success: true,
      reservedSeatIds: seatIds,
      ownerId,
      eventId,
    };
  }

  async extendLocks(dto: ExtendLockDto) {
    const { eventId, ownerId, seats, ttlSeconds } = dto;

    const seatEntities = await this.seatRepository.find({
      where: { id: In(seats), eventId },
    });

    if (seatEntities.length !== seats.length) {
      throw new NotFoundException("One or more seats not found for this event");
    }

    const invalidSeats = seatEntities.some(
      (s) => s.status !== "LOCKED" || s.lockedBy !== ownerId
    );

    if (invalidSeats) {
      throw new BadRequestException("Seats are not locked by this owner");
    }

    const now = new Date();
    const extensionMs = 1000 * (ttlSeconds || 300);
    const newExpiry = new Date(now.getTime() + extensionMs);

    for (const seat of seatEntities) {
      const key = `seat-lock:${seat.id}`;
      const extended = await this.redisService.extendLock(
        key,
        ownerId,
        ttlSeconds
      );
      if (!extended) {
        throw new BadRequestException(
          "Failed to extend lock for one or more seats"
        );
      }
    }

    await this.seatRepository.update(
      { id: In(seats), eventId, lockedBy: ownerId },
      {
        lockExpiresAt: newExpiry,
      }
    );

    return {
      success: true,
      extendedSeatIds: seats,
      ownerId,
      eventId,
      expiresAt: newExpiry.toISOString(),
    };
  }

  /**
   * Release seats (compensation for saga)
   * This method releases seats by reservationId
   * Used for saga compensation when seats need to be released after payment failure
   */
  async releaseSeatsCompensation(dto: ReleaseSeatsCompensationDto) {
    const { eventId, ownerId, seatIds } = dto;

    this.logger.log(
      `Releasing seats (compensation) for event ${eventId}, reservation ${ownerId}, seats: ${seatIds.join(", ")}`
    );

    // Find seats by reservationId OR if they're RESERVED (compensation needs to handle both)
    // ownerId is actually reservationId in compensation context
    const seatEntities = await this.seatRepository
      .createQueryBuilder("seat")
      .where("seat.id IN (:...seatIds)", { seatIds })
      .andWhere("seat.eventId = :eventId", { eventId })
      .andWhere("(seat.reservationId = :ownerId OR seat.status = 'RESERVED')", {
        ownerId,
      })
      .getMany();

    if (seatEntities.length === 0) {
      this.logger.warn(
        `No seats found for reservation ${ownerId} in event ${eventId}. They may have already been released.`
      );
      // Return success anyway - idempotent operation
      return {
        success: true,
        releasedSeatIds: [],
        ownerId,
        eventId,
        compensation: true,
      };
    }

    // Release Redis locks (best effort) - use lockedBy from seat entity
    for (const seat of seatEntities) {
      try {
        if (seat.lockedBy) {
          const key = `seat-lock:${seat.id}`;
          await this.redisService.releaseLock(key, seat.lockedBy);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to release Redis lock for seat ${seat.id}: ${error.message}`
        );
        // Continue - lock may have already expired
      }
    }

    // Update database - release seats by reservationId OR if they're RESERVED
    // This is compensation, so we're more lenient - release even if RESERVED
    // Use OR condition to handle both LOCKED and RESERVED seats
    const updateResult = await this.seatRepository
      .createQueryBuilder()
      .update(Seat)
      .set({
        status: "AVAILABLE",
        lockedBy: null,
        reservationId: null,
        lockedAt: null,
        lockExpiresAt: null,
      })
      .where("id IN (:...seatIds)", { seatIds })
      .andWhere("eventId = :eventId", { eventId })
      .andWhere("(reservationId = :ownerId OR status = 'RESERVED')", {
        ownerId,
      })
      .execute();

    this.logger.log(
      `Compensation updated ${updateResult.affected || 0} seats to AVAILABLE`
    );

    this.logger.log(
      `Successfully released seats (compensation) for reservation ${ownerId}`
    );

    return {
      success: true,
      releasedSeatIds: seatEntities.map((s) => s.id),
      ownerId,
      eventId,
      compensation: true,
    };
  }

  /**
   * Update reservationId for seats when reservation is created
   * This is called by Reservation Service after creating a reservation
   */
  async updateReservationId(
    eventId: string,
    userId: string,
    reservationId: string,
    seatIds: string[]
  ): Promise<void> {
    this.logger.log(
      `Updating reservationId for seats: event ${eventId}, user ${userId}, reservation ${reservationId}, seats: ${seatIds.join(", ")}`
    );

    // Validate seats are locked by userId
    const seatEntities = await this.seatRepository.find({
      where: { id: In(seatIds), eventId, lockedBy: userId },
    });

    if (seatEntities.length !== seatIds.length) {
      throw new BadRequestException(
        "One or more seats are not locked by this user"
      );
    }

    // Update reservationId (keep lockedBy as userId)
    await this.seatRepository.update(
      { id: In(seatIds), eventId, lockedBy: userId },
      {
        reservationId,
      }
    );

    this.logger.log(
      `Successfully updated reservationId for ${seatIds.length} seats`
    );
  }
}
