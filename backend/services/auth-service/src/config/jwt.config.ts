import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
  expiresIn: process.env.JWT_EXPIRATION || '24h',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRATION || '7d',
}));

