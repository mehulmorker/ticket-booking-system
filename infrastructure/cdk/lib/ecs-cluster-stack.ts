import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as rds from "aws-cdk-lib/aws-rds";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { config } from "../config/config";

interface EcsClusterStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  ecsSecurityGroup: ec2.SecurityGroup;
  albSecurityGroup: ec2.SecurityGroup;
  rdsSecurityGroup: ec2.SecurityGroup;
  redisSecurityGroup: ec2.SecurityGroup;
  databases: { [key: string]: rds.DatabaseInstance };
  redisHost: string;
  eventImagesBucket: s3.Bucket;
  ticketsPdfBucket: s3.Bucket;
  notificationQueue: sqs.Queue;
}

export class EcsClusterStack extends cdk.Stack {
  public readonly cluster: ecs.Cluster;
  public readonly taskDefinitions: { [key: string]: ecs.FargateTaskDefinition };

  constructor(scope: Construct, id: string, props: EcsClusterStackProps) {
    super(scope, id, props);

    const {
      vpc,
      ecsSecurityGroup,
      databases,
      redisHost,
      eventImagesBucket,
      ticketsPdfBucket,
      notificationQueue,
    } = props;

    // Create ECS Cluster
    this.cluster = new ecs.Cluster(this, "EcsCluster", {
      vpc,
      clusterName: `${config.projectName}-cluster`,
      containerInsights: false, // Cost optimization
    });

    // Create IAM Role for ECS Task Execution
    const taskExecutionRole = new iam.Role(this, "EcsTaskExecutionRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AmazonECSTaskExecutionRolePolicy"
        ),
      ],
    });

    // Add Secrets Manager permissions
    taskExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret",
        ],
        resources: [
          `arn:aws:secretsmanager:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:secret:${config.projectName}/*`,
        ],
      })
    );

    // Create IAM Role for ECS Tasks (application permissions)
    const taskRole = new iam.Role(this, "EcsTaskRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });

    // Add S3 permissions
    eventImagesBucket.grantReadWrite(taskRole);
    ticketsPdfBucket.grantReadWrite(taskRole);

    // Add SQS permissions
    notificationQueue.grantSendMessages(taskRole);
    notificationQueue.grantConsumeMessages(taskRole);

    // Add SES permissions
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["ses:SendEmail", "ses:SendRawEmail"],
        resources: ["*"],
      })
    );

    // Services configuration
    const services = [
      { name: "auth", port: 3001, hasDatabase: true },
      { name: "event", port: 3002, hasDatabase: true },
      { name: "seat", port: 3003, hasDatabase: true },
      { name: "reservation", port: 3004, hasDatabase: true },
      { name: "payment", port: 3005, hasDatabase: true },
      { name: "ticket", port: 3006, hasDatabase: true },
      { name: "notification", port: 3007, hasDatabase: true },
      { name: "api-gateway", port: 3000, hasDatabase: false },
    ];

    this.taskDefinitions = {};

    // Create task definitions for each service
    services.forEach((service) => {
      const taskDef = new ecs.FargateTaskDefinition(
        this,
        `${service.name}TaskDef`,
        {
          family: `${config.projectName}-${service.name}`,
          cpu: config.ecs.cpu,
          memoryLimitMiB: config.ecs.memoryLimitMiB,
          taskRole,
          executionRole: taskExecutionRole,
        }
      );

      // Environment variables (common to all services)
      const environment: { [key: string]: string } = {
        NODE_ENV: "production",
        PORT: service.port.toString(),
        REDIS_HOST: redisHost,
        REDIS_PORT: "6379",
      };

      // Add service-specific environment variables
      if (service.hasDatabase && databases[service.name]) {
        environment.DB_HOST = databases[service.name].dbInstanceEndpointAddress;
        environment.DB_PORT = "5432";
        environment.DB_NAME = `${service.name}_db`;
        environment.DB_USER = "postgres";
      }

      // Add S3 configuration for services that need it
      if (service.name === "event" || service.name === "ticket") {
        environment.AWS_REGION = cdk.Aws.REGION;
        if (service.name === "event") {
          environment.S3_BUCKET = eventImagesBucket.bucketName;
        }
        if (service.name === "ticket") {
          environment.S3_BUCKET = ticketsPdfBucket.bucketName;
        }
      }

      // Add SQS configuration for ticket and notification services
      if (service.name === "ticket" || service.name === "notification") {
        environment.SQS_QUEUE_URL = notificationQueue.queueUrl;
        environment.AWS_REGION = cdk.Aws.REGION;
      }

      // Add SES configuration for notification service
      if (service.name === "notification") {
        environment.SES_FROM_EMAIL = config.ses.verifiedEmail;
        environment.AWS_REGION = cdk.Aws.REGION;
      }

      // Secrets (database password, Redis password, JWT secret)
      const secrets: { [key: string]: ecs.Secret } = {};

      if (service.hasDatabase && databases[service.name]) {
        secrets.DB_PASSWORD = ecs.Secret.fromSecretsManager(
          databases[service.name].secret!,
          "password"
        );
      }

      // Add container
      taskDef.addContainer(service.name, {
        image: ecs.ContainerImage.fromRegistry(
          `${cdk.Aws.ACCOUNT_ID}.dkr.ecr.${cdk.Aws.REGION}.amazonaws.com/${config.projectName}-${service.name}:latest`
        ),
        logging: ecs.LogDrivers.awsLogs({
          streamPrefix: service.name,
          logRetention: logs.RetentionDays.ONE_WEEK,
        }),
        environment,
        secrets,
        portMappings: [
          {
            containerPort: service.port,
            protocol: ecs.Protocol.TCP,
          },
        ],
        healthCheck: {
          command: [
            "CMD-SHELL",
            `curl -f http://localhost:${service.port}/health || exit 1`,
          ],
          interval: cdk.Duration.seconds(30),
          timeout: cdk.Duration.seconds(5),
          retries: 3,
          startPeriod: cdk.Duration.seconds(60),
        },
      });

      this.taskDefinitions[service.name] = taskDef;

      // Output
      new cdk.CfnOutput(this, `${service.name}TaskDefArn`, {
        value: taskDef.taskDefinitionArn,
        description: `${service.name} task definition ARN`,
        exportName: `${config.projectName}-${service.name}-taskdef-arn`,
      });
    });

    // Outputs
    new cdk.CfnOutput(this, "ClusterName", {
      value: this.cluster.clusterName,
      description: "ECS Cluster name",
      exportName: `${config.projectName}-cluster-name`,
    });

    new cdk.CfnOutput(this, "ClusterArn", {
      value: this.cluster.clusterArn,
      description: "ECS Cluster ARN",
      exportName: `${config.projectName}-cluster-arn`,
    });
  }
}

