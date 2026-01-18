import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { Payment } from "./entities/payment.entity";
import { PaymentsService } from "./payments.service";
import { PaymentsController } from "./payments.controller";
import { SqsModule } from "../sqs/sqs.module";
import { ClientsModule } from "../clients/clients.module";
import { PaymentBookingModule } from "../saga/payment-booking/payment-booking.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const jwtConfig = configService.get("jwt");
        return {
          secret:
            jwtConfig?.secret ||
            process.env.JWT_SECRET ||
            "your-super-secret-jwt-key-change-in-production-min-32-chars",
          verifyOptions: {
            ignoreExpiration: false,
          },
        };
      },
    }),
    SqsModule,
    ClientsModule,
    PaymentBookingModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
