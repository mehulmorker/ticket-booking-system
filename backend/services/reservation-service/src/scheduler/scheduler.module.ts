import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ScheduleModule } from "@nestjs/schedule";
import { Reservation } from "../reservations/entities/reservation.entity";
import { ReservationExpiryCleanupService } from "./reservation-expiry-cleanup.service";
import { ReservationsModule } from "../reservations/reservations.module";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([Reservation]),
    ReservationsModule, // This provides ReservationsService
  ],
  providers: [ReservationExpiryCleanupService],
})
export class SchedulerModule {}
