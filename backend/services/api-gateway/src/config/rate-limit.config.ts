import { registerAs } from "@nestjs/config";

// Environment-based defaults
const getEnvDefault = () => {
  const env = process.env.NODE_ENV || "development";
  if (env === "production") {
    return {
      windowMs: 900000, // 15 minutes
      max: 100, // 100 requests per window
    };
  } else if (env === "staging") {
    return {
      windowMs: 900000, // 15 minutes
      max: 300, // 300 requests per window
    };
  } else {
    // development
    return {
      windowMs: 900000, // 15 minutes
      max: 1000, // 1000 requests per window
    };
  }
};

const envDefaults = getEnvDefault();

export default registerAs("rateLimit", () => ({
  // Global defaults (can be overridden by environment)
  windowMs: parseInt(
    process.env.RATE_LIMIT_WINDOW_MS || String(envDefaults.windowMs),
    10
  ),
  max: parseInt(process.env.RATE_LIMIT_MAX || String(envDefaults.max), 10),

  // Route-specific limits
  publicGet: parseInt(process.env.RATE_LIMIT_PUBLIC_GET || "200", 10), // Public GET endpoints
  authenticated: parseInt(process.env.RATE_LIMIT_AUTHENTICATED || "150", 10), // Authenticated endpoints
  writeOperations: parseInt(process.env.RATE_LIMIT_WRITE || "50", 10), // POST/PUT/DELETE
  admin: parseInt(process.env.RATE_LIMIT_ADMIN || "300", 10), // Admin endpoints

  // Redis configuration
  useRedis: process.env.RATE_LIMIT_USE_REDIS === "true",
  redisPrefix: process.env.RATE_LIMIT_REDIS_PREFIX || "rate-limit:",

  // Skip rate limiting for these paths
  skipPaths: [
    "/health",
    "/",
    ...(process.env.RATE_LIMIT_SKIP_PATHS?.split(",") || []),
  ],
}));
