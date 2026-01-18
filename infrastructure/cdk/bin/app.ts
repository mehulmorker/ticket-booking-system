#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { config } from "../config/config";
import { VpcStack } from "../lib/vpc-stack";
import { DatabaseStack } from "../lib/database-stack";
import { StorageStack } from "../lib/storage-stack";
import { EcsClusterStack } from "../lib/ecs-cluster-stack";
import { EcsServicesStack } from "../lib/ecs-services-stack";
import { FrontendStack } from "../lib/frontend-stack";

const app = new cdk.App();

const env = {
  account: config.environment.account,
  region: config.environment.region,
};

// Apply tags to all stacks
Object.entries(config.tags).forEach(([key, value]) => {
  cdk.Tags.of(app).add(key, value);
});

// 1. VPC and Networking
const vpcStack = new VpcStack(app, "TicketBookingVpcStack", {
  env,
  description:
    "VPC, subnets, NAT Gateway, and VPC endpoints for Ticket Booking platform",
});

// 2. Databases (RDS PostgreSQL + Redis ECS Task)
const databaseStack = new DatabaseStack(app, "TicketBookingDatabaseStack", {
  env,
  description: "RDS PostgreSQL databases and Redis ECS task",
  vpc: vpcStack.vpc,
  ecsSecurityGroup: vpcStack.ecsSecurityGroup,
});
databaseStack.addDependency(vpcStack);

// 3. Storage (S3 buckets, SQS queues)
const storageStack = new StorageStack(app, "TicketBookingStorageStack", {
  env,
  description: "S3 buckets and SQS queues for Ticket Booking platform",
});
storageStack.addDependency(vpcStack);

// 4. ECS Cluster and Task Definitions
const ecsClusterStack = new EcsClusterStack(app, "TicketBookingEcsStack", {
  env,
  description: "ECS Fargate cluster and task definitions",
  vpc: vpcStack.vpc,
  ecsSecurityGroup: vpcStack.ecsSecurityGroup,
  albSecurityGroup: vpcStack.albSecurityGroup,
  rdsSecurityGroup: databaseStack.rdsSecurityGroup,
  redisSecurityGroup: databaseStack.redisSecurityGroup,
  databases: databaseStack.databases,
  redisHost: databaseStack.redisHost,
  eventImagesBucket: storageStack.eventImagesBucket,
  ticketsPdfBucket: storageStack.ticketsPdfBucket,
  notificationQueue: storageStack.notificationQueue,
});
ecsClusterStack.addDependency(databaseStack);
ecsClusterStack.addDependency(storageStack);

// 5. ECS Services and Load Balancer
const ecsServicesStack = new EcsServicesStack(
  app,
  "TicketBookingServicesStack",
  {
    env,
    description: "ECS services and Application Load Balancer",
    vpc: vpcStack.vpc,
    cluster: ecsClusterStack.cluster,
    taskDefinitions: ecsClusterStack.taskDefinitions,
    albSecurityGroup: vpcStack.albSecurityGroup,
    ecsSecurityGroup: vpcStack.ecsSecurityGroup,
  }
);
ecsServicesStack.addDependency(ecsClusterStack);

// 6. Frontend (S3 + CloudFront)
const frontendStack = new FrontendStack(app, "TicketBookingFrontendStack", {
  env,
  description: "Frontend S3 bucket and CloudFront distribution",
  albDnsName: ecsServicesStack.albDnsName,
});
frontendStack.addDependency(ecsServicesStack);

// Output stack information
app.synth();

