import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Payment, PaymentStatus } from "./entities/payment.entity";
import { InitiatePaymentDto } from "./dto/initiate-payment.dto";
import { ConfirmPaymentDto } from "./dto/confirm-payment.dto";
import { RefundPaymentDto } from "./dto/refund-payment.dto";
import { SqsService } from "../sqs/sqs.service";
import { ReservationServiceClient } from "../clients/reservation-client.service";
import { SeatServiceClient } from "../clients/seat-client.service";
import { TicketServiceClient } from "../clients/ticket-client.service";
import { PaymentBookingSaga } from "../saga/payment-booking/payment-booking-saga.service";

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  private readonly useSaga: boolean;

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly sqsService: SqsService,
    private readonly reservationServiceClient: ReservationServiceClient,
    private readonly seatServiceClient: SeatServiceClient,
    private readonly ticketServiceClient: TicketServiceClient,
    private readonly paymentBookingSaga: PaymentBookingSaga
  ) {
    // Feature flag: Enable saga pattern (default: true)
    this.useSaga = process.env.USE_SAGA_PATTERN !== "false";
  }

  async initiate(userId: string, dto: InitiatePaymentDto): Promise<Payment> {
    this.logger.log(
      `Initiating payment for user ${userId} with dto: ${JSON.stringify(dto)}`
    );
    const { reservationId, paymentMethod, amount, eventId, idempotencyKey } =
      dto;

    if (idempotencyKey) {
      const existing = await this.paymentRepository.findOne({
        where: { idempotencyKey },
      });

      if (existing) {
        this.logger.log(
          `Payment already exists for idempotency key ${idempotencyKey}, returning existing payment ${existing.id}`
        );
        return existing;
      }
    }

    // Validate reservation exists and is valid for payment
    this.logger.log(
      `Validating reservation ${reservationId} before payment initiation`
    );
    const reservation =
      await this.reservationServiceClient.validateReservation(reservationId);

    // Verify amount matches reservation (use numeric comparison to handle decimal precision)
    const paymentAmount = Number(amount);
    const reservationAmount = Number(reservation.totalAmount);
    const tolerance = 0.01; // Allow 1 cent tolerance for floating point precision

    if (Math.abs(paymentAmount - reservationAmount) > tolerance) {
      throw new BadRequestException(
        `Payment amount ${amount} does not match reservation total ${reservation.totalAmount}`
      );
    }

    // Verify user owns the reservation
    if (reservation.userId !== userId) {
      throw new BadRequestException(
        "You can only pay for your own reservations"
      );
    }

    const payment = this.paymentRepository.create({
      reservationId,
      userId,
      eventId,
      amount,
      paymentMethod,
      status: "PENDING",
      idempotencyKey,
    });

    const saved = await this.paymentRepository.save(payment);
    this.logger.log(
      `Payment ${saved.id} initiated for reservation ${reservationId}`
    );

    return saved;
  }

  async confirm(dto: ConfirmPaymentDto): Promise<Payment> {
    const { paymentId, transactionId, paymentDetails } = dto;

    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${paymentId} not found`);
    }

    if (payment.status === "COMPLETED") {
      this.logger.log(
        `Payment ${paymentId} already confirmed with transaction ${payment.transactionId}, returning existing payment`
      );
      return payment;
    }

    if (payment.status !== "PENDING" && payment.status !== "PROCESSING") {
      throw new BadRequestException(
        `Payment cannot be confirmed. Current status: ${payment.status}`
      );
    }

    // Use Saga Pattern if enabled
    if (this.useSaga) {
      this.logger.log(
        `Using Saga Pattern for payment confirmation ${paymentId}`
      );

      try {
        // Get reservation to get seat IDs
        const reservation = await this.reservationServiceClient.getReservation(
          payment.reservationId
        );

        // Execute Payment Booking Saga
        const sagaExecution = await this.paymentBookingSaga.execute({
          paymentId: payment.id,
          reservationId: payment.reservationId,
          eventId: payment.eventId,
          userId: payment.userId,
          seatIds: reservation.seatIds,
          amount: payment.amount,
          transactionId,
          paymentDetails,
        });

        // Refresh payment from database (saga updated it)
        const updatedPayment = await this.paymentRepository.findOne({
          where: { id: paymentId },
        });

        if (sagaExecution.status === "COMPLETED") {
          this.logger.log(
            `Payment Booking Saga completed successfully for payment ${paymentId}`
          );
          return updatedPayment || payment;
        } else {
          this.logger.error(
            `Payment Booking Saga failed for payment ${paymentId}. Status: ${sagaExecution.status}`
          );
          throw new BadRequestException(
            `Payment confirmation failed: ${sagaExecution.errorMessage || "Saga execution failed"}`
          );
        }
      } catch (error) {
        this.logger.error(
          `Saga execution failed for payment ${paymentId}: ${error.message}`,
          error.stack
        );
        throw error;
      }
    }

    // Fallback to old implementation (if saga is disabled)
    this.logger.log(
      `Using legacy payment confirmation flow for payment ${paymentId}`
    );

    payment.status = "COMPLETED";
    payment.transactionId = transactionId;
    payment.paymentDetails = paymentDetails;
    payment.processedAt = new Date();

    const updated = await this.paymentRepository.save(payment);

    this.logger.log(
      `Payment ${paymentId} confirmed with transaction ${transactionId}`
    );

    // Confirm reservation after payment
    try {
      await this.reservationServiceClient.confirmReservation(
        payment.reservationId
      );
      this.logger.log(
        `Successfully confirmed reservation ${payment.reservationId} after payment`
      );
    } catch (error) {
      this.logger.error(
        `Failed to confirm reservation after payment: ${error.message}`,
        error.stack
      );
      // Don't fail payment confirmation if reservation confirmation fails
    }

    // Confirm seats after payment (mark as sold)
    try {
      const reservation = await this.reservationServiceClient.getReservation(
        payment.reservationId
      );
      await this.seatServiceClient.confirmSeats(
        payment.eventId,
        payment.reservationId,
        reservation.seatIds
      );
      this.logger.log(
        `Successfully confirmed seats for reservation ${payment.reservationId}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to confirm seats after payment: ${error.message}`,
        error.stack
      );
      // Don't fail payment confirmation if seat confirmation fails
    }

    // Trigger ticket generation (async)
    // Try SQS first, fallback to direct HTTP if SQS is not configured
    try {
      const reservation = await this.reservationServiceClient.getReservation(
        payment.reservationId
      );

      // Try SQS first (primary method for async processing)
      try {
        await this.sqsService.sendTicketGenerationMessage(
          payment.reservationId,
          payment.id,
          payment.userId,
          payment.eventId,
          reservation.seatIds
        );
        this.logger.log(
          `✅ Sent ticket generation message via SQS for payment ${payment.id}`
        );
      } catch (sqsError) {
        // If SQS fails, use direct HTTP call as fallback
        this.logger.warn(
          `⚠️  SQS ticket generation failed (${sqsError.message}), using direct HTTP fallback`
        );
        try {
          await this.ticketServiceClient.generateTicket({
            reservationId: payment.reservationId,
            paymentId: payment.id,
            userId: payment.userId,
            eventId: payment.eventId,
            seatIds: reservation.seatIds,
          });
          this.logger.log(
            `✅ Generated ticket via direct HTTP for payment ${payment.id}`
          );
        } catch (httpError) {
          this.logger.error(
            `❌ Both SQS and HTTP ticket generation failed: ${httpError.message}`
          );
          // Don't throw - payment is already completed
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to generate ticket: ${error.message}`,
        error.stack
      );
      // Don't fail payment confirmation if ticket generation fails
    }

    return updated;
  }

  async processPayment(paymentId: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${paymentId} not found`);
    }

    if (payment.status !== "PENDING") {
      throw new BadRequestException(
        `Payment cannot be processed. Current status: ${payment.status}`
      );
    }

    payment.status = "PROCESSING";
    await this.paymentRepository.save(payment);

    this.logger.log(`Payment ${paymentId} processing started`);

    try {
      await this.simulatePaymentProcessing(payment);
    } catch (error) {
      payment.status = "FAILED";
      payment.failureReason = error.message;
      await this.paymentRepository.save(payment);
      this.logger.error(
        `Payment ${paymentId} failed: ${error.message}`,
        error.stack
      );
      throw error;
    }

    return payment;
  }

  private async simulatePaymentProcessing(payment: Payment): Promise<void> {
    if (payment.status === "COMPLETED") {
      this.logger.log(
        `Payment ${payment.id} already completed, skipping processing`
      );
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const success = Math.random() > 0.1;

    if (success) {
      payment.status = "COMPLETED";
      payment.transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      payment.processedAt = new Date();
      await this.paymentRepository.save(payment);

      // Confirm reservation after payment
      // Note: When using processPayment (non-saga flow), we need to confirm reservation and seats
      // Saga flow uses /confirm endpoint which handles this via saga steps
      try {
        await this.reservationServiceClient.confirmReservation(
          payment.reservationId
        );
        this.logger.log(
          `Successfully confirmed reservation ${payment.reservationId} after payment`
        );

        // Confirm seats separately (reservation.confirm() no longer confirms seats to avoid double confirmation in saga)
        const reservation = await this.reservationServiceClient.getReservation(
          payment.reservationId
        );
        await this.seatServiceClient.confirmSeats(
          payment.eventId,
          payment.reservationId,
          reservation.seatIds
        );
        this.logger.log(
          `Successfully confirmed seats for reservation ${payment.reservationId}`
        );
      } catch (error) {
        this.logger.error(
          `Failed to confirm reservation/seats after payment: ${error.message}`,
          error.stack
        );
        throw error; // Re-throw to mark payment as failed
      }

      // Trigger ticket generation (async)
      // Try SQS first, fallback to direct HTTP if SQS is not configured
      try {
        const reservation = await this.reservationServiceClient.getReservation(
          payment.reservationId
        );

        // Try SQS first (primary method for async processing)
        try {
          await this.sqsService.sendTicketGenerationMessage(
            payment.reservationId,
            payment.id,
            payment.userId,
            payment.eventId,
            reservation.seatIds
          );
          this.logger.log(
            `✅ Sent ticket generation message via SQS for payment ${payment.id}`
          );
        } catch (sqsError) {
          // If SQS fails, use direct HTTP call as fallback
          this.logger.warn(
            `⚠️  SQS ticket generation failed (${sqsError.message}), using direct HTTP fallback`
          );
          try {
            await this.ticketServiceClient.generateTicket({
              reservationId: payment.reservationId,
              paymentId: payment.id,
              userId: payment.userId,
              eventId: payment.eventId,
              seatIds: reservation.seatIds,
            });
            this.logger.log(
              `✅ Generated ticket via direct HTTP for payment ${payment.id}`
            );
          } catch (httpError) {
            this.logger.error(
              `❌ Both SQS and HTTP ticket generation failed: ${httpError.message}`
            );
            // Don't throw - payment confirmation is already done
          }
        }
      } catch (error) {
        this.logger.error(
          `Failed to generate ticket: ${error.message}`,
          error.stack
        );
        // Don't fail payment if ticket generation fails
      }
    } else {
      throw new Error("Payment processing failed");
    }
  }

  async refund(dto: RefundPaymentDto): Promise<Payment> {
    const { paymentId, reason } = dto;

    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${paymentId} not found`);
    }

    if (payment.status !== "COMPLETED") {
      throw new BadRequestException(
        `Only completed payments can be refunded. Current status: ${payment.status}`
      );
    }

    payment.status = "REFUNDED";
    payment.refundedAt = new Date();
    if (reason) {
      payment.failureReason = reason;
    }

    const updated = await this.paymentRepository.save(payment);
    this.logger.log(
      `Payment ${paymentId} refunded. Reason: ${reason || "Not specified"}`
    );

    return updated;
  }

  async findOne(id: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({ where: { id } });
    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }
    return payment;
  }

  async findByReservation(reservationId: string): Promise<Payment[]> {
    return this.paymentRepository.find({
      where: { reservationId },
      order: { createdAt: "DESC" },
    });
  }
}
