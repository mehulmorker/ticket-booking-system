import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { EventServiceClient } from "./event-client.service";
import { SeatServiceClient } from "./seat-client.service";
import { ReservationServiceClient } from "./reservation-client.service";
import { AuthServiceClient } from "./auth-client.service";

@Module({
  imports: [
    HttpModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>("jwt.secret"),
      }),
    }),
  ],
  providers: [
    EventServiceClient,
    SeatServiceClient,
    ReservationServiceClient,
    AuthServiceClient,
  ],
  exports: [
    EventServiceClient,
    SeatServiceClient,
    ReservationServiceClient,
    AuthServiceClient,
  ],
})
export class ClientsModule {}
