import { Injectable, Logger } from "@nestjs/common";
import { SagaOrchestrator } from "../saga-orchestrator.service";
import { ChargePaymentStep } from "./steps/charge-payment-step.service";
import { ConfirmReservationStep } from "./steps/confirm-reservation-step.service";
import { ConfirmSeatsStep } from "./steps/confirm-seats-step.service";
import { GenerateTicketStep } from "./steps/generate-ticket-step.service";

export interface PaymentBookingSagaPayload {
  paymentId: string;
  reservationId: string;
  eventId: string;
  userId: string;
  seatIds: string[];
  amount: number;
  transactionId?: string;
  paymentDetails?: any;
}

@Injectable()
export class PaymentBookingSaga {
  private readonly logger = new Logger(PaymentBookingSaga.name);
  private readonly SAGA_TYPE = "PAYMENT_BOOKING";

  constructor(
    private readonly sagaOrchestrator: SagaOrchestrator,
    private readonly chargePaymentStep: ChargePaymentStep,
    private readonly confirmReservationStep: ConfirmReservationStep,
    private readonly confirmSeatsStep: ConfirmSeatsStep,
    private readonly generateTicketStep: GenerateTicketStep
  ) {}

  /**
   * Execute Payment Booking Saga
   */
  async execute(payload: PaymentBookingSagaPayload) {
    this.logger.log(
      `Starting Payment Booking Saga for payment ${payload.paymentId}`
    );

    const steps = [
      this.chargePaymentStep,
      this.confirmReservationStep,
      this.confirmSeatsStep,
      this.generateTicketStep,
    ];

    return this.sagaOrchestrator.executeSaga(this.SAGA_TYPE, payload, steps);
  }
}

