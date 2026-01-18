import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule } from "@nestjs/config";
import { GatewayController } from "./gateway.controller";
import { ProxyService } from "./services/proxy.service";
import { HealthService } from "./services/health.service";
import { AuthModule } from "../auth/auth.module";
import { RateLimitModule } from "../rate-limit/rate-limit.module";
import servicesConfig from "../config/services.config";
import jwtConfig from "../config/jwt.config";
import rateLimitConfig from "../config/rate-limit.config";
import redisConfig from "../config/redis.config";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [servicesConfig, jwtConfig, rateLimitConfig, redisConfig],
    }),
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
    AuthModule,
    RateLimitModule,
  ],
  controllers: [GatewayController],
  providers: [ProxyService, HealthService],
})
export class GatewayModule {}
