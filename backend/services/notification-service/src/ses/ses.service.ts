import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  SESClient,
  SendEmailCommand,
  SendEmailCommandInput,
} from "@aws-sdk/client-ses";

@Injectable()
export class SesService {
  private readonly logger = new Logger(SesService.name);
  private readonly client: SESClient;
  private readonly fromEmail: string;

  constructor(private readonly configService: ConfigService) {
    const sesConfig = this.configService.get("ses");
    this.fromEmail = sesConfig.fromEmail;

    // Build SES client config
    const clientConfig: any = {
      region: sesConfig.region,
    };

    // Only set endpoint if provided (for LocalStack)
    if (sesConfig.endpoint) {
      clientConfig.endpoint = sesConfig.endpoint;
      this.logger.log(`SES configured for LocalStack: ${sesConfig.endpoint}`);
    } else {
      this.logger.log(`SES configured for AWS (using IAM role)`);
    }

    // Only set credentials if explicitly provided (for LocalStack)
    // For AWS, use IAM role (no credentials needed)
    // Check for undefined explicitly, not just truthy (undefined means use IAM)
    if (
      sesConfig.accessKeyId !== undefined &&
      sesConfig.secretAccessKey !== undefined &&
      sesConfig.accessKeyId !== null &&
      sesConfig.secretAccessKey !== null
    ) {
      clientConfig.credentials = {
        accessKeyId: sesConfig.accessKeyId,
        secretAccessKey: sesConfig.secretAccessKey,
      };
      this.logger.warn(
        `SES using explicit credentials (LocalStack mode). From: ${this.fromEmail}`
      );
    } else {
      this.logger.log(`SES using IAM role (AWS mode). From: ${this.fromEmail}`);
    }

    this.client = new SESClient(clientConfig);
  }

  async sendEmail(
    to: string,
    subject: string,
    body: string,
    htmlBody?: string
  ): Promise<string> {
    try {
      const params: SendEmailCommandInput = {
        Source: this.fromEmail,
        Destination: {
          ToAddresses: [to],
        },
        Message: {
          Subject: {
            Data: subject,
            Charset: "UTF-8",
          },
          Body: {
            Text: {
              Data: body,
              Charset: "UTF-8",
            },
            ...(htmlBody && {
              Html: {
                Data: htmlBody,
                Charset: "UTF-8",
              },
            }),
          },
        },
      };

      const command = new SendEmailCommand(params);
      const response = await this.client.send(command);

      this.logger.log(`Email sent to ${to}, MessageId: ${response.MessageId}`);
      return response.MessageId || "";
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${to}: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }
}
