/**
 * Configuration for Ticket Booking Infrastructure
 *
 * Update these values for your deployment:
 * - projectName: Your project identifier
 * - environment: AWS account and region
 * - verifiedEmail: Your verified SES email for notifications
 */

export interface InfrastructureConfig {
  projectName: string;
  environment: {
    account: string;
    region: string;
  };
  vpc: {
    maxAzs: number;
    natGateways: number;
  };
  rds: {
    instanceType: string;
    allocatedStorage: number;
    maxAllocatedStorage: number;
    backupRetention: number;
  };
  redis: {
    cpu: number;
    memoryLimitMiB: number;
  };
  ecs: {
    cpu: number;
    memoryLimitMiB: number;
    desiredCount: number;
    minCapacity: number;
    maxCapacity: number;
  };
  ses: {
    verifiedEmail: string;
  };
  tags: {
    [key: string]: string;
  };
}

export const config: InfrastructureConfig = {
  projectName: "ticket-booking",

  environment: {
    // Update with your AWS account ID and region
    account: process.env.CDK_DEFAULT_ACCOUNT || "YOUR_AWS_ACCOUNT_ID",
    region: process.env.CDK_DEFAULT_REGION || "ap-south-1",
  },

  vpc: {
    maxAzs: 2, // Use 2 availability zones
    natGateways: 1, // Cost optimization: 1 NAT Gateway
  },

  rds: {
    instanceType: "t3.micro", // Free tier eligible
    allocatedStorage: 20, // GB
    maxAllocatedStorage: 100, // GB (auto-scaling limit)
    backupRetention: 7, // days
  },

  redis: {
    cpu: 256, // 0.25 vCPU
    memoryLimitMiB: 512, // 512 MB
  },

  ecs: {
    cpu: 256, // 0.25 vCPU per service
    memoryLimitMiB: 512, // 512 MB per service
    desiredCount: 1, // Number of tasks per service
    minCapacity: 1, // Auto-scaling minimum
    maxCapacity: 3, // Auto-scaling maximum
  },

  ses: {
    // Update with your verified SES email
    verifiedEmail: "your-email@example.com",
  },

  tags: {
    Project: "TicketBooking",
    Environment: "Production",
    ManagedBy: "CDK",
  },
};

