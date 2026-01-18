import { registerAs } from "@nestjs/config";

export default registerAs("sqs", () => {
  const ticketGenerationQueueUrl =
    process.env.TICKET_GENERATION_QUEUE_URL ||
    "http://localhost:4566/000000000000/ticket-generation-queue";

  // Detect if using AWS (queue URL contains amazonaws.com) or LocalStack
  const isAWS = ticketGenerationQueueUrl.includes("amazonaws.com");

  return {
    region: process.env.AWS_REGION || "us-east-1",
    // Only use endpoint for LocalStack. For AWS, let SDK use default endpoints
    endpoint:
      process.env.SQS_ENDPOINT || (isAWS ? undefined : "http://localhost:4566"),
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || (isAWS ? undefined : "test"),
    secretAccessKey:
      process.env.AWS_SECRET_ACCESS_KEY || (isAWS ? undefined : "test"),
    ticketGenerationQueueUrl,
  };
});
