import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import rateLimit, { RateLimitRequestHandler, Store } from "express-rate-limit";
import { Redis } from "ioredis";

/**
 * Custom Redis store adapter for ioredis
 * Implements the Store interface required by express-rate-limit
 */
class IORedisStore implements Store {
  private readonly client: Redis;
  readonly prefix: string;
  private windowMs: number = 900000; // Default 15 minutes

  constructor(client: Redis, prefix: string) {
    this.client = client;
    this.prefix = prefix;
  }

  setWindowMs(windowMs: number): void {
    this.windowMs = windowMs;
  }

  async increment(
    key: string
  ): Promise<{ totalHits: number; resetTime: Date }> {
    const fullKey = `${this.prefix}${key}`;

    // Use pipeline for atomic operations
    const pipeline = this.client.pipeline();
    pipeline.incr(fullKey);
    pipeline.expire(fullKey, Math.ceil(this.windowMs / 1000));
    const results = await pipeline.exec();

    if (!results || results.length === 0) {
      throw new Error("Redis pipeline execution failed");
    }

    const count = results[0][1] as number;
    const resetTime = new Date(Date.now() + this.windowMs);

    return {
      totalHits: count,
      resetTime,
    };
  }

  async decrement(key: string): Promise<void> {
    const fullKey = `${this.prefix}${key}`;
    await this.client.decr(fullKey);
  }

  async resetKey(key: string): Promise<void> {
    const fullKey = `${this.prefix}${key}`;
    await this.client.del(fullKey);
  }

  async shutdown(): Promise<void> {
    // Connection cleanup handled by service
  }
}

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);
  private redisClient: Redis | null = null;

  constructor(private readonly configService: ConfigService) {
    // Initialize Redis if enabled
    if (this.configService.get<boolean>("rateLimit.useRedis")) {
      this.initializeRedis();
    }
  }

  private initializeRedis() {
    try {
      const host = this.configService.get<string>("redis.host", "localhost");
      const port = this.configService.get<number>("redis.port", 6379);
      const password = this.configService.get<string>("redis.password");

      this.redisClient = new Redis({
        host,
        port,
        password,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
      });

      this.redisClient.on("error", (err) => {
        this.logger.error(`Redis connection error: ${err.message}`);
        // Fallback to in-memory if Redis fails
        this.redisClient = null;
      });

      this.redisClient.on("connect", () => {
        this.logger.log(`Redis connected for rate limiting at ${host}:${port}`);
      });

      this.redisClient.on("ready", () => {
        this.logger.log("Redis ready for rate limiting");
      });
    } catch (error: any) {
      this.logger.warn(
        `Failed to initialize Redis for rate limiting: ${error.message}. Falling back to in-memory storage.`
      );
      this.redisClient = null;
    }
  }

  /**
   * Create a rate limiter with custom configuration
   */
  createLimiter(options: {
    windowMs: number;
    max: number;
    message?: string;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
  }): RateLimitRequestHandler {
    // Create Redis store if Redis is enabled and connected
    let store: Store | undefined = undefined;
    if (this.redisClient) {
      try {
        const prefix = this.configService.get<string>(
          "rateLimit.redisPrefix",
          "rate-limit:"
        );
        const redisStore = new IORedisStore(this.redisClient, prefix);
        redisStore.setWindowMs(options.windowMs);
        store = redisStore;
      } catch (error: any) {
        this.logger.warn(
          `Failed to create Redis store, falling back to in-memory: ${error.message}`
        );
        store = undefined;
      }
    }

    const limiterConfig: any = {
      windowMs: options.windowMs,
      max: options.max,
      message: options.message || "Too many requests, please try again later.",
      standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
      legacyHeaders: false, // Disable `X-RateLimit-*` headers
      skipSuccessfulRequests: options.skipSuccessfulRequests || false,
      skipFailedRequests: options.skipFailedRequests || false,
    };

    // Only add store if Redis is available
    if (store) {
      limiterConfig.store = store;
    }

    return rateLimit(limiterConfig);
  }

  /**
   * Get default rate limiter (for general use)
   */
  getDefaultLimiter(): RateLimitRequestHandler {
    const windowMs = this.configService.get<number>(
      "rateLimit.windowMs",
      900000
    );
    const max = this.configService.get<number>("rateLimit.max", 100);

    return this.createLimiter({
      windowMs,
      max,
      message: "Too many requests from this IP, please try again later.",
    });
  }

  /**
   * Get rate limiter for public GET endpoints
   */
  getPublicGetLimiter(): RateLimitRequestHandler {
    const windowMs = this.configService.get<number>(
      "rateLimit.windowMs",
      900000
    );
    const max = this.configService.get<number>("rateLimit.publicGet", 200);

    return this.createLimiter({
      windowMs,
      max,
      message: "Too many requests, please try again later.",
    });
  }

  /**
   * Get rate limiter for authenticated endpoints
   */
  getAuthenticatedLimiter(): RateLimitRequestHandler {
    const windowMs = this.configService.get<number>(
      "rateLimit.windowMs",
      900000
    );
    const max = this.configService.get<number>("rateLimit.authenticated", 150);

    return this.createLimiter({
      windowMs,
      max,
      message: "Too many requests, please try again later.",
    });
  }

  /**
   * Get rate limiter for write operations (POST/PUT/DELETE)
   */
  getWriteLimiter(): RateLimitRequestHandler {
    const windowMs = this.configService.get<number>(
      "rateLimit.windowMs",
      900000
    );
    const max = this.configService.get<number>("rateLimit.writeOperations", 50);

    return this.createLimiter({
      windowMs,
      max,
      message: "Too many write requests, please try again later.",
      skipFailedRequests: true, // Don't count failed requests
    });
  }

  /**
   * Get rate limiter for admin endpoints
   */
  getAdminLimiter(): RateLimitRequestHandler {
    const windowMs = this.configService.get<number>(
      "rateLimit.windowMs",
      900000
    );
    const max = this.configService.get<number>("rateLimit.admin", 300);

    return this.createLimiter({
      windowMs,
      max,
      message: "Too many requests, please try again later.",
    });
  }

  /**
   * Check if a path should skip rate limiting
   */
  shouldSkipRateLimit(path: string): boolean {
    const skipPaths = this.configService.get<string[]>("rateLimit.skipPaths", [
      "/health",
      "/",
    ]);

    return skipPaths.some((skipPath) => path.startsWith(skipPath));
  }

  /**
   * Cleanup Redis connection
   */
  async onModuleDestroy() {
    if (this.redisClient) {
      await this.redisClient.quit();
      this.logger.log("Redis connection closed for rate limiting");
    }
  }
}
