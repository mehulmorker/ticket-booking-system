import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, LessThan } from "typeorm";
import { Reservation, ReservationStatus } from "./entities/reservation.entity";
import { CreateReservationDto } from "./dto/create-reservation.dto";
import { ExtendReservationDto } from "./dto/extend-reservation.dto";
import { SqsService } from "../sqs/sqs.service";
import { SeatServiceClient } from "../clients/seat-client.service";

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);
  private readonly RESERVATION_TTL_MINUTES = 15; // Default 15 minutes

  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,
    private readonly sqsService: SqsService,
    private readonly seatServiceClient: SeatServiceClient
  ) {}

  async create(
    userId: string,
    dto: CreateReservationDto
  ): Promise<Reservation> {
    const { eventId, seatIds, totalAmount, idempotencyKey } = dto;

    if (idempotencyKey) {
      const existing = await this.reservationRepository.findOne({
        where: { idempotencyKey },
      });

      if (existing) {
        this.logger.log(
          `Reservation already exists for idempotency key ${idempotencyKey}, returning existing reservation ${existing.id}`
        );
        return existing;
      }
    }

    // Validate seats are available or locked by this user before creating reservation
    this.logger.log(
      `Validating seats for event ${eventId}, seats: ${seatIds.join(", ")}, userId: ${userId}`
    );
    const seatsValid = await this.seatServiceClient.validateSeats(
      eventId,
      seatIds,
      userId
    );

    if (!seatsValid) {
      throw new BadRequestException(
        "One or more seats are not available for reservation. Seats must be AVAILABLE or LOCKED by you, and must not be RESERVED or already reserved by another reservation."
      );
    }

    // Additional check: Prevent duplicate reservations for the same seats
    // Check if there's already a PENDING reservation for any of these seats
    // Note: seatIds is stored as simple-array (comma-separated string), so we need to check manually
    const now = new Date();
    const existingReservations = await this.reservationRepository.find({
      where: {
        eventId,
        status: "PENDING",
      },
    });

    // Check if any existing PENDING reservation has overlapping seatIds
    // Only consider non-expired reservations
    for (const existingReservation of existingReservations) {
      // Skip expired reservations (they should be cleaned up, but check anyway)
      if (existingReservation.expiresAt < now) {
        continue;
      }

      // Skip if it's the same user trying to create a reservation for the same seats
      // (This handles the case where user might be retrying with different idempotency key)
      if (existingReservation.userId === userId) {
        const hasOverlap = seatIds.some((seatId) =>
          existingReservation.seatIds.includes(seatId)
        );
        if (hasOverlap) {
          this.logger.warn(
            `User ${userId} already has a PENDING reservation ${existingReservation.id} for seats ${seatIds.join(", ")}. Returning existing reservation.`
          );
          // Return existing reservation instead of creating duplicate
          return existingReservation;
        }
      }

      // For different users, check for overlap
      const hasOverlap = seatIds.some((seatId) =>
        existingReservation.seatIds.includes(seatId)
      );

      if (hasOverlap) {
        this.logger.warn(
          `Seats ${seatIds.join(", ")} already have a PENDING reservation ${existingReservation.id} with seats ${existingReservation.seatIds.join(", ")}`
        );
        throw new BadRequestException(
          `One or more seats are already reserved in reservation ${existingReservation.id}. Please wait for it to expire or be completed.`
        );
      }
    }

    // Lock seats for this reservation
    this.logger.log(
      `Locking seats for reservation creation, event ${eventId}, seats: ${seatIds.join(", ")}`
    );

    // Create reservation first to get the ID for ownerId
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.RESERVATION_TTL_MINUTES);

    const reservation = this.reservationRepository.create({
      userId,
      eventId,
      seatIds,
      totalAmount,
      status: "PENDING",
      expiresAt,
      idempotencyKey,
    });

    const saved = await this.reservationRepository.save(reservation);

    // Update reservationId for seats (seats should already be locked by userId)
    // This is a simple database update, no lock transfer needed
    try {
      await this.seatServiceClient.updateReservationId(
        eventId,
        userId,
        saved.id,
        seatIds
      );
      this.logger.log(
        `Successfully updated reservationId for seats in reservation ${saved.id}`
      );
    } catch (error) {
      // If update fails, delete the reservation
      await this.reservationRepository.remove(saved);
      this.logger.error(
        `Failed to update reservationId, removed reservation ${saved.id}: ${error.message}`
      );
      throw new BadRequestException(
        `Failed to update reservationId for seats: ${error.message}`
      );
    }

    // Send expiry message to SQS (async, don't wait)
    this.sqsService
      .sendReservationExpiryMessage(saved.id, saved.expiresAt)
      .catch((err) => {
        // Log error but don't fail reservation creation
        this.logger.error(
          `Failed to send expiry message for reservation ${saved.id}: ${err.message}`,
          err.stack
        );
      });

    return saved;
  }

  async findOne(id: string): Promise<Reservation> {
    const reservation = await this.reservationRepository.findOne({
      where: { id },
    });
    if (!reservation) {
      throw new NotFoundException(`Reservation with ID ${id} not found`);
    }
    return reservation;
  }

  async findByUser(userId: string): Promise<Reservation[]> {
    return this.reservationRepository.find({
      where: { userId },
      order: { createdAt: "DESC" },
    });
  }

  async extend(dto: ExtendReservationDto): Promise<Reservation> {
    const { reservationId, additionalMinutes } = dto;

    const reservation = await this.findOne(reservationId);

    if (reservation.status !== "PENDING") {
      throw new BadRequestException(
        "Only pending reservations can be extended"
      );
    }

    if (new Date() >= reservation.expiresAt) {
      throw new BadRequestException("Reservation has already expired");
    }

    const newExpiresAt = new Date(reservation.expiresAt);
    newExpiresAt.setMinutes(newExpiresAt.getMinutes() + additionalMinutes);

    reservation.expiresAt = newExpiresAt;
    const updated = await this.reservationRepository.save(reservation);

    // Update expiry message in SQS
    this.sqsService
      .sendReservationExpiryMessage(updated.id, updated.expiresAt)
      .catch((err) => {
        this.logger.error(
          `Failed to update expiry message for reservation ${updated.id}: ${err.message}`,
          err.stack
        );
      });

    return updated;
  }

  async cancel(id: string, userId: string): Promise<Reservation> {
    const reservation = await this.findOne(id);

    if (reservation.userId !== userId) {
      throw new BadRequestException(
        "You can only cancel your own reservations"
      );
    }

    if (reservation.status !== "PENDING") {
      throw new BadRequestException(
        "Only pending reservations can be cancelled"
      );
    }

    reservation.status = "CANCELLED";
    reservation.cancelledAt = new Date();

    const updated = await this.reservationRepository.save(reservation);

    // Release locked seats (use userId, not reservationId)
    try {
      await this.seatServiceClient.releaseSeats(
        reservation.eventId,
        reservation.userId, // Use userId, not reservationId
        reservation.seatIds
      );
      this.logger.log(
        `Successfully released seats for cancelled reservation ${id}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to release seats for cancelled reservation ${id}: ${error.message}`,
        error.stack
      );
      // Don't fail cancellation if seat release fails - seats will expire anyway
    }

    return updated;
  }

  async confirm(id: string): Promise<Reservation> {
    const reservation = await this.findOne(id);

    if (reservation.status === "CONFIRMED") {
      this.logger.log(
        `Reservation ${id} already confirmed at ${reservation.confirmedAt}, returning existing reservation`
      );
      return reservation;
    }

    if (reservation.status !== "PENDING") {
      throw new BadRequestException(
        "Only pending reservations can be confirmed"
      );
    }

    if (new Date() >= reservation.expiresAt) {
      throw new BadRequestException("Reservation has expired");
    }

    reservation.status = "CONFIRMED";
    reservation.confirmedAt = new Date();

    const updated = await this.reservationRepository.save(reservation);

    // Note: Seat confirmation is handled by the Saga Pattern (CONFIRM_SEATS step)
    // We don't confirm seats here to avoid double confirmation and ensure saga can handle failures
    // If saga is not used, seats should be confirmed separately
    this.logger.log(
      `Reservation ${id} confirmed. Seat confirmation will be handled by saga pattern.`
    );

    return updated;
  }

  async expireReservation(id: string): Promise<void> {
    const reservation = await this.reservationRepository.findOne({
      where: { id },
    });
    if (!reservation) {
      return;
    }

    if (reservation.status === "PENDING") {
      reservation.status = "EXPIRED";
      await this.reservationRepository.save(reservation);

      // Release locked seats (use userId, not reservationId)
      try {
        await this.seatServiceClient.releaseSeats(
          reservation.eventId,
          reservation.userId, // Use userId, not reservationId
          reservation.seatIds
        );
        this.logger.log(
          `Successfully released seats for expired reservation ${id}`
        );
      } catch (error) {
        this.logger.error(
          `Failed to release seats for expired reservation ${id}: ${error.message}`,
          error.stack
        );
        // Don't fail expiry if seat release fails
      }
    }
  }

  async findExpiredReservations(): Promise<Reservation[]> {
    return this.reservationRepository.find({
      where: {
        status: "PENDING",
        expiresAt: LessThan(new Date()),
      },
    });
  }

  /**
   * Cancel reservation (compensation for saga)
   * This method doesn't validate userId - used for saga compensation
   */
  async cancelReservation(id: string): Promise<Reservation> {
    const reservation = await this.findOne(id);

    // Only cancel if status is CONFIRMED (compensation scenario)
    if (reservation.status === "CONFIRMED") {
      reservation.status = "CANCELLED";
      reservation.cancelledAt = new Date();

      const updated = await this.reservationRepository.save(reservation);

      this.logger.log(
        `Reservation ${id} cancelled (compensation) at ${reservation.cancelledAt}`
      );

      // Release seats (if they were confirmed)
      try {
        await this.seatServiceClient.releaseSeats(
          reservation.eventId,
          reservation.id,
          reservation.seatIds
        );
        this.logger.log(
          `Successfully released seats for cancelled reservation ${id} (compensation)`
        );
      } catch (error) {
        this.logger.error(
          `Failed to release seats for cancelled reservation ${id} (compensation): ${error.message}`,
          error.stack
        );
        // Don't fail - compensation should be best effort
      }

      return updated;
    }

    // If already cancelled or not confirmed, return as-is
    this.logger.log(
      `Reservation ${id} is ${reservation.status}, no compensation needed`
    );
    return reservation;
  }
}
