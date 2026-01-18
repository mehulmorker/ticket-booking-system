import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { LessThan, Repository } from "typeorm";
import { Cron } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { Seat } from "../seats/entities/seat.entity";
import { RedisService } from "../redis/redis.service";

@Injectable()
export class SeatLockCleanupService {
  private readonly logger = new Logger(SeatLockCleanupService.name);
  private readonly batchSize: number;

  constructor(
    @InjectRepository(Seat)
    private readonly seatRepository: Repository<Seat>,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService
  ) {
    this.batchSize =
      this.configService.get<number>("scheduler.cleanupBatchSize", 100) || 100;
  }

  @Cron(
    process.env.SEAT_LOCK_CLEANUP_CRON || "*/2 * * * *" // Every 2 minutes by default
  )
  async cleanupExpiredLocks(): Promise<void> {
    const startTime = Date.now();
    this.logger.log("Starting expired lock cleanup job");

    try {
      // Find seats with expired locks
      const expiredSeats = await this.findExpiredLocks();

      if (expiredSeats.length === 0) {
        this.logger.debug("No expired locks found");
        return;
      }

      this.logger.log(`Found ${expiredSeats.length} seats with expired locks`);

      let updatedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      // Process seats in batches
      for (let i = 0; i < expiredSeats.length; i += this.batchSize) {
        const batch = expiredSeats.slice(i, i + this.batchSize);
        const results = await this.processBatch(batch);

        updatedCount += results.updated;
        skippedCount += results.skipped;
        errorCount += results.errors;
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `Cleanup completed in ${duration}ms: ${updatedCount} updated, ${skippedCount} skipped, ${errorCount} errors`
      );
    } catch (error) {
      this.logger.error(
        `Failed to run cleanup job: ${error.message}`,
        error.stack
      );
    }
  }

  private async findExpiredLocks(): Promise<Seat[]> {
    try {
      return await this.seatRepository.find({
        where: {
          status: "LOCKED",
          lockExpiresAt: LessThan(new Date()),
        },
        order: {
          lockExpiresAt: "ASC",
        },
        take: this.batchSize * 5, // Get more than batch size to process
      });
    } catch (error) {
      this.logger.error(
        `Failed to query expired locks: ${error.message}`,
        error.stack
      );
      return [];
    }
  }

  private async processBatch(seats: Seat[]): Promise<{
    updated: number;
    skipped: number;
    errors: number;
  }> {
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const seat of seats) {
      try {
        const result = await this.processExpiredSeat(seat);
        if (result === "updated") {
          updated++;
        } else if (result === "skipped") {
          skipped++;
        }
      } catch (error) {
        errors++;
        this.logger.warn(`Failed to process seat ${seat.id}: ${error.message}`);
      }
    }

    return { updated, skipped, errors };
  }

  private async processExpiredSeat(seat: Seat): Promise<"updated" | "skipped"> {
    // Check if Redis lock still exists
    const lockKey = `seat-lock:${seat.id}`;
    const lockExists = await this.redisService.isLocked(lockKey);

    if (lockExists) {
      // Lock still exists in Redis (edge case: lock was extended)
      // Update lockExpiresAt to match Redis TTL
      this.logger.debug(
        `Seat ${seat.id} has expired lockExpiresAt but Redis lock still exists. Lock may have been extended.`
      );
      return "skipped";
    }

    // Redis lock doesn't exist - safe to update database
    await this.updateSeatToAvailable(seat);
    return "updated";
  }

  private async updateSeatToAvailable(seat: Seat): Promise<void> {
    try {
      const result = await this.seatRepository.update(
        {
          id: seat.id,
          status: "LOCKED", // Only update if still LOCKED (prevent race conditions)
        },
        {
          status: "AVAILABLE",
          lockedBy: null,
          reservationId: null, // Clear reservationId when releasing expired locks
          lockedAt: null,
          lockExpiresAt: null,
        }
      );

      if (result.affected && result.affected > 0) {
        this.logger.debug(
          `Updated seat ${seat.id} (event: ${seat.eventId}) from LOCKED to AVAILABLE`
        );
      } else {
        this.logger.debug(
          `Seat ${seat.id} was already updated (status may have changed)`
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to update seat ${seat.id}: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }
}
