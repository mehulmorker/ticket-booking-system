import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { Reservation } from "./entities/reservation.entity";
import { ReservationsService } from "./reservations.service";
import { ReservationsController } from "./reservations.controller";
import { SqsModule } from "../sqs/sqs.module";
import { ClientsModule } from "../clients/clients.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Reservation]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const jwtConfig = configService.get("jwt");
        return {
          secret: jwtConfig?.secret || process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production-min-32-chars",
          verifyOptions: {
            ignoreExpiration: false,
          },
        };
      },
    }),
    SqsModule,
    ClientsModule,
  ],
  controllers: [ReservationsController],
  providers: [ReservationsService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
