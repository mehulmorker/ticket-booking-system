import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  Message,
} from "@aws-sdk/client-sqs";

@Injectable()
export class SqsService {
  private readonly client: SQSClient;
  private readonly logger = new Logger(SqsService.name);
  private readonly queueUrl: string;

  constructor(private readonly configService: ConfigService) {
    const sqsConfig = this.configService.get("sqs");
    const region = sqsConfig.region;
    const endpoint = sqsConfig.endpoint;
    const accessKeyId = sqsConfig.accessKeyId;
    const secretAccessKey = sqsConfig.secretAccessKey;

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
    this.queueUrl = sqsConfig.queueUrl;
  }

  async receiveMessages(maxMessages = 10): Promise<Message[]> {
    if (!this.queueUrl) {
      this.logger.warn("SQS queue URL not configured");
      return [];
    }

    try {
      const command = new ReceiveMessageCommand({
        QueueUrl: this.queueUrl,
        MaxNumberOfMessages: maxMessages,
        WaitTimeSeconds: 20,
        VisibilityTimeout: 30,
      });

      const response = await this.client.send(command);
      return response.Messages || [];
    } catch (error) {
      this.logger.error(
        `Failed to receive SQS messages: ${error.message}`,
        error.stack
      );
      return [];
    }
  }

  async deleteMessage(receiptHandle: string): Promise<void> {
    if (!this.queueUrl) {
      return;
    }

    try {
      const command = new DeleteMessageCommand({
        QueueUrl: this.queueUrl,
        ReceiptHandle: receiptHandle,
      });

      await this.client.send(command);
      this.logger.log(
        `Deleted SQS message: ${receiptHandle.substring(0, 20)}...`
      );
    } catch (error) {
      this.logger.error(
        `Failed to delete SQS message: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }
}
