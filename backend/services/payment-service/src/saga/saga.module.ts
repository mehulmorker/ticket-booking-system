import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SagaExecution } from "./entities/saga-execution.entity";
import { SagaStep } from "./entities/saga-step.entity";
import { SagaOrchestrator } from "./saga-orchestrator.service";
import { PaymentBookingModule } from "./payment-booking/payment-booking.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([SagaExecution, SagaStep]),
    forwardRef(() => PaymentBookingModule),
  ],
  providers: [SagaOrchestrator],
  exports: [SagaOrchestrator, TypeOrmModule],
})
export class SagaModule {}
