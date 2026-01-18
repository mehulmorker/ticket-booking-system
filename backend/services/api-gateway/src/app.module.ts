import { Module } from "@nestjs/common";
import { GatewayModule } from "./gateway/gateway.module";
import { RateLimitModule } from "./rate-limit/rate-limit.module";
import { AppController } from "./app.controller";

@Module({
  imports: [GatewayModule, RateLimitModule],
  controllers: [AppController],
})
export class AppModule {}
