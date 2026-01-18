import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { LessThan, Repository } from "typeorm";
import { Cron } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { Reservation } from "../reservations/entities/reservation.entity";
import { ReservationsService } from "../reservations/reservations.service";

@Injectable()
export class ReservationExpiryCleanupService {
  private readonly logger = new Logger(ReservationExpiryCleanupService.name);
  private readonly batchSize: number;

  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,
    private readonly reservationsService: ReservationsService,
    private readonly configService: ConfigService
  ) {
    this.batchSize =
      this.configService.get<number>("scheduler.cleanupBatchSize", 100) || 100;
  }

  @Cron(
    process.env.RESERVATION_EXPIRY_CLEANUP_CRON || "*/1 * * * *" // Every 1 minute by default
  )
  async cleanupExpiredReservations(): Promise<void> {
    const startTime = Date.now();
    this.logger.log("Starting expired reservation cleanup job");

    try {
      // Find expired reservations
      const expiredReservations = await this.findExpiredReservations();

      if (expiredReservations.length === 0) {
        this.logger.debug("No expired reservations found");
        return;
      }

      this.logger.log(
        `Found ${expiredReservations.length} expired reservations to process`
      );

      let processedCount = 0;
      let errorCount = 0;

      // Process reservations in batches
      for (let i = 0; i < expiredReservations.length; i += this.batchSize) {
        const batch = expiredReservations.slice(i, i + this.batchSize);
        const results = await this.processBatch(batch);

        processedCount += results.processed;
        errorCount += results.errors;
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `Cleanup completed in ${duration}ms: ${processedCount} processed, ${errorCount} errors`
      );
    } catch (error) {
      this.logger.error(
        `Failed to run cleanup job: ${error.message}`,
        error.stack
      );
    }
  }

  private async findExpiredReservations(): Promise<Reservation[]> {
    try {
      return await this.reservationRepository.find({
        where: {
          status: "PENDING",
          expiresAt: LessThan(new Date()),
        },
        order: {
          expiresAt: "ASC",
        },
        take: this.batchSize * 5, // Get more than batch size to process
      });
    } catch (error) {
      this.logger.error(
        `Failed to query expired reservations: ${error.message}`,
        error.stack
      );
      return [];
    }
  }

  private async processBatch(reservations: Reservation[]): Promise<{
    processed: number;
    errors: number;
  }> {
    let processed = 0;
    let errors = 0;

    for (const reservation of reservations) {
      try {
        await this.reservationsService.expireReservation(reservation.id);
        processed++;
        this.logger.debug(`Successfully expired reservation ${reservation.id}`);
      } catch (error) {
        errors++;
        this.logger.warn(
          `Failed to expire reservation ${reservation.id}: ${error.message}`
        );
      }
    }

    return { processed, errors };
  }
}
