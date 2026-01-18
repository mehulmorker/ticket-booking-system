import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { SqsService } from "../../sqs/sqs.service";
import { NotificationsService } from "../notifications.service";

@Injectable()
export class NotificationConsumerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(NotificationConsumerService.name);
  private isRunning = false;
  private pollingInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly sqsService: SqsService,
    private readonly notificationsService: NotificationsService
  ) {}

  onModuleInit() {
    this.logger.log("Starting SQS consumer for notifications");
    this.startPolling();
  }

  onModuleDestroy() {
    this.stopPolling();
  }

  private startPolling() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.pollMessages();
  }

  private stopPolling() {
    this.isRunning = false;
    if (this.pollingInterval) {
      clearTimeout(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.logger.log("Stopped SQS consumer");
  }

  private async pollMessages() {
    if (!this.isRunning) {
      return;
    }

    try {
      const messages = await this.sqsService.receiveMessages(10);

      for (const message of messages) {
        if (!message.Body || !message.ReceiptHandle) {
          continue;
        }

        try {
          const messageBody = JSON.parse(message.Body);
          await this.processMessage(messageBody);

          if (message.ReceiptHandle) {
            await this.sqsService.deleteMessage(message.ReceiptHandle);
          }
        } catch (error) {
          this.logger.error(
            `Failed to process notification message: ${error.message}`,
            error.stack
          );
        }
      }
    } catch (error) {
      this.logger.error(`Error polling SQS: ${error.message}`, error.stack);
    }

    if (this.isRunning) {
      this.pollingInterval = setTimeout(() => this.pollMessages(), 5000);
    }
  }

  private async processMessage(messageBody: any): Promise<void> {
    if (messageBody.type !== "NOTIFICATION") {
      this.logger.warn(`Unknown message type: ${messageBody.type}`);
      return;
    }

    const { userId, notificationType, event, recipient, data } = messageBody;

    if (!userId || !notificationType || !event || !recipient) {
      this.logger.error("Invalid message: missing required fields");
      return;
    }

    this.logger.log(
      `Processing notification: ${event} via ${notificationType} to ${recipient}`
    );

    try {
      await this.notificationsService.sendNotification({
        userId,
        type: notificationType,
        event,
        recipient,
        data: data || {},
      });

      this.logger.log(`Successfully sent notification for user ${userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to send notification: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }
}

