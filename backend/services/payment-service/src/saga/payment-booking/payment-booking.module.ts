import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Payment } from "../../payments/entities/payment.entity";
import { PaymentBookingSaga } from "./payment-booking-saga.service";
import { ChargePaymentStep } from "./steps/charge-payment-step.service";
import { ConfirmReservationStep } from "./steps/confirm-reservation-step.service";
import { ConfirmSeatsStep } from "./steps/confirm-seats-step.service";
import { GenerateTicketStep } from "./steps/generate-ticket-step.service";
import { ClientsModule } from "../../clients/clients.module";
import { SqsModule } from "../../sqs/sqs.module";
import { SagaModule } from "../saga.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment]),
    ClientsModule,
    SqsModule,
    forwardRef(() => SagaModule),
  ],
  providers: [
    PaymentBookingSaga,
    ChargePaymentStep,
    ConfirmReservationStep,
    ConfirmSeatsStep,
    GenerateTicketStep,
  ],
  exports: [PaymentBookingSaga],
})
export class PaymentBookingModule {}
