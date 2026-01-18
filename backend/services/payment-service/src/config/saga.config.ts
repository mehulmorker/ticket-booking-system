import { registerAs } from "@nestjs/config";

export default registerAs("saga", () => ({
  // Saga execution timeout (minutes)
  executionTimeoutMinutes:
    parseInt(process.env.SAGA_EXECUTION_TIMEOUT_MINUTES || "30", 10) || 30,

  // Recovery job configuration
  recoveryEnabled: process.env.SAGA_RECOVERY_ENABLED !== "false",
  recoveryCron: process.env.SAGA_RECOVERY_CRON || "*/5 * * * *", // Every 5 minutes

  // Default retry configuration
  defaultMaxRetries:
    parseInt(process.env.SAGA_DEFAULT_MAX_RETRIES || "3", 10) || 3,
  retryDelayBase:
    parseInt(process.env.SAGA_RETRY_DELAY_BASE || "1000", 10) || 1000, // milliseconds
}));

