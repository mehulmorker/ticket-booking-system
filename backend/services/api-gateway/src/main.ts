import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe, Logger } from "@nestjs/common";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";
import { RateLimitService } from "./rate-limit/rate-limit.service";
import { Request, Response, NextFunction } from "express";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger("Bootstrap");

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  app.enableCors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  });

  // Get rate limit service
  const rateLimitService = app.get(RateLimitService);

  // Apply rate limiting with path exclusions
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Skip rate limiting for excluded paths
    if (rateLimitService.shouldSkipRateLimit(req.path)) {
      return next();
    }

    // Determine which limiter to use based on route and method
    let limiter;

    // Check if route is authenticated (has Authorization header)
    const isAuthenticated = !!req.headers.authorization;
    const isWriteOperation = ["POST", "PUT", "PATCH", "DELETE"].includes(
      req.method
    );
    const isPublicGet = req.method === "GET" && !isAuthenticated;

    if (isPublicGet) {
      limiter = rateLimitService.getPublicGetLimiter();
    } else if (isWriteOperation) {
      limiter = rateLimitService.getWriteLimiter();
    } else if (isAuthenticated) {
      limiter = rateLimitService.getAuthenticatedLimiter();
    } else {
      limiter = rateLimitService.getDefaultLimiter();
    }

    return limiter(req, res, next);
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`🚀 API Gateway is running on: http://localhost:${port}`);
  logger.log(`📚 Health check: http://localhost:${port}/health`);
  logger.log(`🔀 Routing configured for all services`);
}

bootstrap();
