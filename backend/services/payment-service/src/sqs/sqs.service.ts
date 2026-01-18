import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

@Injectable()
export class SqsService {
  private readonly client: SQSClient;
  private readonly logger = new Logger(SqsService.name);
  private readonly ticketGenerationQueueUrl: string;

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>("sqs.region");
    const endpoint = this.configService.get<string>("sqs.endpoint");
    const accessKeyId = this.configService.get<string>("sqs.accessKeyId");
    const secretAccessKey = this.configService.get<string>(
      "sqs.secretAccessKey"
    );

    // Build SQS client config
    const clientConfig: any = {
      region,
    };

    // Only set endpoint if provided (for LocalStack)
    if (endpoint) {
      clientConfig.endpoint = endpoint;
    }

    // Only set credentials if provided (for LocalStack)
    // For AWS, use IAM role (no credentials needed)
    if (accessKeyId && secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId,
        secretAccessKey,
      };
    }

    this.client = new SQSClient(clientConfig);

    this.ticketGenerationQueueUrl =
      this.configService.get<string>("sqs.ticketGenerationQueueUrl") || "";
  }

  async sendTicketGenerationMessage(
    reservationId: string,
    paymentId: string,
    userId: string,
    eventId?: string,
    seatIds?: string[]
  ): Promise<void> {
    if (!this.ticketGenerationQueueUrl) {
      this.logger.warn(
        "Ticket generation queue URL not configured, skipping message"
      );
      // Throw error to trigger HTTP fallback in Payment Service
      throw new Error("Ticket generation queue URL not configured");
    }

    this.logger.log(
      `Sending ticket generation message to queue: ${this.ticketGenerationQueueUrl}`
    );

    try {
      const command = new SendMessageCommand({
        QueueUrl: this.ticketGenerationQueueUrl,
        MessageBody: JSON.stringify({
          reservationId,
          paymentId,
          userId,
          eventId,
          seatIds,
          type: "TICKET_GENERATION",
        }),
      });

      await this.client.send(command);
      this.logger.log(
        `Sent ticket generation message for payment ${paymentId}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to send ticket generation message: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }
}
