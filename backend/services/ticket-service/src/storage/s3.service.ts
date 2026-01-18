import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3: S3Client;
  private readonly bucketName: string;

  constructor(private readonly configService: ConfigService) {
    const s3Config = this.configService.get("s3");
    this.bucketName = s3Config.bucketName;

    // Build S3 client config
    const clientConfig: any = {
      region: s3Config.region,
    };

    // Only set endpoint if provided (for LocalStack)
    if (s3Config.endpoint) {
      clientConfig.endpoint = s3Config.endpoint;
      clientConfig.forcePathStyle = true; // Required for LocalStack
      this.logger.log(`S3 configured for LocalStack: ${s3Config.endpoint}`);
    } else {
      this.logger.log(`S3 configured for AWS (using IAM role)`);
    }

    // Only set credentials if explicitly provided (for LocalStack)
    // For AWS, use IAM role (no credentials needed)
    // Check for undefined explicitly, not just truthy (undefined means use IAM)
    if (
      s3Config.accessKeyId !== undefined &&
      s3Config.secretAccessKey !== undefined &&
      s3Config.accessKeyId !== null &&
      s3Config.secretAccessKey !== null
    ) {
      clientConfig.credentials = {
        accessKeyId: s3Config.accessKeyId,
        secretAccessKey: s3Config.secretAccessKey,
      };
      this.logger.warn(
        `S3 using explicit credentials (LocalStack mode). Bucket: ${this.bucketName}`
      );
    } else {
      this.logger.log(
        `S3 using IAM role (AWS mode). Bucket: ${this.bucketName}`
      );
    }

    this.s3 = new S3Client(clientConfig);
  }

  async uploadTicketPdf(pdfBuffer: Buffer, ticketId: string): Promise<string> {
    const key = `tickets/${ticketId}-${uuidv4()}.pdf`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: pdfBuffer,
        ContentType: "application/pdf",
      })
    );

    this.logger.log(`Uploaded ticket PDF to S3: ${key}`);
    return key;
  }

  async fileExists(key: string): Promise<boolean> {
    try {
      await this.s3.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        })
      );
      return true;
    } catch (error: any) {
      if (
        error.name === "NotFound" ||
        error.$metadata?.httpStatusCode === 404
      ) {
        return false;
      }
      // For other errors, log and return false
      this.logger.warn(
        `Error checking file existence for key ${key}: ${error.message}`
      );
      return false;
    }
  }

  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const url = await getSignedUrl(this.s3, command, {
      expiresIn: expiresInSeconds,
    });

    // For LocalStack only: Replace Docker service name with localhost for browser access
    // This is needed because browsers can't resolve Docker service names
    // The internal endpoint uses 'localstack:4566' but browsers need 'localhost:4566'
    // For AWS, the URL is already correct (uses S3 endpoint)
    if (url.includes("localstack:4566")) {
      return url.replace(/http:\/\/localstack:4566/g, "http://localhost:4566");
    }

    return url;
  }

  async deleteTicketPdf(s3Key: string): Promise<void> {
    try {
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: s3Key,
        })
      );
      this.logger.log(`Deleted ticket PDF from S3: ${s3Key}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete ticket PDF from S3: ${error.message}`,
        error.stack
      );
      // Don't throw - file might not exist
    }
  }
}
