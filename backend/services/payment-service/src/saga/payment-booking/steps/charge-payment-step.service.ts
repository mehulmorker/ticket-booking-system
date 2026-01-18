import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ISagaStep, ICompensatableStep } from "../../interfaces";
import { Payment } from "../../../payments/entities/payment.entity";

export interface ChargePaymentPayload {
  paymentId: string;
  transactionId?: string;
  paymentDetails?: any;
}

@Injectable()
export class ChargePaymentStep implements ISagaStep, ICompensatableStep {
  private readonly logger = new Logger(ChargePaymentStep.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>
  ) {}

  get stepName(): string {
    return "CHARGE_PAYMENT";
  }

  get stepOrder(): number {
    return 1;
  }

  async execute(payload: any): Promise<any> {
    const { paymentId, transactionId, paymentDetails } =
      payload as ChargePaymentPayload;

    this.logger.log(
      `Executing step: ${this.stepName} for payment ${paymentId}`
    );

    // Find payment
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }

    // Check if already completed (idempotency)
    if (payment.status === "COMPLETED") {
      this.logger.log(
        `Payment ${paymentId} already completed, returning existing payment`
      );
      return {
        paymentId: payment.id,
        transactionId: payment.transactionId,
        status: payment.status,
      };
    }

    // Validate payment status
    if (payment.status !== "PENDING" && payment.status !== "PROCESSING") {
      throw new Error(
        `Payment cannot be confirmed. Current status: ${payment.status}`
      );
    }

    // Mark payment as completed
    payment.status = "COMPLETED";
    payment.transactionId = transactionId || payment.transactionId;
    payment.paymentDetails = paymentDetails || payment.paymentDetails;
    payment.processedAt = new Date();

    await this.paymentRepository.save(payment);

    this.logger.log(
      `Payment ${paymentId} charged successfully with transaction ${payment.transactionId}`
    );

    return {
      paymentId: payment.id,
      transactionId: payment.transactionId,
      status: payment.status,
      amount: payment.amount,
    };
  }

  async compensate(payload: any, result?: any): Promise<any> {
    const { paymentId } = payload as ChargePaymentPayload;

    this.logger.log(
      `Compensating step: ${this.stepName} for payment ${paymentId}`
    );

    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      this.logger.warn(`Payment ${paymentId} not found for compensation`);
      return { compensated: false, reason: "Payment not found" };
    }

    // Only compensate if payment was completed
    if (payment.status === "COMPLETED") {
      // Mark payment as refunded
      payment.status = "REFUNDED";
      await this.paymentRepository.save(payment);

      this.logger.log(`Payment ${paymentId} refunded successfully`);
      return {
        compensated: true,
        paymentId: payment.id,
        status: payment.status,
      };
    }

    this.logger.log(
      `Payment ${paymentId} was not completed, no compensation needed`
    );
    return { compensated: false, reason: "Payment was not completed" };
  }

  canRetry(error: any): boolean {
    // Retry on network errors, timeouts, or 5xx errors
    if (error.response) {
      const status = error.response.status;
      return status >= 500 || status === 408; // 5xx or timeout
    }
    // Retry on network errors
    return (
      error.code === "ECONNREFUSED" ||
      error.code === "ETIMEDOUT" ||
      error.message?.includes("timeout")
    );
  }

  getMaxRetries(): number {
    return 3;
  }

  requiresCompensation(stepStatus: string): boolean {
    return stepStatus === "COMPLETED";
  }
}
