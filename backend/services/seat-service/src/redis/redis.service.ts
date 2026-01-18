import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Redis } from "ioredis";

@Injectable()
export class RedisService {
  private readonly client: Redis;
  private readonly logger = new Logger(RedisService.name);
  private readonly ttlSeconds: number;
  private readonly prefix: string;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>("redis.host");
    const port = this.configService.get<number>("redis.port");
    const password = this.configService.get<string>("redis.password");

    this.ttlSeconds = this.configService.get<number>("redis.ttlSeconds", 300);
    this.prefix = this.configService.get<string>(
      "redis.prefix",
      "seat-service:"
    );

    this.client = new Redis({
      host,
      port,
      password,
    });

    this.client.on("error", (err) => {
      this.logger.error(`Redis error: ${err.message}`);
    });
  }

  private key(key: string): string {
    return `${this.prefix}${key}`;
  }

  async acquireLock(
    key: string,
    ownerId: string,
    ttlSeconds?: number
  ): Promise<boolean> {
    const ttl = ttlSeconds || this.ttlSeconds;
    const result = await this.client.set(
      this.key(key),
      ownerId,
      "EX",
      ttl,
      "NX"
    );

    return result === "OK";
  }

  async releaseLock(key: string, ownerId: string): Promise<boolean> {
    const fullKey = this.key(key);
    const currentOwner = await this.client.get(fullKey);

    if (currentOwner !== ownerId) {
      return false;
    }

    await this.client.del(fullKey);
    return true;
  }

  async extendLock(
    key: string,
    ownerId: string,
    ttlSeconds?: number
  ): Promise<boolean> {
    const fullKey = this.key(key);
    const currentOwner = await this.client.get(fullKey);

    if (currentOwner !== ownerId) {
      return false;
    }

    const ttl = ttlSeconds || this.ttlSeconds;
    await this.client.expire(fullKey, ttl);
    return true;
  }

  async isLocked(key: string): Promise<boolean> {
    const exists = await this.client.exists(this.key(key));
    return exists === 1;
  }
}
