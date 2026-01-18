import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";
import { config } from "../config/config";

export class VpcStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly ecsSecurityGroup: ec2.SecurityGroup;
  public readonly albSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create VPC with public and private subnets
    this.vpc = new ec2.Vpc(this, "TicketBookingVpc", {
      vpcName: `${config.projectName}-vpc`,
      maxAzs: config.vpc.maxAzs,
      natGateways: config.vpc.natGateways,
      subnetConfiguration: [
        {
          name: "Public",
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: "Private",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
      ],
      enableDnsHostnames: true,
      enableDnsSupport: true,
    });

    // Security Group for ALB
    this.albSecurityGroup = new ec2.SecurityGroup(this, "AlbSecurityGroup", {
      vpc: this.vpc,
      securityGroupName: `${config.projectName}-alb-sg`,
      description: "Security group for Application Load Balancer",
      allowAllOutbound: true,
    });

    this.albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      "Allow HTTP from anywhere"
    );

    this.albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      "Allow HTTPS from anywhere"
    );

    // Security Group for ECS Tasks
    this.ecsSecurityGroup = new ec2.SecurityGroup(this, "EcsSecurityGroup", {
      vpc: this.vpc,
      securityGroupName: `${config.projectName}-ecs-sg`,
      description: "Security group for ECS tasks",
      allowAllOutbound: true,
    });

    // Allow ECS tasks to receive traffic from ALB
    this.ecsSecurityGroup.addIngressRule(
      this.albSecurityGroup,
      ec2.Port.tcpRange(3000, 3010),
      "Allow traffic from ALB"
    );

    // Allow ECS tasks to communicate with each other
    this.ecsSecurityGroup.addIngressRule(
      this.ecsSecurityGroup,
      ec2.Port.allTraffic(),
      "Allow inter-service communication"
    );

    // VPC Endpoints for AWS Services (cost optimization + security)
    // Secrets Manager
    this.vpc.addInterfaceEndpoint("SecretsManagerEndpoint", {
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
      securityGroups: [this.createVpcEndpointSecurityGroup("secrets-manager")],
    });

    // ECR API
    this.vpc.addInterfaceEndpoint("EcrApiEndpoint", {
      service: ec2.InterfaceVpcEndpointAwsService.ECR,
      securityGroups: [this.createVpcEndpointSecurityGroup("ecr-api")],
    });

    // ECR Docker
    this.vpc.addInterfaceEndpoint("EcrDockerEndpoint", {
      service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
      securityGroups: [this.createVpcEndpointSecurityGroup("ecr-docker")],
    });

    // CloudWatch Logs
    this.vpc.addInterfaceEndpoint("CloudWatchLogsEndpoint", {
      service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
      securityGroups: [this.createVpcEndpointSecurityGroup("cloudwatch-logs")],
    });

    // S3 Gateway Endpoint (no additional cost)
    this.vpc.addGatewayEndpoint("S3Endpoint", {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    // SQS
    this.vpc.addInterfaceEndpoint("SqsEndpoint", {
      service: ec2.InterfaceVpcEndpointAwsService.SQS,
      securityGroups: [this.createVpcEndpointSecurityGroup("sqs")],
    });

    // SES (SMTP)
    this.vpc.addInterfaceEndpoint("SesEndpoint", {
      service: ec2.InterfaceVpcEndpointAwsService.SES_SMTP,
      securityGroups: [this.createVpcEndpointSecurityGroup("ses")],
    });

    // Outputs
    new cdk.CfnOutput(this, "VpcId", {
      value: this.vpc.vpcId,
      description: "VPC ID",
      exportName: `${config.projectName}-vpc-id`,
    });

    new cdk.CfnOutput(this, "EcsSecurityGroupId", {
      value: this.ecsSecurityGroup.securityGroupId,
      description: "ECS Security Group ID",
      exportName: `${config.projectName}-ecs-sg-id`,
    });

    new cdk.CfnOutput(this, "AlbSecurityGroupId", {
      value: this.albSecurityGroup.securityGroupId,
      description: "ALB Security Group ID",
      exportName: `${config.projectName}-alb-sg-id`,
    });
  }

  private createVpcEndpointSecurityGroup(
    serviceName: string
  ): ec2.SecurityGroup {
    const sg = new ec2.SecurityGroup(this, `${serviceName}-endpoint-sg`, {
      vpc: this.vpc,
      securityGroupName: `${config.projectName}-${serviceName}-endpoint-sg`,
      description: `Security group for ${serviceName} VPC endpoint`,
      allowAllOutbound: false,
    });

    sg.addIngressRule(
      this.ecsSecurityGroup,
      ec2.Port.tcp(443),
      `Allow HTTPS from ECS tasks to ${serviceName}`
    );

    return sg;
  }
}

