import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import { config } from "../config/config";

interface DatabaseStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  ecsSecurityGroup: ec2.SecurityGroup;
}

export class DatabaseStack extends cdk.Stack {
  public readonly rdsSecurityGroup: ec2.SecurityGroup;
  public readonly redisSecurityGroup: ec2.SecurityGroup;
  public readonly databases: { [key: string]: rds.DatabaseInstance };
  public readonly redisHost: string;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    const { vpc, ecsSecurityGroup } = props;

    // Security Group for RDS
    this.rdsSecurityGroup = new ec2.SecurityGroup(this, "RdsSecurityGroup", {
      vpc,
      securityGroupName: `${config.projectName}-rds-sg`,
      description: "Security group for RDS PostgreSQL instances",
      allowAllOutbound: false,
    });

    this.rdsSecurityGroup.addIngressRule(
      ecsSecurityGroup,
      ec2.Port.tcp(5432),
      "Allow PostgreSQL from ECS tasks"
    );

    // Security Group for Redis
    this.redisSecurityGroup = new ec2.SecurityGroup(
      this,
      "RedisSecurityGroup",
      {
        vpc,
        securityGroupName: `${config.projectName}-redis-sg`,
        description: "Security group for Redis ECS task",
        allowAllOutbound: true,
      }
    );

    this.redisSecurityGroup.addIngressRule(
      ecsSecurityGroup,
      ec2.Port.tcp(6379),
      "Allow Redis from ECS tasks"
    );

    // Create RDS Subnet Group
    const dbSubnetGroup = new rds.SubnetGroup(this, "DbSubnetGroup", {
      vpc,
      description: "Subnet group for RDS instances",
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      subnetGroupName: `${config.projectName}-db-subnet-group`,
    });

    // Database services
    const dbServices = [
      "auth",
      "event",
      "seat",
      "reservation",
      "payment",
      "ticket",
      "notification",
    ];

    this.databases = {};

    // Create RDS instances for each service
    dbServices.forEach((service) => {
      // Create secret for database credentials
      const dbSecret = new secretsmanager.Secret(this, `${service}DbSecret`, {
        secretName: `${config.projectName}/${service}/db`,
        generateSecretString: {
          secretStringTemplate: JSON.stringify({
            username: "postgres",
          }),
          generateStringKey: "password",
          excludePunctuation: true,
          includeSpace: false,
          passwordLength: 32,
        },
      });

      // Create RDS instance
      const dbInstance = new rds.DatabaseInstance(this, `${service}Database`, {
        engine: rds.DatabaseInstanceEngine.postgres({
          version: rds.PostgresEngineVersion.VER_15_4,
        }),
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.T3,
          ec2.InstanceSize.MICRO
        ),
        vpc,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        securityGroups: [this.rdsSecurityGroup],
        subnetGroup: dbSubnetGroup,
        databaseName: `${service}_db`,
        credentials: rds.Credentials.fromSecret(dbSecret),
        allocatedStorage: config.rds.allocatedStorage,
        maxAllocatedStorage: config.rds.maxAllocatedStorage,
        storageType: rds.StorageType.GP3,
        backupRetention: cdk.Duration.days(config.rds.backupRetention),
        deleteAutomatedBackups: true,
        removalPolicy: cdk.RemovalPolicy.DESTROY, // For development
        deletionProtection: false, // For development
        publiclyAccessible: false,
        multiAz: false, // Cost optimization
        autoMinorVersionUpgrade: true,
        enablePerformanceInsights: false, // Cost optimization
        cloudwatchLogsExports: ["postgresql"],
        instanceIdentifier: `${config.projectName}-${service}-db`,
      });

      this.databases[service] = dbInstance;

      // Output database endpoints
      new cdk.CfnOutput(this, `${service}DbEndpoint`, {
        value: dbInstance.dbInstanceEndpointAddress,
        description: `${service} database endpoint`,
        exportName: `${config.projectName}-${service}-db-endpoint`,
      });

      new cdk.CfnOutput(this, `${service}DbSecretArn`, {
        value: dbSecret.secretArn,
        description: `${service} database secret ARN`,
        exportName: `${config.projectName}-${service}-db-secret-arn`,
      });
    });

    // Redis as ECS Task (cost-effective alternative to ElastiCache)
    const redisCluster = new ecs.Cluster(this, "RedisCluster", {
      vpc,
      clusterName: `${config.projectName}-redis-cluster`,
      containerInsights: false, // Cost optimization
    });

    const redisTaskDefinition = new ecs.FargateTaskDefinition(
      this,
      "RedisTaskDef",
      {
        family: `${config.projectName}-redis`,
        cpu: config.redis.cpu,
        memoryLimitMiB: config.redis.memoryLimitMiB,
      }
    );

    // Create secret for Redis password
    const redisSecret = new secretsmanager.Secret(this, "RedisSecret", {
      secretName: `${config.projectName}/redis`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({}),
        generateStringKey: "password",
        excludePunctuation: true,
        includeSpace: false,
        passwordLength: 32,
      },
    });

    // Redis container
    redisTaskDefinition.addContainer("redis", {
      image: ecs.ContainerImage.fromRegistry("redis:7-alpine"),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: "redis",
        logRetention: logs.RetentionDays.ONE_WEEK,
      }),
      command: [
        "redis-server",
        "--requirepass",
        redisSecret.secretValueFromJson("password").unsafeUnwrap(),
        "--maxmemory",
        "256mb",
        "--maxmemory-policy",
        "allkeys-lru",
      ],
      portMappings: [
        {
          containerPort: 6379,
          protocol: ecs.Protocol.TCP,
        },
      ],
      healthCheck: {
        command: ["CMD", "redis-cli", "ping"],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    // Redis ECS Service with Service Discovery
    const redisService = new ecs.FargateService(this, "RedisService", {
      cluster: redisCluster,
      taskDefinition: redisTaskDefinition,
      serviceName: `${config.projectName}-redis`,
      desiredCount: 1,
      securityGroups: [this.redisSecurityGroup],
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      cloudMapOptions: {
        name: "redis",
        cloudMapNamespace: {
          name: `${config.projectName}.local`,
          type: ec2.NamespaceType.DNS_PRIVATE,
          vpc,
        },
        dnsRecordType: ec2.DnsRecordType.A,
        dnsTtl: cdk.Duration.seconds(10),
      },
    });

    this.redisHost = `redis.${config.projectName}.local`;

    // Outputs
    new cdk.CfnOutput(this, "RedisHost", {
      value: this.redisHost,
      description: "Redis host (Service Discovery)",
      exportName: `${config.projectName}-redis-host`,
    });

    new cdk.CfnOutput(this, "RedisSecretArn", {
      value: redisSecret.secretArn,
      description: "Redis password secret ARN",
      exportName: `${config.projectName}-redis-secret-arn`,
    });
  }
}

