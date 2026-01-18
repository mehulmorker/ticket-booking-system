import { registerAs } from "@nestjs/config";

export default registerAs("ses", () => {
  // Determine if we should use credentials
  // Only use credentials if AWS_ENDPOINT is explicitly set (LocalStack)
  // If AWS_ENDPOINT is not set, we're in AWS and should use IAM role
  const useCredentials = !!process.env.AWS_ENDPOINT;

  return {
    region: process.env.AWS_REGION || "us-east-1",
    // Only use endpoint for LocalStack. For AWS, let SDK use default endpoints
    endpoint: process.env.AWS_ENDPOINT || undefined,
    // Only use credentials for LocalStack (when AWS_ENDPOINT is set)
    // For AWS, use IAM role (no credentials needed - undefined means use IAM)
    accessKeyId: useCredentials
      ? process.env.AWS_ACCESS_KEY_ID || "test"
      : undefined,
    secretAccessKey: useCredentials
      ? process.env.AWS_SECRET_ACCESS_KEY || "test"
      : undefined,
    fromEmail: process.env.SES_FROM_EMAIL || "noreply@ticketbooking.com",
  };
});
