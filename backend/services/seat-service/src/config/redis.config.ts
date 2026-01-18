import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  ttlSeconds: parseInt(process.env.SEAT_LOCK_TTL || '300', 10),
  prefix: process.env.REDIS_PREFIX || 'seat-service:',
}));
