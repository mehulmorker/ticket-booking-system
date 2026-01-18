import { registerAs } from "@nestjs/config";

export default registerAs("scheduler", () => ({
  cleanupCron: process.env.SEAT_LOCK_CLEANUP_CRON || "*/2 * * * *", // Every 2 minutes
  cleanupBatchSize: parseInt(process.env.CLEANUP_BATCH_SIZE || "100", 10),
}));

