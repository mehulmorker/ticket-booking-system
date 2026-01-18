import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as servicediscovery from "aws-cdk-lib/aws-servicediscovery";
import { Construct } from "constructs";
import { config } from "../config/config";

interface EcsServicesStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  cluster: ecs.Cluster;
  taskDefinitions: { [key: string]: ecs.FargateTaskDefinition };
  albSecurityGroup: ec2.SecurityGroup;
  ecsSecurityGroup: ec2.SecurityGroup;
}

export class EcsServicesStack extends cdk.Stack {
  public readonly albDnsName: string;

  constructor(scope: Construct, id: string, props: EcsServicesStackProps) {
    super(scope, id, props);

    const {
      vpc,
      cluster,
      taskDefinitions,
      albSecurityGroup,
      ecsSecurityGroup,
    } = props;

    // Create Application Load Balancer
    const alb = new elbv2.ApplicationLoadBalancer(this, "ALB", {
      vpc,
      internetFacing: true,
      loadBalancerName: `${config.projectName}-alb`,
      securityGroup: albSecurityGroup,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
    });

    this.albDnsName = alb.loadBalancerDnsName;

    // Create HTTP listener
    const httpListener = alb.addListener("HttpListener", {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultAction: elbv2.ListenerAction.fixedResponse(404, {
        contentType: "text/plain",
        messageBody: "Not Found",
      }),
    });

    // Create Cloud Map namespace for service discovery
    const namespace = new servicediscovery.PrivateDnsNamespace(
      this,
      "ServiceDiscoveryNamespace",
      {
        name: `${config.projectName}.local`,
        vpc,
        description: "Service discovery namespace for microservices",
      }
    );

    // Services configuration
    const services = [
      {
        name: "auth",
        port: 3001,
        path: "/api/auth",
        priority: 10,
        needsServiceDiscovery: true,
      },
      {
        name: "event",
        port: 3002,
        path: "/api/events",
        priority: 20,
        needsServiceDiscovery: true,
      },
      {
        name: "seat",
        port: 3003,
        path: "/api/seats",
        priority: 30,
        needsServiceDiscovery: true,
      },
      {
        name: "reservation",
        port: 3004,
        path: "/api/reservations",
        priority: 40,
        needsServiceDiscovery: true,
      },
      {
        name: "payment",
        port: 3005,
        path: "/api/payments",
        priority: 50,
        needsServiceDiscovery: true,
      },
      {
        name: "ticket",
        port: 3006,
        path: "/api/tickets",
        priority: 60,
        needsServiceDiscovery: true,
      },
      {
        name: "notification",
        port: 3007,
        path: "/api/notifications",
        priority: 70,
        needsServiceDiscovery: true,
      },
      {
        name: "api-gateway",
        port: 3000,
        path: "/api",
        priority: 100,
        needsServiceDiscovery: false,
      }, // Lowest priority (catch-all)
    ];

    // Create ECS services
    services.forEach((serviceConfig) => {
      const taskDef = taskDefinitions[serviceConfig.name];
      if (!taskDef) {
        throw new Error(`Task definition not found for ${serviceConfig.name}`);
      }

      // Create ECS Service
      const ecsService = new ecs.FargateService(
        this,
        `${serviceConfig.name}Service`,
        {
          cluster,
          taskDefinition: taskDef,
          serviceName: `${config.projectName}-${serviceConfig.name}`,
          desiredCount: config.ecs.desiredCount,
          securityGroups: [ecsSecurityGroup],
          vpcSubnets: {
            subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          },
          enableExecuteCommand: true, // For debugging
          cloudMapOptions: serviceConfig.needsServiceDiscovery
            ? {
                name: serviceConfig.name,
                cloudMapNamespace: namespace,
                dnsRecordType: servicediscovery.DnsRecordType.A,
                dnsTtl: cdk.Duration.seconds(10),
              }
            : undefined,
        }
      );

      // Create target group
      const targetGroup = new elbv2.ApplicationTargetGroup(
        this,
        `${serviceConfig.name}TargetGroup`,
        {
          vpc,
          port: serviceConfig.port,
          protocol: elbv2.ApplicationProtocol.HTTP,
          targetType: elbv2.TargetType.IP,
          targetGroupName: `${config.projectName}-${serviceConfig.name}-tg`,
          healthCheck: {
            path: "/health",
            interval: cdk.Duration.seconds(30),
            timeout: cdk.Duration.seconds(5),
            healthyThresholdCount: 2,
            unhealthyThresholdCount: 3,
            healthyHttpCodes: "200",
          },
          deregistrationDelay: cdk.Duration.seconds(30),
        }
      );

      // Attach ECS service to target group
      ecsService.attachToApplicationTargetGroup(targetGroup);

      // Add listener rule
      httpListener.addTargetGroups(`${serviceConfig.name}Rule`, {
        targetGroups: [targetGroup],
        priority: serviceConfig.priority,
        conditions: [
          elbv2.ListenerCondition.pathPatterns([`${serviceConfig.path}*`]),
        ],
      });

      // Enable auto-scaling
      const scaling = ecsService.autoScaleTaskCount({
        minCapacity: config.ecs.minCapacity,
        maxCapacity: config.ecs.maxCapacity,
      });

      // Scale based on CPU utilization
      scaling.scaleOnCpuUtilization(`${serviceConfig.name}CpuScaling`, {
        targetUtilizationPercent: 70,
        scaleInCooldown: cdk.Duration.seconds(60),
        scaleOutCooldown: cdk.Duration.seconds(60),
      });

      // Scale based on memory utilization
      scaling.scaleOnMemoryUtilization(`${serviceConfig.name}MemoryScaling`, {
        targetUtilizationPercent: 80,
        scaleInCooldown: cdk.Duration.seconds(60),
        scaleOutCooldown: cdk.Duration.seconds(60),
      });

      // Outputs
      new cdk.CfnOutput(this, `${serviceConfig.name}ServiceName`, {
        value: ecsService.serviceName,
        description: `${serviceConfig.name} ECS service name`,
        exportName: `${config.projectName}-${serviceConfig.name}-service-name`,
      });

      new cdk.CfnOutput(this, `${serviceConfig.name}ServiceArn`, {
        value: ecsService.serviceArn,
        description: `${serviceConfig.name} ECS service ARN`,
        exportName: `${config.projectName}-${serviceConfig.name}-service-arn`,
      });
    });

    // Outputs
    new cdk.CfnOutput(this, "AlbDnsName", {
      value: this.albDnsName,
      description: "Application Load Balancer DNS name",
      exportName: `${config.projectName}-alb-dns`,
    });

    new cdk.CfnOutput(this, "AlbUrl", {
      value: `http://${this.albDnsName}`,
      description: "Application Load Balancer URL",
    });

    new cdk.CfnOutput(this, "ApiUrl", {
      value: `http://${this.albDnsName}/api`,
      description: "API Gateway URL",
    });
  }
}

