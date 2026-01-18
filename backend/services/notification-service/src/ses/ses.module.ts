import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { SesService } from "./ses.service";

@Module({
  imports: [ConfigModule],
  providers: [SesService],
  exports: [SesService],
})
export class SesModule {}

