import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ReservationServiceClient } from "./reservation-client.service";
import { SeatServiceClient } from "./seat-client.service";
import { TicketServiceClient } from "./ticket-client.service";

@Module({
  imports: [HttpModule],
  providers: [ReservationServiceClient, SeatServiceClient, TicketServiceClient],
  exports: [ReservationServiceClient, SeatServiceClient, TicketServiceClient],
})
export class ClientsModule {}

