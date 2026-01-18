import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ScheduleModule } from "@nestjs/schedule";
import { Seat } from "../seats/entities/seat.entity";
import { SeatLockCleanupService } from "./seat-lock-cleanup.service";
import { RedisModule } from "../redis/redis.module";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([Seat]),
    RedisModule,
  ],
  providers: [SeatLockCleanupService],
})
export class SchedulerModule {}

