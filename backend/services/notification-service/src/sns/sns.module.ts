import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { SnsService } from "./sns.service";

@Module({
  imports: [ConfigModule],
  providers: [SnsService],
  exports: [SnsService],
})
export class SnsModule {}

