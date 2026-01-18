import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { config } from "../config/config";

export class StorageStack extends cdk.Stack {
  public readonly eventImagesBucket: s3.Bucket;
  public readonly ticketsPdfBucket: s3.Bucket;
  public readonly notificationQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 Bucket for Event Images
    this.eventImagesBucket = new s3.Bucket(this, "EventImagesBucket", {
      bucketName: `${config.projectName}-${cdk.Aws.ACCOUNT_ID}-event-images`,
      versioned: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development
      autoDeleteObjects: true, // For development
      lifecycleRules: [
        {
          id: "DeleteOldImages",
          enabled: true,
          expiration: cdk.Duration.days(90), // Delete images after 90 days
        },
      ],
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
          ],
          allowedOrigins: ["*"], // Update with your frontend domain in production
          allowedHeaders: ["*"],
          maxAge: 3000,
        },
      ],
    });

    // S3 Bucket for Tickets PDF
    this.ticketsPdfBucket = new s3.Bucket(this, "TicketsPdfBucket", {
      bucketName: `${config.projectName}-${cdk.Aws.ACCOUNT_ID}-tickets-pdf`,
      versioned: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development
      autoDeleteObjects: true, // For development
      lifecycleRules: [
        {
          id: "DeleteOldTickets",
          enabled: true,
          expiration: cdk.Duration.days(30), // Delete tickets after 30 days
        },
      ],
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT],
          allowedOrigins: ["*"], // Update with your frontend domain in production
          allowedHeaders: ["*"],
          maxAge: 3000,
        },
      ],
    });

    // SQS Queue for Notifications (Dead Letter Queue)
    const notificationDlq = new sqs.Queue(this, "NotificationDLQ", {
      queueName: `${config.projectName}-notification-dlq`,
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    });

    // SQS Queue for Notifications
    this.notificationQueue = new sqs.Queue(this, "NotificationQueue", {
      queueName: `${config.projectName}-notification-queue`,
      visibilityTimeout: cdk.Duration.seconds(300), // 5 minutes
      receiveMessageWaitTime: cdk.Duration.seconds(20), // Long polling
      retentionPeriod: cdk.Duration.days(4),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      deadLetterQueue: {
        queue: notificationDlq,
        maxReceiveCount: 3, // Retry 3 times before moving to DLQ
      },
    });

    // Outputs
    new cdk.CfnOutput(this, "EventImagesBucketName", {
      value: this.eventImagesBucket.bucketName,
      description: "Event images S3 bucket name",
      exportName: `${config.projectName}-event-images-bucket`,
    });

    new cdk.CfnOutput(this, "TicketsPdfBucketName", {
      value: this.ticketsPdfBucket.bucketName,
      description: "Tickets PDF S3 bucket name",
      exportName: `${config.projectName}-tickets-pdf-bucket`,
    });

    new cdk.CfnOutput(this, "NotificationQueueUrl", {
      value: this.notificationQueue.queueUrl,
      description: "Notification SQS queue URL",
      exportName: `${config.projectName}-notification-queue-url`,
    });

    new cdk.CfnOutput(this, "NotificationQueueArn", {
      value: this.notificationQueue.queueArn,
      description: "Notification SQS queue ARN",
      exportName: `${config.projectName}-notification-queue-arn`,
    });

    new cdk.CfnOutput(this, "NotificationDLQUrl", {
      value: notificationDlq.queueUrl,
      description: "Notification DLQ URL",
      exportName: `${config.projectName}-notification-dlq-url`,
    });
  }
}

