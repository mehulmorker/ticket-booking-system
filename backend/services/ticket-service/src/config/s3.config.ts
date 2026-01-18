import { registerAs } from "@nestjs/config";

export default registerAs("s3", () => {
  const bucketName =
    process.env.S3_TICKETS_BUCKET ||
    process.env.S3_BUCKET_NAME ||
    "ticket-bucket";

  // Detect if using AWS (bucket name contains account ID pattern or AWS_REGION is set)
  // AWS bucket names in our setup: ticket-booking-{ACCOUNT_ID}-tickets-pdf
  // LocalStack bucket names: ticket-bucket or ticket-booking-tickets-pdf (no account ID)
  const hasAccountId = bucketName.match(/\d{12}/); // AWS account IDs are 12 digits
  const isAWS =
    hasAccountId ||
    (process.env.AWS_REGION && !process.env.AWS_ENDPOINT) ||
    (!bucketName.includes("localhost") &&
      !bucketName.includes("localstack") &&
      process.env.AWS_REGION);

  // Determine if we should use credentials
  // Only use credentials if AWS_ENDPOINT is explicitly set (LocalStack)
  // If AWS_ENDPOINT is not set, we're in AWS and should use IAM role
  const useCredentials = !!process.env.AWS_ENDPOINT;

  return {
    region: process.env.AWS_REGION || "us-east-1",
    // Only use endpoint for LocalStack. For AWS, let SDK use default endpoints
    endpoint:
      process.env.AWS_ENDPOINT || (isAWS ? undefined : "http://localhost:4566"),
    bucketName,
    // Only use credentials for LocalStack (when AWS_ENDPOINT is set)
    // For AWS, use IAM role (no credentials needed - undefined means use IAM)
    accessKeyId: useCredentials
      ? process.env.AWS_ACCESS_KEY_ID || "test"
      : undefined,
    secretAccessKey: useCredentials
      ? process.env.AWS_SECRET_ACCESS_KEY || "test"
      : undefined,
  };
});
