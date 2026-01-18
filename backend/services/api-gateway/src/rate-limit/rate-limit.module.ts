import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { RateLimitService } from "./rate-limit.service";
import redisConfig from "../config/redis.config";
import rateLimitConfig from "../config/rate-limit.config";

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [redisConfig, rateLimitConfig],
    }),
  ],
  providers: [RateLimitService],
  exports: [RateLimitService],
})
export class RateLimitModule {}
