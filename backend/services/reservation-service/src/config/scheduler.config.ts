import { registerAs } from "@nestjs/config";

export default registerAs("scheduler", () => ({
  cleanupCron: process.env.RESERVATION_EXPIRY_CLEANUP_CRON || "*/1 * * * *", // Every 1 minute
  cleanupBatchSize: parseInt(process.env.CLEANUP_BATCH_SIZE || "100", 10),
}));
