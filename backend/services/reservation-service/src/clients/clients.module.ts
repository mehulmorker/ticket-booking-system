import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { SeatServiceClient } from "./seat-client.service";

@Module({
  imports: [HttpModule],
  providers: [SeatServiceClient],
  exports: [SeatServiceClient],
})
export class ClientsModule {}

