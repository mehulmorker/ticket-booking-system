import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

@Injectable()
export class SqsService {
  private readonly client: SQSClient;
  private readonly logger = new Logger(SqsService.name);
  private readonly reservationExpiryQueueUrl: string;

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

    this.reservationExpiryQueueUrl =
      this.configService.get<string>("sqs.reservationExpiryQueueUrl") || "";
  }

  async sendReservationExpiryMessage(
    reservationId: string,
    expiresAt: Date
  ): Promise<void> {
    if (!this.reservationExpiryQueueUrl) {
      this.logger.warn(
        "Reservation expiry queue URL not configured, skipping message"
      );
      return;
    }

    try {
      const delaySeconds = Math.max(
        0,
        Math.floor((expiresAt.getTime() - Date.now()) / 1000)
      );

      const command = new SendMessageCommand({
        QueueUrl: this.reservationExpiryQueueUrl,
        MessageBody: JSON.stringify({
          reservationId,
          expiresAt: expiresAt.toISOString(),
          type: "RESERVATION_EXPIRY",
        }),
        DelaySeconds: Math.min(delaySeconds, 900), // SQS max delay is 15 minutes
      });

      await this.client.send(command);
      this.logger.log(`Sent expiry message for reservation ${reservationId}`);
    } catch (error) {
      this.logger.error(
        `Failed to send expiry message: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }
}
