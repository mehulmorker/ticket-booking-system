import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  SNSClient,
  PublishCommand,
  PublishCommandInput,
} from "@aws-sdk/client-sns";

@Injectable()
export class SnsService {
  private readonly logger = new Logger(SnsService.name);
  private readonly client: SNSClient;

  constructor(private readonly configService: ConfigService) {
    const snsConfig = this.configService.get("sns");
    const region = snsConfig.region;
    const endpoint = snsConfig.endpoint;
    const accessKeyId = snsConfig.accessKeyId;
    const secretAccessKey = snsConfig.secretAccessKey;

    this.client = new SNSClient({
      region,
      endpoint,
      credentials: {
        accessKeyId: accessKeyId || "test",
        secretAccessKey: secretAccessKey || "test",
      },
    });
  }

  async sendSms(phoneNumber: string, message: string): Promise<string> {
    try {
      const params: PublishCommandInput = {
        PhoneNumber: phoneNumber,
        Message: message,
      };

      const command = new PublishCommand(params);
      const response = await this.client.send(command);

      this.logger.log(`SMS sent to ${phoneNumber}, MessageId: ${response.MessageId}`);
      return response.MessageId || "";
    } catch (error) {
      this.logger.error(
        `Failed to send SMS to ${phoneNumber}: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }
}

