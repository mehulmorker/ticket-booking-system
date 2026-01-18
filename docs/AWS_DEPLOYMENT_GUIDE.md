# 🚀 Complete AWS Deployment Guide

**Purpose:** Step-by-step manual guide to deploy all microservices to AWS ECS  
**Target Time:** 5 hours maximum  
**Cost:** ~$4-5 for testing  
**Status:** ✅ Ready for Deployment

> **💡 Prefer Automated Deployment?**  
> This guide covers manual deployment using AWS CLI. For automated one-command deployment using AWS CDK, see **[../infrastructure/README.md](../infrastructure/README.md)**.  
> **CDK Benefits:** 30-40 minutes vs 5+ hours | 1 command vs 100+ commands | Type-safe infrastructure

**📌 Important Deployment Order:**

1. **Phase 2.3.1** (Create Databases) should be run **after Phase 5** (ECS Cluster created) but **before Phase 6** (Deploy Services)
2. This ensures databases exist when services start, preventing connection errors
3. If you skip 2.3.1, services will fail until Phase 8.1 (where you can create databases)

**📌 Standard AWS Practices Used:**

- **ECS Automatic Target Registration:** API Gateway service includes load balancer configuration, so ECS automatically manages ALB target registration (section 6.4.8)
- **No Manual Workarounds:** All deployment steps use production-standard AWS approaches
- **Proper Resource Dependencies:** Resources are created in the correct order to avoid manual fixes

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Phase 1: AWS Account Setup](#phase-1-aws-account-setup)
3. [Phase 2: Infrastructure Setup](#phase-2-infrastructure-setup)
4. [Phase 3: Container Registry (ECR)](#phase-3-container-registry-ecr)
5. [Phase 4: Build & Push Docker Images](#phase-4-build--push-docker-images)
6. [Phase 5: ECS Cluster & Task Definitions](#phase-5-ecs-cluster--task-definitions)
7. [Phase 6: ECS Services Deployment](#phase-6-ecs-services-deployment)
8. [Phase 7: Load Balancer Configuration](#phase-7-load-balancer-configuration)
9. [Phase 8: Database Migrations & Seeders](#phase-8-database-migrations--seeders)
10. [Phase 9: Frontend Deployment](#phase-9-frontend-deployment)
11. [Phase 10: Testing & Verification](#phase-10-testing--verification) ⭐ **Complete End-to-End Testing**
12. [Phase 11: Scaling Test (Optional)](#phase-11-scaling-test-optional)
13. [Phase 12: Cleanup](#phase-12-cleanup) ⭐ **Quick Cleanup Script + Manual Steps**
14. [Troubleshooting](#troubleshooting)
15. [Cost Summary](#cost-summary)

---

## 📦 AWS Services Required

Based on codebase analysis, here are the AWS services actually used:

### ✅ Required Services

| AWS Service         | Used By                                    | Purpose                          |
| ------------------- | ------------------------------------------ | -------------------------------- |
| **ECS Fargate**     | All services                               | Run containerized microservices  |
| **ECR**             | All services                               | Store Docker images              |
| **RDS PostgreSQL**  | All services                               | Primary database                 |
| **S3**              | Ticket, Event, Frontend                    | Store PDFs, images, static files |
| **SQS**             | Payment, Ticket, Notification, Reservation | Async message queues             |
| **SES**             | Notification Service                       | Send email notifications         |
| **ALB**             | API Gateway                                | Load balancing & routing         |
| **VPC**             | All services                               | Network isolation                |
| **Secrets Manager** | All services                               | Store credentials                |
| **CloudWatch**      | All services                               | Logging & monitoring             |
| **Cloud Map**       | All services                               | Service discovery                |

### ⚠️ Services NOT Required (Cost Savings)

| AWS Service         | Reason Not Needed                       | Alternative Used                      |
| ------------------- | --------------------------------------- | ------------------------------------- |
| **~~AWS Cognito~~** | Auth service uses local JWT with bcrypt | PostgreSQL + JWT                      |
| **~~ElastiCache~~** | Simple Redis use case                   | Redis as ECS task (~$9/month cheaper) |
| **~~SNS~~**         | SMS not implemented                     | SES for email only                    |

### 💡 Redis Implementation

Redis is used for:

- **Seat Service:** Distributed locking for seat reservations
- **API Gateway:** Rate limiting (optional - falls back to in-memory)

We deploy Redis as an **ECS Fargate task** instead of ElastiCache because:

- **Cost:** ~$3/month vs ~$12/month for ElastiCache
- **Simplicity:** Simple use case doesn't need managed service
- **Sufficient:** Good enough for development and testing

For production with high availability requirements, consider upgrading to ElastiCache.

---

## ✅ Prerequisites

### Required Tools

- [ ] **AWS Account** - Active AWS account with billing enabled
- [ ] **AWS CLI** - Installed and configured (`aws --version`)
- [ ] **Docker** - Installed and running (`docker --version`)
- [ ] **Node.js 18+** - For building frontend (`node --version`)
- [ ] **Git** - For cloning repository (`git --version`)
- [ ] **jq** - For JSON parsing (optional but helpful) (`jq --version`)

### AWS CLI Configuration

```bash
# Configure AWS CLI (if not already done)
aws configure

# Enter:
# AWS Access Key ID: [Your access key]
# AWS Secret Access Key: [Your secret key]
# Default region name: us-east-1
# Default output format: json

# Verify configuration
aws sts get-caller-identity
```

### Set Environment Variables

```bash
# Set your AWS account ID and region
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export AWS_REGION=us-east-1
export PROJECT_NAME=ticket-booking

# Verify
echo "Account ID: $AWS_ACCOUNT_ID"
echo "Region: $AWS_REGION"
```

### Billing Alerts Setup

```bash
# Create SNS topic for billing alerts
aws sns create-topic --name billing-alerts

# Subscribe to topic (replace with your email)
aws sns subscribe \
  --topic-arn arn:aws:sns:${AWS_REGION}:${AWS_ACCOUNT_ID}:billing-alerts \
  --protocol email \
  --notification-endpoint your-email@example.com

# Create billing alarm at $5
aws cloudwatch put-metric-alarm \
  --alarm-name billing-alert-5 \
  --alarm-description "Alert when estimated charges exceed $5" \
  --metric-name EstimatedCharges \
  --namespace AWS/Billing \
  --statistic Maximum \
  --period 86400 \
  --evaluation-periods 1 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions arn:aws:sns:${AWS_REGION}:${AWS_ACCOUNT_ID}:billing-alerts
```

**⚠️ Important:** Check your email and confirm the SNS subscription before proceeding.

---

## 🏗️ Phase 1: AWS Account Setup (15 minutes)

### 1.1 Verify AWS Access

```bash
# Check your AWS identity
aws sts get-caller-identity

# Expected output:
# {
#   "UserId": "...",
#   "Account": "123456789012",
#   "Arn": "arn:aws:iam::123456789012:user/your-username"
# }
```

### 1.2 Set Variables

**⚠️ Important: `aws-resources.txt` is the Single Source of Truth**

Throughout this guide, all AWS resource IDs, ARNs, and important values are saved to `aws-resources.txt`. This file:

- **Must be created** in Phase 1.2 (this section)
- **Is automatically updated** in every deployment step
- **Should be sourced** (`source aws-resources.txt`) at the start of each section
- **Contains all resource identifiers** needed for deployment, updates, and cleanup

**Never manually edit `aws-resources.txt`** - it's automatically maintained by the deployment commands.

```bash
# Set these variables (replace with your values)
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export AWS_REGION=us-east-1
export PROJECT_NAME=ticket-booking
export CLUSTER_NAME=${PROJECT_NAME}-cluster

# Initialize aws-resources.txt (create or overwrite)
cat > aws-resources.txt << EOF
AWS_ACCOUNT_ID=$AWS_ACCOUNT_ID
AWS_REGION=$AWS_REGION
PROJECT_NAME=$PROJECT_NAME
CLUSTER_NAME=$CLUSTER_NAME
EOF

# Verify
echo "Account: $AWS_ACCOUNT_ID"
echo "Region: $AWS_REGION"
echo "Cluster: $CLUSTER_NAME"
echo ""
echo "✅ Variables saved to aws-resources.txt (single source of truth)"
```

### 1.3 Create IAM Role for ECS Tasks

```bash
# Create trust policy file
cat > ecs-trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ecs-tasks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create ECS task execution role
aws iam create-role \
  --role-name ecsTaskExecutionRole \
  --assume-role-policy-document file://ecs-trust-policy.json

# Attach managed policy for ECS task execution
aws iam attach-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

# Attach policy for Secrets Manager access
aws iam attach-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/SecretsManagerReadWrite

# Add S3 permissions for ticket service (PDF uploads) and event service (image uploads)
# Note: S3 buckets will be created in Phase 2, but we add permissions here
# The policy will work once buckets are created
cat > s3-services-policy.json << 'POLICY_EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:HeadObject"
      ],
      "Resource": [
        "arn:aws:s3:::${PROJECT_NAME}-${AWS_ACCOUNT_ID}-tickets-pdf/*",
        "arn:aws:s3:::${PROJECT_NAME}-${AWS_ACCOUNT_ID}-event-images/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::${PROJECT_NAME}-${AWS_ACCOUNT_ID}-tickets-pdf",
        "arn:aws:s3:::${PROJECT_NAME}-${AWS_ACCOUNT_ID}-event-images"
      ]
    }
  ]
}
POLICY_EOF

# Replace variables in policy
sed -i "s/\${PROJECT_NAME}/${PROJECT_NAME}/g" s3-services-policy.json
sed -i "s/\${AWS_ACCOUNT_ID}/${AWS_ACCOUNT_ID}/g" s3-services-policy.json

# Attach S3 policy to role
aws iam put-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-name ${PROJECT_NAME}-services-s3-access \
  --policy-document file://s3-services-policy.json

echo "✅ S3 permissions added for ticket service and event service"

# Cleanup policy file
rm -f s3-services-policy.json

# Add SQS permissions for all services (send/receive messages)
# Note: SQS queues will be created in Phase 2, but we add permissions here
# The policy will work once queues are created
cat > sqs-services-policy.json << 'POLICY_EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sqs:SendMessage",
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes",
        "sqs:GetQueueUrl"
      ],
      "Resource": [
        "arn:aws:sqs:${AWS_REGION}:${AWS_ACCOUNT_ID}:${PROJECT_NAME}-notification-queue",
        "arn:aws:sqs:${AWS_REGION}:${AWS_ACCOUNT_ID}:${PROJECT_NAME}-ticket-generation-queue",
        "arn:aws:sqs:${AWS_REGION}:${AWS_ACCOUNT_ID}:${PROJECT_NAME}-payment-processing-queue",
        "arn:aws:sqs:${AWS_REGION}:${AWS_ACCOUNT_ID}:${PROJECT_NAME}-reservation-expiry-queue"
      ]
    }
  ]
}
POLICY_EOF

# Replace variables in policy
sed -i "s/\${PROJECT_NAME}/${PROJECT_NAME}/g" sqs-services-policy.json
sed -i "s/\${AWS_REGION}/${AWS_REGION}/g" sqs-services-policy.json
sed -i "s/\${AWS_ACCOUNT_ID}/${AWS_ACCOUNT_ID}/g" sqs-services-policy.json

# Attach SQS policy to role
aws iam put-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-name ${PROJECT_NAME}-services-sqs-access \
  --policy-document file://sqs-services-policy.json

echo "✅ SQS permissions added for all services"

# Cleanup policy file
rm -f sqs-services-policy.json

# Add SES permissions for notification service (email sending)
cat > ses-services-policy.json << 'POLICY_EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendRawEmail"
      ],
      "Resource": "*"
    }
  ]
}
POLICY_EOF

# Attach SES policy to role
aws iam put-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-name ${PROJECT_NAME}-services-ses-access \
  --policy-document file://ses-services-policy.json

echo "✅ SES permissions added for notification service"

# Cleanup policy file
rm -f ses-services-policy.json

# Get role ARN and save to aws-resources.txt
export ECS_TASK_ROLE_ARN=$(aws iam get-role --role-name ecsTaskExecutionRole --query 'Role.Arn' --output text)
echo "ECS_TASK_ROLE_ARN=$ECS_TASK_ROLE_ARN" >> aws-resources.txt
echo "Task Role ARN: $ECS_TASK_ROLE_ARN"
echo "✅ ECS Task Role ARN saved to aws-resources.txt"
```

**✅ Verification:**

```bash
aws iam get-role --role-name ecsTaskExecutionRole
```

---

## 🌐 Phase 2: Infrastructure Setup (1 hour)

**⚠️ Critical Configuration Checklist:**

Before proceeding, ensure these are configured correctly:

- ✅ **VPC Endpoints & Security Group Rules** (Section 2.2.1) - Required for tasks to access Secrets Manager, ECR, CloudWatch
- ✅ **External Images in ECR** (Sections 2.3.1, 5.3) - **CRITICAL:** Tasks in private subnets can't access Docker Hub. All external images (postgres, redis) must be pushed to ECR first.
- ✅ **Database Creation** (Section 2.3.1) - Create databases after ECS cluster is ready (uses ECR postgres image)
- ✅ **Database SSL Configuration** - All services automatically detect RDS and enable SSL (configured in code)
- ✅ **Health Checks** (Section 5.2) - All use `wget` (not `curl`) to match docker-compose
- ✅ **Build Context** (Section 4.1) - Use service directory as build context: `./backend/services/${service}`
- ✅ **Service Discovery** (Section 6.3) - Required for inter-service communication

**Common Issues Prevented:**

- ❌ "unable to retrieve secret from asm" → Fix: VPC endpoint security group rules (Section 2.2.1)
- ❌ "no pg_hba.conf entry... no encryption" → Fix: SSL is automatically configured when connecting to RDS (detected by hostname). **Also ensure code is rebuilt and deployed** (Section 4.1)
- ❌ "database does not exist" → Fix: Create databases in Section 2.3.1 (after ECS cluster is ready)
- ❌ "CannotPullContainerError: dial tcp... i/o timeout" → Fix: **Use ECR images, not Docker Hub**. Tasks in private subnets can't access Docker Hub. Push images to ECR first:
  - Postgres: Section 2.3.1 (Step 1)
  - Redis: Section 5.3 (Step 1)
- ❌ "failed container health checks" → Fix: Use `wget` in health checks (Section 5.2)
- ❌ "getaddrinfo ENOTFOUND" → Fix: Ensure services are running and Service Discovery is configured

---

### 2.1 Create VPC & Networking

```bash
# Create VPC
VPC_ID=$(aws ec2 create-vpc \
  --cidr-block 10.0.0.0/16 \
  --tag-specifications "ResourceType=vpc,Tags=[{Key=Name,Value=${PROJECT_NAME}-vpc}]" \
  --query 'Vpc.VpcId' \
  --output text)

echo "VPC ID: $VPC_ID"

# Enable DNS hostnames
aws ec2 modify-vpc-attribute \
  --vpc-id $VPC_ID \
  --enable-dns-hostnames

# Enable DNS resolution
aws ec2 modify-vpc-attribute \
  --vpc-id $VPC_ID \
  --enable-dns-support

# Create Internet Gateway
IGW_ID=$(aws ec2 create-internet-gateway \
  --tag-specifications "ResourceType=internet-gateway,Tags=[{Key=Name,Value=${PROJECT_NAME}-igw}]" \
  --query 'InternetGateway.InternetGatewayId' \
  --output text)

echo "Internet Gateway ID: $IGW_ID"

# Attach Internet Gateway to VPC
aws ec2 attach-internet-gateway \
  --internet-gateway-id $IGW_ID \
  --vpc-id $VPC_ID

# Get availability zones
AZ1=$(aws ec2 describe-availability-zones --query 'AvailabilityZones[0].ZoneName' --output text)
AZ2=$(aws ec2 describe-availability-zones --query 'AvailabilityZones[1].ZoneName' --output text)

echo "AZ1: $AZ1"
echo "AZ2: $AZ2"

# Create public subnet 1
PUBLIC_SUBNET_1=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.1.0/24 \
  --availability-zone $AZ1 \
  --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${PROJECT_NAME}-public-subnet-1}]" \
  --query 'Subnet.SubnetId' \
  --output text)

echo "Public Subnet 1: $PUBLIC_SUBNET_1"

# Create public subnet 2
PUBLIC_SUBNET_2=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.2.0/24 \
  --availability-zone $AZ2 \
  --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${PROJECT_NAME}-public-subnet-2}]" \
  --query 'Subnet.SubnetId' \
  --output text)

echo "Public Subnet 2: $PUBLIC_SUBNET_2"

# Create private subnet 1
PRIVATE_SUBNET_1=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.11.0/24 \
  --availability-zone $AZ1 \
  --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${PROJECT_NAME}-private-subnet-1}]" \
  --query 'Subnet.SubnetId' \
  --output text)

echo "Private Subnet 1: $PRIVATE_SUBNET_1"

# Create private subnet 2
PRIVATE_SUBNET_2=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.12.0/24 \
  --availability-zone $AZ2 \
  --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${PROJECT_NAME}-private-subnet-2}]" \
  --query 'Subnet.SubnetId' \
  --output text)

echo "Private Subnet 2: $PRIVATE_SUBNET_2"

# Allocate Elastic IP for NAT Gateway
EIP_ALLOC=$(aws ec2 allocate-address \
  --domain vpc \
  --tag-specifications "ResourceType=elastic-ip,Tags=[{Key=Name,Value=${PROJECT_NAME}-nat-eip}]" \
  --query 'AllocationId' \
  --output text)

echo "Elastic IP Allocation: $EIP_ALLOC"

# Create NAT Gateway (in public subnet 1)
# Note: --tag-specifications doesn't work with create-nat-gateway, so we tag separately
NAT_GW_ID=$(aws ec2 create-nat-gateway \
  --subnet-id $PUBLIC_SUBNET_1 \
  --allocation-id $EIP_ALLOC \
  --query 'NatGateway.NatGatewayId' \
  --output text)

echo "NAT Gateway ID: $NAT_GW_ID"

# Tag the NAT Gateway
aws ec2 create-tags \
  --resources $NAT_GW_ID \
  --tags "Key=Name,Value=${PROJECT_NAME}-nat"

# Wait for NAT Gateway to be available (takes 2-3 minutes)
echo "Waiting for NAT Gateway to be available..."
aws ec2 wait nat-gateway-available --nat-gateway-ids $NAT_GW_ID
echo "NAT Gateway is ready!"

# Create public route table
PUBLIC_RT=$(aws ec2 create-route-table \
  --vpc-id $VPC_ID \
  --tag-specifications "ResourceType=route-table,Tags=[{Key=Name,Value=${PROJECT_NAME}-public-rt}]" \
  --query 'RouteTable.RouteTableId' \
  --output text)

echo "Public Route Table: $PUBLIC_RT"

# Add route to Internet Gateway
aws ec2 create-route \
  --route-table-id $PUBLIC_RT \
  --destination-cidr-block 0.0.0.0/0 \
  --gateway-id $IGW_ID

# Associate public subnets with public route table
aws ec2 associate-route-table \
  --subnet-id $PUBLIC_SUBNET_1 \
  --route-table-id $PUBLIC_RT

aws ec2 associate-route-table \
  --subnet-id $PUBLIC_SUBNET_2 \
  --route-table-id $PUBLIC_RT

# Create private route table
PRIVATE_RT=$(aws ec2 create-route-table \
  --vpc-id $VPC_ID \
  --tag-specifications "ResourceType=route-table,Tags=[{Key=Name,Value=${PROJECT_NAME}-private-rt}]" \
  --query 'RouteTable.RouteTableId' \
  --output text)

echo "Private Route Table: $PRIVATE_RT"

# Add route to NAT Gateway
aws ec2 create-route \
  --route-table-id $PRIVATE_RT \
  --destination-cidr-block 0.0.0.0/0 \
  --nat-gateway-id $NAT_GW_ID

# Associate private subnets with private route table
aws ec2 associate-route-table \
  --subnet-id $PRIVATE_SUBNET_1 \
  --route-table-id $PRIVATE_RT

aws ec2 associate-route-table \
  --subnet-id $PRIVATE_SUBNET_2 \
  --route-table-id $PRIVATE_RT

# Save all IDs to file for reference
cat > aws-resources.txt << EOF
VPC_ID=$VPC_ID
IGW_ID=$IGW_ID
PUBLIC_SUBNET_1=$PUBLIC_SUBNET_1
PUBLIC_SUBNET_2=$PUBLIC_SUBNET_2
PRIVATE_SUBNET_1=$PRIVATE_SUBNET_1
PRIVATE_SUBNET_2=$PRIVATE_SUBNET_2
NAT_GW_ID=$NAT_GW_ID
PUBLIC_RT=$PUBLIC_RT
PRIVATE_RT=$PRIVATE_RT
EIP_ALLOC=$EIP_ALLOC
EOF

echo "✅ Networking setup complete!"
echo "Resource IDs saved to aws-resources.txt"
```

**✅ Verification:**

```bash
# Verify VPC
aws ec2 describe-vpcs --vpc-ids $VPC_ID

# Verify subnets
aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID"

# Verify NAT Gateway
aws ec2 describe-nat-gateways --nat-gateway-ids $NAT_GW_ID
```

---

### 2.2 Create Security Groups

```bash
# Load VPC ID
source aws-resources.txt

# Security Group for ALB
ALB_SG=$(aws ec2 create-security-group \
  --group-name ${PROJECT_NAME}-alb-sg \
  --description "Security group for Application Load Balancer" \
  --vpc-id $VPC_ID \
  --query 'GroupId' \
  --output text)

echo "ALB Security Group: $ALB_SG"

# Allow HTTP and HTTPS from internet
aws ec2 authorize-security-group-ingress \
  --group-id $ALB_SG \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --group-id $ALB_SG \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0

# Security Group for ECS Tasks
ECS_SG=$(aws ec2 create-security-group \
  --group-name ${PROJECT_NAME}-ecs-sg \
  --description "Security group for ECS tasks" \
  --vpc-id $VPC_ID \
  --query 'GroupId' \
  --output text)

echo "ECS Security Group: $ECS_SG"

# Allow traffic from ALB ONLY to API Gateway (port 3000)
aws ec2 authorize-security-group-ingress \
  --group-id $ECS_SG \
  --protocol tcp \
  --port 3000 \
  --source-group $ALB_SG

# Allow API Gateway to communicate with all microservices (ports 3001-3007)
# This enables API Gateway to proxy requests to backend services
aws ec2 authorize-security-group-ingress \
  --group-id $ECS_SG \
  --protocol tcp \
  --port 3001 \
  --source-group $ECS_SG

aws ec2 authorize-security-group-ingress \
  --group-id $ECS_SG \
  --protocol tcp \
  --port 3002 \
  --source-group $ECS_SG

aws ec2 authorize-security-group-ingress \
  --group-id $ECS_SG \
  --protocol tcp \
  --port 3003 \
  --source-group $ECS_SG

aws ec2 authorize-security-group-ingress \
  --group-id $ECS_SG \
  --protocol tcp \
  --port 3004 \
  --source-group $ECS_SG

aws ec2 authorize-security-group-ingress \
  --group-id $ECS_SG \
  --protocol tcp \
  --port 3005 \
  --source-group $ECS_SG

aws ec2 authorize-security-group-ingress \
  --group-id $ECS_SG \
  --protocol tcp \
  --port 3006 \
  --source-group $ECS_SG

aws ec2 authorize-security-group-ingress \
  --group-id $ECS_SG \
  --protocol tcp \
  --port 3007 \
  --source-group $ECS_SG

# ✅ Security Architecture:
# - ALB → API Gateway (port 3000) only
# - API Gateway → All services (3001-3007) for proxying
# - Services → Services (3001-3007) for inter-service communication
# - All services stay private from internet; only API Gateway is exposed via ALB

# Security Group for RDS
RDS_SG=$(aws ec2 create-security-group \
  --group-name ${PROJECT_NAME}-rds-sg \
  --description "Security group for RDS PostgreSQL" \
  --vpc-id $VPC_ID \
  --query 'GroupId' \
  --output text)

echo "RDS Security Group: $RDS_SG"

# Allow PostgreSQL from ECS tasks
aws ec2 authorize-security-group-ingress \
  --group-id $RDS_SG \
  --protocol tcp \
  --port 5432 \
  --source-group $ECS_SG

# Security Group for Redis ECS Task (NOT ElastiCache)
REDIS_SG=$(aws ec2 create-security-group \
  --group-name ${PROJECT_NAME}-redis-sg \
  --description "Security group for Redis ECS task" \
  --vpc-id $VPC_ID \
  --query 'GroupId' \
  --output text)

echo "Redis Security Group: $REDIS_SG"

# Allow Redis port from other ECS tasks (seat-service, api-gateway)
aws ec2 authorize-security-group-ingress \
  --group-id $REDIS_SG \
  --protocol tcp \
  --port 6379 \
  --source-group $ECS_SG

# Update resources file
cat >> aws-resources.txt << EOF
ALB_SG=$ALB_SG
ECS_SG=$ECS_SG
RDS_SG=$RDS_SG
REDIS_SG=$REDIS_SG
EOF

echo "✅ Security groups created!"
```

**✅ Verification:**

```bash
aws ec2 describe-security-groups --group-ids $ALB_SG $ECS_SG $RDS_SG $REDIS_SG
```

### 2.2.1 Create VPC Endpoints (Required for Private Subnets)

**⚠️ Critical:** ECS tasks in private subnets need VPC endpoints to access AWS services (Secrets Manager, ECR, CloudWatch Logs, S3) without going through NAT Gateway.

**Why VPC Endpoints?**

- **Cost:** VPC endpoints are cheaper than NAT Gateway data transfer (~$0.01/GB vs ~$0.045/GB)
- **Performance:** Direct connection to AWS services (lower latency)
- **Security:** Traffic stays within AWS network

```bash
source aws-resources.txt

echo "Creating VPC Endpoints for AWS services..."

# 1. VPC Endpoint for Secrets Manager (REQUIRED for tasks to pull secrets)
SECRETS_VPC_ENDPOINT=$(aws ec2 create-vpc-endpoint \
  --vpc-id $VPC_ID \
  --vpc-endpoint-type Interface \
  --service-name com.amazonaws.${AWS_REGION}.secretsmanager \
  --subnet-ids $PRIVATE_SUBNET_1 $PRIVATE_SUBNET_2 \
  --security-group-ids $ECS_SG \
  --private-dns-enabled \
  --query 'VpcEndpoint.VpcEndpointId' \
  --output text)

echo "SECRETS_VPC_ENDPOINT=$SECRETS_VPC_ENDPOINT" >> aws-resources.txt
echo "✅ Secrets Manager VPC Endpoint created"

# 2. VPC Endpoint for ECR API (REQUIRED for pulling Docker images)
ECR_API_VPC_ENDPOINT=$(aws ec2 create-vpc-endpoint \
  --vpc-id $VPC_ID \
  --vpc-endpoint-type Interface \
  --service-name com.amazonaws.${AWS_REGION}.ecr.api \
  --subnet-ids $PRIVATE_SUBNET_1 $PRIVATE_SUBNET_2 \
  --security-group-ids $ECS_SG \
  --private-dns-enabled \
  --query 'VpcEndpoint.VpcEndpointId' \
  --output text)

echo "ECR_API_VPC_ENDPOINT=$ECR_API_VPC_ENDPOINT" >> aws-resources.txt
echo "✅ ECR API VPC Endpoint created"

# 3. VPC Endpoint for ECR DKR (Docker registry - REQUIRED for pulling images)
ECR_DKR_VPC_ENDPOINT=$(aws ec2 create-vpc-endpoint \
  --vpc-id $VPC_ID \
  --vpc-endpoint-type Interface \
  --service-name com.amazonaws.${AWS_REGION}.ecr.dkr \
  --subnet-ids $PRIVATE_SUBNET_1 $PRIVATE_SUBNET_2 \
  --security-group-ids $ECS_SG \
  --private-dns-enabled \
  --query 'VpcEndpoint.VpcEndpointId' \
  --output text)

echo "ECR_DKR_VPC_ENDPOINT=$ECR_DKR_VPC_ENDPOINT" >> aws-resources.txt
echo "✅ ECR DKR VPC Endpoint created"

# 4. VPC Endpoint for CloudWatch Logs (REQUIRED for logging)
LOGS_VPC_ENDPOINT=$(aws ec2 create-vpc-endpoint \
  --vpc-id $VPC_ID \
  --vpc-endpoint-type Interface \
  --service-name com.amazonaws.${AWS_REGION}.logs \
  --subnet-ids $PRIVATE_SUBNET_1 $PRIVATE_SUBNET_2 \
  --security-group-ids $ECS_SG \
  --private-dns-enabled \
  --query 'VpcEndpoint.VpcEndpointId' \
  --output text)

echo "LOGS_VPC_ENDPOINT=$LOGS_VPC_ENDPOINT" >> aws-resources.txt
echo "✅ CloudWatch Logs VPC Endpoint created"

# 5. VPC Endpoint for SQS (REQUIRED for async message processing)
SQS_VPC_ENDPOINT=$(aws ec2 create-vpc-endpoint \
  --vpc-id $VPC_ID \
  --vpc-endpoint-type Interface \
  --service-name com.amazonaws.${AWS_REGION}.sqs \
  --subnet-ids $PRIVATE_SUBNET_1 $PRIVATE_SUBNET_2 \
  --security-group-ids $ECS_SG \
  --private-dns-enabled \
  --query 'VpcEndpoint.VpcEndpointId' \
  --output text)

echo "SQS_VPC_ENDPOINT=$SQS_VPC_ENDPOINT" >> aws-resources.txt
echo "✅ SQS VPC Endpoint created"

# 6. VPC Endpoint for SES (REQUIRED for sending emails)
SES_VPC_ENDPOINT=$(aws ec2 create-vpc-endpoint \
  --vpc-id $VPC_ID \
  --vpc-endpoint-type Interface \
  --service-name com.amazonaws.${AWS_REGION}.email \
  --subnet-ids $PRIVATE_SUBNET_1 $PRIVATE_SUBNET_2 \
  --security-group-ids $ECS_SG \
  --private-dns-enabled \
  --query 'VpcEndpoint.VpcEndpointId' \
  --output text)

echo "SES_VPC_ENDPOINT=$SES_VPC_ENDPOINT" >> aws-resources.txt
echo "✅ SES VPC Endpoint created"

# 7. VPC Endpoint for S3 (Gateway endpoint - FREE, no data transfer charges)
# Note: Gateway endpoint doesn't need security groups
S3_VPC_ENDPOINT=$(aws ec2 create-vpc-endpoint \
  --vpc-id $VPC_ID \
  --vpc-endpoint-type Gateway \
  --service-name com.amazonaws.${AWS_REGION}.s3 \
  --route-table-ids $PRIVATE_RT \
  --query 'VpcEndpoint.VpcEndpointId' \
  --output text)

echo "S3_VPC_ENDPOINT=$S3_VPC_ENDPOINT" >> aws-resources.txt
echo "✅ S3 Gateway VPC Endpoint created"

echo ""
echo "⏳ Waiting for VPC endpoints to be available (this takes 1-2 minutes)..."
aws ec2 describe-vpc-endpoints \
  --vpc-endpoint-ids $SECRETS_VPC_ENDPOINT $ECR_API_VPC_ENDPOINT $ECR_DKR_VPC_ENDPOINT $LOGS_VPC_ENDPOINT $SQS_VPC_ENDPOINT $SES_VPC_ENDPOINT \
  --query 'VpcEndpoints[*].{Id:VpcEndpointId,State:State,Service:ServiceName}' \
  --output table

echo ""
echo "✅ All VPC endpoints created!"
echo "   Tasks in private subnets can now access:"
echo "   - Secrets Manager (for secrets)"
echo "   - ECR (for Docker images)"
echo "   - CloudWatch Logs (for logging)"
echo "   - SQS (for async message processing)"
echo "   - SES (for sending emails)"
echo "   - S3 (for storage)"
```

**⚠️ CRITICAL: Configure VPC Endpoint Security Group Rules**

VPC endpoints need inbound rules to allow traffic from ECS tasks:

```bash
source aws-resources.txt

echo "=== Configuring VPC Endpoint Security Group Rules ==="

# Get the security group used by VPC endpoints
VPC_ENDPOINT_SG=$(aws ec2 describe-vpc-endpoints \
  --vpc-endpoint-ids $SECRETS_VPC_ENDPOINT \
  --query 'VpcEndpoints[0].Groups[0].GroupId' \
  --output text)

echo "VPC Endpoint Security Group: $VPC_ENDPOINT_SG"
echo "ECS Security Group: $ECS_SG"

# Add inbound rule to allow HTTPS (port 443) from ECS security group
# This is REQUIRED for tasks to access Secrets Manager, ECR, and CloudWatch Logs
echo ""
echo "Adding inbound rule for HTTPS from ECS tasks..."
aws ec2 authorize-security-group-ingress \
  --group-id $VPC_ENDPOINT_SG \
  --protocol tcp \
  --port 443 \
  --source-group $ECS_SG 2>&1 | grep -v "already exists" || echo "✅ Rule already exists"

echo ""
echo "✅ VPC endpoint security group configured!"
```

**✅ Verification:**

```bash
# Check VPC endpoint status
aws ec2 describe-vpc-endpoints \
  --filters "Name=vpc-id,Values=$VPC_ID" \
  --query 'VpcEndpoints[*].{Id:VpcEndpointId,Service:ServiceName,State:State}' \
  --output table

# All should show State: "available"
```

**Cost Note:**

- Interface endpoints (Secrets Manager, ECR, Logs): ~$0.01/hour each = ~$7/month each
- Gateway endpoint (S3): FREE (no hourly or data charges)
- **Total:** ~$21/month for 3 interface endpoints + free S3 endpoint
- **Alternative:** Use NAT Gateway (~$32/month + data charges), but VPC endpoints are more cost-effective for high data transfer

---

### 2.2.2 Service Communication Architecture

**How Services Communicate in This Setup:**

```
Internet
   ↓
ALB (Public)
   ↓ (port 3000 only)
API Gateway (ECS - port 3000)
   ↓ (ports 3001-3007)
   ├─→ Auth Service (3001)
   ├─→ Event Service (3002)
   ├─→ Seat Service (3003)
   ├─→ Reservation Service (3004)
   ├─→ Payment Service (3005)
   ├─→ Ticket Service (3006)
   └─→ Notification Service (3007)
        ↕ (inter-service communication)
   Services can call each other directly (3001-3007)
```

**Communication Patterns:**

1. **Client → ALB → API Gateway → Services**

   - All external traffic goes through ALB
   - ALB only forwards to API Gateway (port 3000)
   - API Gateway proxies requests to appropriate services

2. **API Gateway → Services (3001-3007)**

   - API Gateway needs to reach all services to proxy requests
   - Security group allows ECS_SG → ECS_SG on ports 3001-3007

3. **Service-to-Service Communication**

   - Services call each other directly (e.g., Payment → Reservation → Seat)
   - Same security group allows this communication
   - Uses AWS Cloud Map DNS names: `<service-name>.${PROJECT_NAME}.local:<port>`
   - Example: `http://seat-service.ticket-booking.local:3003`

4. **Services → RDS & Redis**
   - Services connect to RDS (port 5432) and Redis (port 6379)
   - Security groups allow ECS_SG → RDS_SG and ECS_SG → REDIS_SG

**Security Benefits:**

- ✅ Only API Gateway is exposed to ALB
- ✅ Services are isolated from direct internet access
- ✅ Inter-service communication stays within VPC
- ✅ Clear security boundaries

---

### 2.3 Setup RDS PostgreSQL

```bash
source aws-resources.txt

# Generate database password (or use your own)
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
echo "Database Password: $DB_PASSWORD"
echo "DB_PASSWORD=$DB_PASSWORD" >> aws-resources.txt

# Create DB subnet group
aws rds create-db-subnet-group \
  --db-subnet-group-name ${PROJECT_NAME}-db-subnet-group \
  --db-subnet-group-description "Subnet group for RDS" \
  --subnet-ids $PRIVATE_SUBNET_1 $PRIVATE_SUBNET_2

# Create RDS PostgreSQL instance
RDS_INSTANCE=$(aws rds create-db-instance \
  --db-instance-identifier ${PROJECT_NAME}-postgres \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 15.12 \
  --master-username postgres \
  --master-user-password $DB_PASSWORD \
  --allocated-storage 20 \
  --storage-type gp2 \
  --vpc-security-group-ids $RDS_SG \
  --db-subnet-group-name ${PROJECT_NAME}-db-subnet-group \
  --backup-retention-period 0 \
  --no-multi-az \
  --no-publicly-accessible \
  --storage-encrypted \
  --tags "Key=Name,Value=${PROJECT_NAME}-postgres" \
  --query 'DBInstance.DBInstanceIdentifier' \
  --output text)

echo "RDS Instance: $RDS_INSTANCE"
echo "RDS_INSTANCE=$RDS_INSTANCE" >> aws-resources.txt

# Get RDS endpoint (will be available after creation)
echo "Waiting for RDS to be available (this takes 5-10 minutes)..."
aws rds wait db-instance-available --db-instance-identifier $RDS_INSTANCE

RDS_ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier $RDS_INSTANCE \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text)

echo "RDS Endpoint: $RDS_ENDPOINT"
echo "RDS_ENDPOINT=$RDS_ENDPOINT" >> aws-resources.txt

# Note: SSL Configuration
# ✅ All services automatically detect RDS (by checking if hostname contains .rds.amazonaws.com)
# ✅ SSL is automatically enabled with rejectUnauthorized: false (RDS uses self-signed certificates)
# ✅ This is configured in database.config.ts for all services
# ✅ No RDS parameter group changes needed - SSL is handled in application code

echo ""
echo "✅ RDS instance created!"
echo ""
echo "=== Creating Databases ==="
echo "Creating databases for all services..."
echo ""
echo "⚠️  Note: This requires ECS cluster and task execution role to be created first."
echo "   If you're running this before Phase 5, skip database creation now and run it in Phase 8.1"
echo ""
echo "To create databases now, run the script in section 2.3.1 below."
echo "Or continue with deployment and create databases in Phase 8.1"
```

**✅ Verification:**

```bash
aws rds describe-db-instances --db-instance-identifier $RDS_INSTANCE
```

### 2.3.1 Create Databases (Run After ECS Cluster is Created)

**⚠️ Important:**

- **When to run:** After Phase 5 (ECS Cluster & Task Definitions) is complete, as it requires the ECS task execution role.
- **Why now:** Services will fail to start until databases exist. Creating databases early allows services to connect immediately when deployed.
- **Alternative:** You can wait until Phase 8, but services will show connection errors until then.

**Standard Approach:** Use an ECS task with a postgres client image from ECR (not Docker Hub, as tasks in private subnets can't access Docker Hub). This is the standard AWS pattern for one-time database setup tasks.

**Step 1: Push postgres image to ECR**

```bash
source aws-resources.txt

echo "=== Pushing postgres:15-alpine to ECR ==="

# Create ECR repository for postgres (if not exists)
aws ecr create-repository \
  --repository-name ${PROJECT_NAME}-postgres \
  --image-scanning-configuration scanOnPush=true \
  --tags "Key=Name,Value=${PROJECT_NAME}-postgres" 2>/dev/null || echo "Repository may already exist"

# Login to ECR
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

# Pull postgres image from Docker Hub (on your local machine)
echo "Pulling postgres:15-alpine from Docker Hub..."
docker pull postgres:15-alpine

# Tag for ECR
docker tag postgres:15-alpine ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}-postgres:15-alpine

# Push to ECR
echo "Pushing to ECR..."
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}-postgres:15-alpine

echo "✅ postgres image pushed to ECR"
```

**Step 2: Create databases using ECS task**

```bash
source aws-resources.txt
CLUSTER_NAME=${CLUSTER_NAME:-${PROJECT_NAME}-cluster}

echo "=== Creating Databases in RDS ==="

# Get RDS credentials from Secrets Manager
RDS_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id ${PROJECT_NAME}/rds/credentials \
  --query 'SecretString' \
  --output text)

DB_HOST=$(echo $RDS_SECRET | jq -r '.host')
DB_USER=$(echo $RDS_SECRET | jq -r '.username')
DB_PASS=$(echo $RDS_SECRET | jq -r '.password')

echo "RDS Host: $DB_HOST"
echo "RDS User: $DB_USER"

# Create log group
aws logs create-log-group --log-group-name /ecs/${PROJECT_NAME}-db-init || true

# Create task definition using ECR image (standard approach)
cat > task-def-db-init.json << EOF
{
  "family": "${PROJECT_NAME}-db-init",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "$ECS_TASK_ROLE_ARN",
  "taskRoleArn": "$ECS_TASK_ROLE_ARN",
  "containerDefinitions": [
    {
      "name": "db-init",
      "image": "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}-postgres:15-alpine",
      "essential": true,
      "command": [
        "sh",
        "-c",
        "psql -h $DB_HOST -U $DB_USER -d postgres -c 'CREATE DATABASE auth_db;' || true && psql -h $DB_HOST -U $DB_USER -d postgres -c 'CREATE DATABASE event_db;' || true && psql -h $DB_HOST -U $DB_USER -d postgres -c 'CREATE DATABASE seat_db;' || true && psql -h $DB_HOST -U $DB_USER -d postgres -c 'CREATE DATABASE reservation_db;' || true && psql -h $DB_HOST -U $DB_USER -d postgres -c 'CREATE DATABASE payment_db;' || true && psql -h $DB_HOST -U $DB_USER -d postgres -c 'CREATE DATABASE ticket_db;' || true && psql -h $DB_HOST -U $DB_USER -d postgres -c 'CREATE DATABASE notification_db;' || true && echo '✅ All databases created successfully'"
      ],
      "environment": [
        {"name": "PGHOST", "value": "$DB_HOST"},
        {"name": "PGUSER", "value": "$DB_USER"},
        {"name": "PGPASSWORD", "value": "$DB_PASS"},
        {"name": "PGSSLMODE", "value": "require"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/${PROJECT_NAME}-db-init",
          "awslogs-region": "${AWS_REGION}",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
EOF

# Register task definition
aws ecs register-task-definition --cli-input-json file://task-def-db-init.json

echo ""
echo "=== Running task to create databases ==="
TASK_ARN=$(aws ecs run-task \
  --cluster $CLUSTER_NAME \
  --task-definition ${PROJECT_NAME}-db-init \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNET_1,$PRIVATE_SUBNET_2],securityGroups=[$ECS_SG],assignPublicIp=DISABLED}" \
  --query 'tasks[0].taskArn' \
  --output text)

echo "Task ARN: $TASK_ARN"
echo "⏳ Waiting 60 seconds for task to complete..."
sleep 60

echo ""
echo "=== Checking task status ==="
aws ecs describe-tasks \
  --cluster $CLUSTER_NAME \
  --tasks $TASK_ARN \
  --query 'tasks[0].{Status:lastStatus,ExitCode:containers[0].exitCode}' \
  --output table

echo ""
echo "=== Checking task logs ==="
aws logs tail /ecs/${PROJECT_NAME}-db-init --since 2m --format short 2>/dev/null | tail -30

EXIT_CODE=$(aws ecs describe-tasks \
  --cluster $CLUSTER_NAME \
  --tasks $TASK_ARN \
  --query 'tasks[0].containers[0].exitCode' \
  --output text 2>/dev/null)

if [ "$EXIT_CODE" = "0" ]; then
  echo ""
  echo "✅ Databases created successfully! Services can now connect to RDS."
  echo ""
  echo "Databases created:"
  echo "  - auth_db"
  echo "  - event_db"
  echo "  - seat_db"
  echo "  - reservation_db"
  echo "  - payment_db"
  echo "  - ticket_db"
  echo "  - notification_db"
else
  echo ""
  echo "⚠️  Task exit code: $EXIT_CODE"
  echo "Check logs above for details. If exit code is not 0, databases may not have been created."
fi
```

**✅ Verification:**

```bash
# Check if databases were created (via task logs)
aws logs tail /ecs/${PROJECT_NAME}-db-init --since 5m --format short | grep -i "created\|success\|error"
```

---

### 2.4 Setup Redis (ECS Task - Cost Effective)

**⚠️ Note:** We use a Redis ECS task instead of ElastiCache because:

- **Cost:** ElastiCache costs ~$12/month minimum. ECS task costs ~$3/month.
- **Simplicity:** Our Redis usage is simple (seat locking, rate limiting).
- **Sufficient for testing:** For production with high availability, consider ElastiCache.

**Redis is used by:**

- **Seat Service:** Distributed locking for seat reservations
- **API Gateway:** Rate limiting (optional - falls back to in-memory if Redis unavailable)

```bash
source aws-resources.txt

# Generate Redis password
REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
echo "Redis Password: $REDIS_PASSWORD"
echo "REDIS_PASSWORD=$REDIS_PASSWORD" >> aws-resources.txt

# Redis will be deployed as an ECS task with service discovery
# This will be configured in Phase 5 with other services
REDIS_ENDPOINT="redis.${PROJECT_NAME}.local"
REDIS_PORT=6379

echo "Redis Endpoint: $REDIS_ENDPOINT:$REDIS_PORT"
echo "REDIS_ENDPOINT=$REDIS_ENDPOINT" >> aws-resources.txt
echo "REDIS_PORT=$REDIS_PORT" >> aws-resources.txt

echo "✅ Redis configuration saved!"
echo "   Note: Redis credentials will be stored in Secrets Manager in section 2.8"
```

**Alternative: AWS ElastiCache (For Production/High Availability)**

<details>
<summary>Click to expand ElastiCache setup (NOT RECOMMENDED for testing - costs ~$12/month)</summary>

```bash
# Only use this for production environments requiring high availability

source aws-resources.txt

# Create ElastiCache subnet group
aws elasticache create-cache-subnet-group \
  --cache-subnet-group-name ${PROJECT_NAME}-redis-subnet-group \
  --cache-subnet-group-description "Subnet group for ElastiCache" \
  --subnet-ids $PRIVATE_SUBNET_1 $PRIVATE_SUBNET_2

# Generate Redis password
REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
echo "REDIS_PASSWORD=$REDIS_PASSWORD" >> aws-resources.txt

# Create ElastiCache Redis cluster
REDIS_CLUSTER=$(aws elasticache create-cache-cluster \
  --cache-cluster-id ${PROJECT_NAME}-redis \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --engine-version 7.0 \
  --num-cache-nodes 1 \
  --cache-subnet-group-name ${PROJECT_NAME}-redis-subnet-group \
  --security-group-ids $REDIS_SG \
  --auth-token $REDIS_PASSWORD \
  --tags "Key=Name,Value=${PROJECT_NAME}-redis" \
  --query 'CacheCluster.CacheClusterId' \
  --output text)

echo "Waiting for Redis to be available (this takes 5-10 minutes)..."
aws elasticache wait cache-cluster-available --cache-cluster-id $REDIS_CLUSTER

REDIS_ENDPOINT=$(aws elasticache describe-cache-clusters \
  --cache-cluster-id $REDIS_CLUSTER \
  --show-cache-node-info \
  --query 'CacheClusters[0].CacheNodes[0].Endpoint.Address' \
  --output text)

echo "REDIS_ENDPOINT=$REDIS_ENDPOINT" >> aws-resources.txt
echo "REDIS_PORT=6379" >> aws-resources.txt
```

</details>

---

### 2.5 Create S3 Buckets

**⚠️ Important:** S3 bucket names must be **globally unique** across ALL AWS accounts. We add your AWS Account ID to ensure uniqueness.

```bash
source aws-resources.txt

# Create unique bucket names using AWS Account ID
S3_FRONTEND_BUCKET="${PROJECT_NAME}-${AWS_ACCOUNT_ID}-frontend"
S3_EVENT_IMAGES_BUCKET="${PROJECT_NAME}-${AWS_ACCOUNT_ID}-event-images"
S3_TICKETS_BUCKET="${PROJECT_NAME}-${AWS_ACCOUNT_ID}-tickets-pdf"

# Save bucket names for later use
echo "S3_FRONTEND_BUCKET=$S3_FRONTEND_BUCKET" >> aws-resources.txt
echo "S3_EVENT_IMAGES_BUCKET=$S3_EVENT_IMAGES_BUCKET" >> aws-resources.txt
echo "S3_TICKETS_BUCKET=$S3_TICKETS_BUCKET" >> aws-resources.txt

# Create S3 buckets
aws s3 mb s3://${S3_FRONTEND_BUCKET} --region $AWS_REGION
aws s3 mb s3://${S3_EVENT_IMAGES_BUCKET} --region $AWS_REGION
aws s3 mb s3://${S3_TICKETS_BUCKET} --region $AWS_REGION

echo "✅ S3 buckets created:"
echo "   Frontend: $S3_FRONTEND_BUCKET"
echo "   Event Images: $S3_EVENT_IMAGES_BUCKET"
echo "   Tickets PDF: $S3_TICKETS_BUCKET"

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket ${S3_FRONTEND_BUCKET} \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-versioning \
  --bucket ${S3_EVENT_IMAGES_BUCKET} \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-versioning \
  --bucket ${S3_TICKETS_BUCKET} \
  --versioning-configuration Status=Enabled

# Configure frontend bucket for static website hosting
cat > website-config.json << 'EOF'
{
  "IndexDocument": {
    "Suffix": "index.html"
  },
  "ErrorDocument": {
    "Key": "index.html"
  }
}
EOF

aws s3api put-bucket-website \
  --bucket ${S3_FRONTEND_BUCKET} \
  --website-configuration file://website-config.json

# Set CORS for frontend bucket
cat > cors-config.json << 'EOF'
{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "HEAD"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3000
    }
  ]
}
EOF

aws s3api put-bucket-cors \
  --bucket ${S3_FRONTEND_BUCKET} \
  --cors-configuration file://cors-config.json

echo "✅ S3 buckets created!"
```

**✅ Verification:**

```bash
aws s3 ls | grep ${AWS_ACCOUNT_ID}
```

---

### 2.6 ~~Setup Cognito User Pool~~ (NOT REQUIRED)

**⚠️ SKIP THIS SECTION - Cognito is NOT used in the current codebase.**

**Why Cognito is not needed:**

- The Auth Service uses **local JWT authentication** with bcrypt for password hashing
- User credentials are stored in PostgreSQL database
- The `cognitoSub` field in User entity is just a placeholder for future integration

**Current Authentication Flow:**

1. User registers → Password hashed with bcrypt → Stored in PostgreSQL
2. User logs in → Password verified → JWT token generated
3. JWT validated on each request using local JwtStrategy

**When to use Cognito (Future Enhancement):**

- If you need OAuth2/OIDC integration (Google, Facebook login)
- If you need advanced security features (MFA, account recovery)
- If you need to scale authentication independently

<details>
<summary>Click to expand Cognito setup (ONLY if you plan to migrate to Cognito later)</summary>

```bash
# SKIP THIS - Only for future Cognito migration

# Create Cognito User Pool
COGNITO_POOL_ID=$(aws cognito-idp create-user-pool \
  --pool-name ${PROJECT_NAME}-user-pool \
  --policies "PasswordPolicy={MinimumLength=8,RequireUppercase=true,RequireLowercase=true,RequireNumbers=true,RequireSymbols=false}" \
  --auto-verified-attributes email \
  --schema "Name=email,AttributeDataType=String,Required=true,Mutable=true" \
  --query 'UserPool.Id' \
  --output text)

echo "COGNITO_POOL_ID=$COGNITO_POOL_ID" >> aws-resources.txt

# Create User Pool Client
COGNITO_CLIENT_ID=$(aws cognito-idp create-user-pool-client \
  --user-pool-id $COGNITO_POOL_ID \
  --client-name ${PROJECT_NAME}-client \
  --generate-secret \
  --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH \
  --query 'UserPoolClient.ClientId' \
  --output text)

echo "COGNITO_CLIENT_ID=$COGNITO_CLIENT_ID" >> aws-resources.txt
```

</details>

---

### 2.7 Create SQS Queues

```bash
# Create SQS queues
QUEUE_PAYMENT=$(aws sqs create-queue \
  --queue-name ${PROJECT_NAME}-payment-processing-queue \
  --attributes "VisibilityTimeout=300" \
  --query 'QueueUrl' \
  --output text)

QUEUE_TICKET=$(aws sqs create-queue \
  --queue-name ${PROJECT_NAME}-ticket-generation-queue \
  --attributes "VisibilityTimeout=300" \
  --query 'QueueUrl' \
  --output text)

QUEUE_NOTIFICATION=$(aws sqs create-queue \
  --queue-name ${PROJECT_NAME}-notification-queue \
  --attributes "VisibilityTimeout=300" \
  --query 'QueueUrl' \
  --output text)

QUEUE_RESERVATION=$(aws sqs create-queue \
  --queue-name ${PROJECT_NAME}-reservation-expiry-queue \
  --attributes "VisibilityTimeout=300" \
  --query 'QueueUrl' \
  --output text)

QUEUE_DLQ=$(aws sqs create-queue \
  --queue-name ${PROJECT_NAME}-dead-letter-queue \
  --attributes "VisibilityTimeout=300" \
  --query 'QueueUrl' \
  --output text)

# Get queue ARNs
QUEUE_PAYMENT_ARN=$(aws sqs get-queue-attributes \
  --queue-url $QUEUE_PAYMENT \
  --attribute-names QueueArn \
  --query 'Attributes.QueueArn' \
  --output text)

QUEUE_TICKET_ARN=$(aws sqs get-queue-attributes \
  --queue-url $QUEUE_TICKET \
  --attribute-names QueueArn \
  --query 'Attributes.QueueArn' \
  --output text)

QUEUE_NOTIFICATION_ARN=$(aws sqs get-queue-attributes \
  --queue-url $QUEUE_NOTIFICATION \
  --attribute-names QueueArn \
  --query 'Attributes.QueueArn' \
  --output text)

QUEUE_RESERVATION_ARN=$(aws sqs get-queue-attributes \
  --queue-url $QUEUE_RESERVATION \
  --attribute-names QueueArn \
  --query 'Attributes.QueueArn' \
  --output text)

# Save to resources file
cat >> aws-resources.txt << EOF
QUEUE_PAYMENT=$QUEUE_PAYMENT
QUEUE_TICKET=$QUEUE_TICKET
QUEUE_NOTIFICATION=$QUEUE_NOTIFICATION
QUEUE_RESERVATION=$QUEUE_RESERVATION
QUEUE_DLQ=$QUEUE_DLQ
QUEUE_PAYMENT_ARN=$QUEUE_PAYMENT_ARN
QUEUE_TICKET_ARN=$QUEUE_TICKET_ARN
QUEUE_NOTIFICATION_ARN=$QUEUE_NOTIFICATION_ARN
QUEUE_RESERVATION_ARN=$QUEUE_RESERVATION_ARN
EOF

echo "✅ SQS queues created!"
```

**✅ Verification:**

```bash
aws sqs list-queues | grep ${PROJECT_NAME}
```

---

### 2.8 Setup AWS SES (Email Service)

**⚠️ Important:** SES is required for the notification service to send emails (ticket confirmations, etc.).

**SES Sandbox Mode:**

- By default, SES starts in sandbox mode
- In sandbox mode, you can ONLY send emails to verified email addresses
- For testing, verify your own email address
- For production, request to move out of sandbox mode

```bash
source aws-resources.txt

# Set your email address for SES
SES_FROM_EMAIL="your-email@example.com"  # ← Change this to your email
echo "SES_FROM_EMAIL=$SES_FROM_EMAIL" >> aws-resources.txt

# Step 1: Verify sender email address (REQUIRED)
aws ses verify-email-identity --email-address $SES_FROM_EMAIL
echo "📧 Verification email sent to: $SES_FROM_EMAIL"
echo "   ⚠️  Check your inbox and click the verification link!"

# Step 2: (Optional) Verify recipient email for sandbox testing
# In sandbox mode, both sender AND recipient must be verified
TEST_RECIPIENT_EMAIL="recipient@example.com"  # ← Change this
aws ses verify-email-identity --email-address $TEST_RECIPIENT_EMAIL
echo "📧 Verification email sent to: $TEST_RECIPIENT_EMAIL"

echo ""
echo "✅ SES email verification initiated!"
echo ""
echo "⚠️  IMPORTANT NEXT STEPS:"
echo "   1. Check your email inbox for verification links"
echo "   2. Click the verification links to verify both emails"
echo "   3. Run the verification check below to confirm"
```

**Wait for email verification, then verify:**

```bash
# Check verification status
aws ses get-identity-verification-attributes \
  --identities $SES_FROM_EMAIL \
  --query 'VerificationAttributes' \
  --output table

# Expected output: VerificationStatus = "Success"
```

**For Production: Request to move out of sandbox**

<details>
<summary>Click to expand production SES setup</summary>

To send emails to any address (not just verified ones), you must request production access:

```bash
# Check current SES sending limits
aws ses get-send-quota

# Request production access via AWS Console:
# 1. Go to AWS Console → SES → Account dashboard
# 2. Click "Request production access"
# 3. Fill out the form (use case, expected volume, etc.)
# 4. Wait 24-48 hours for approval
```

**Alternative: Use a verified domain instead of email:**

```bash
# Verify a domain (for production)
aws ses verify-domain-identity --domain yourdomain.com

# This returns DKIM tokens - add these as DNS TXT records
# After DNS propagation, the domain will be verified
```

</details>

---

### 2.9 Setup Secrets Manager

All secrets are consolidated here for better organization.

```bash
source aws-resources.txt

# Generate JWT secret
JWT_SECRET=$(openssl rand -base64 64 | tr -d "=+/" | cut -c1-64)
echo "JWT_SECRET=$JWT_SECRET" >> aws-resources.txt

echo "Creating secrets in AWS Secrets Manager..."

# 1. Store database credentials (RDS)
RDS_SECRET_ARN=$(aws secretsmanager create-secret \
  --name ${PROJECT_NAME}/rds/credentials \
  --secret-string "{\"username\":\"postgres\",\"password\":\"$DB_PASSWORD\",\"host\":\"$RDS_ENDPOINT\",\"port\":5432}" \
  --query 'ARN' \
  --output text)
echo "RDS_SECRET_ARN=$RDS_SECRET_ARN" >> aws-resources.txt
echo "  ✓ RDS credentials stored (ARN: $RDS_SECRET_ARN)"

# 2. Store Redis credentials (for ECS Redis task)
REDIS_SECRET_ARN=$(aws secretsmanager create-secret \
  --name ${PROJECT_NAME}/redis/credentials \
  --secret-string "{\"host\":\"$REDIS_ENDPOINT\",\"port\":$REDIS_PORT,\"password\":\"$REDIS_PASSWORD\"}" \
  --query 'ARN' \
  --output text)
echo "REDIS_SECRET_ARN=$REDIS_SECRET_ARN" >> aws-resources.txt
echo "  ✓ Redis credentials stored (ARN: $REDIS_SECRET_ARN)"

# 3. Store JWT secret (for auth-service)
JWT_SECRET_ARN=$(aws secretsmanager create-secret \
  --name ${PROJECT_NAME}/jwt/secret \
  --secret-string "{\"secret\":\"$JWT_SECRET\"}" \
  --query 'ARN' \
  --output text)
echo "JWT_SECRET_ARN=$JWT_SECRET_ARN" >> aws-resources.txt
echo "  ✓ JWT secret stored (ARN: $JWT_SECRET_ARN)"

# Note: Cognito is NOT used - auth service uses local JWT authentication
# If you need Cognito in future, uncomment:
# aws secretsmanager create-secret \
#   --name ${PROJECT_NAME}/cognito/credentials \
#   --secret-string "{\"userPoolId\":\"$COGNITO_POOL_ID\",\"clientId\":\"$COGNITO_CLIENT_ID\"}"

echo "✅ All secrets stored in Secrets Manager!"
```

**✅ Verification:**

```bash
aws secretsmanager list-secrets | grep ${PROJECT_NAME}
```

---

## 🐳 Phase 3: Container Registry (ECR) (15 minutes)

### 3.1 Create ECR Repositories

```bash
# Create repositories for all backend services
# Note: Frontend is deployed to S3 (not ECS), so it doesn't need an ECR repository
SERVICES=(
  "auth-service"
  "event-service"
  "seat-service"
  "reservation-service"
  "payment-service"
  "ticket-service"
  "notification-service"
  "api-gateway"
)

for service in "${SERVICES[@]}"; do
  echo "Creating repository: $service"
  aws ecr create-repository \
    --repository-name ${PROJECT_NAME}-${service} \
    --image-scanning-configuration scanOnPush=true \
    --encryption-configuration encryptionType=AES256 \
    --region $AWS_REGION

  # Get repository URI
  REPO_URI=$(aws ecr describe-repositories \
    --repository-names ${PROJECT_NAME}-${service} \
    --query 'repositories[0].repositoryUri' \
    --output text)

  echo "  Repository URI: $REPO_URI"
done

echo "✅ All ECR repositories created!"
```

**✅ Verification:**

```bash
aws ecr describe-repositories | grep ${PROJECT_NAME}
```

### 3.2 Get ECR Login Token

```bash
# Get ECR login token
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

echo "✅ Logged in to ECR!"
```

---

## 🏗️ Phase 4: Build & Push Docker Images (45 minutes)

**📌 Critical: External Images Must Be in ECR**

**Standard AWS Approach:** Tasks in private subnets **cannot access Docker Hub**. All external images must be pushed to ECR first:

- **Postgres image:** Pushed in Section 2.3.1 (Step 1) for database creation
- **Redis image:** Pushed in Section 5.3 (Step 1) for Redis service
- **Application images:** Built and pushed in this phase (Section 4.1)

**✅ SSL Configuration:** All services now include automatic SSL configuration for RDS connections. The database configs automatically detect RDS (by checking if hostname contains `.rds.amazonaws.com`) and enable SSL with `rejectUnauthorized: false` (required for RDS self-signed certificates). This is the **standard, production-ready approach** - no RDS parameter group changes needed.

**⚠️ Important:** After code changes (like SSL fixes), you must rebuild and push images, then redeploy services. Code changes don't automatically update running containers.

### 4.1 Build Backend Service Images

```bash
# Navigate to project root
cd /home/developer/Documents/Fullstack-Microservice-Project

# Build and push each backend service
SERVICES=(
  "auth-service"
  "event-service"
  "seat-service"
  "reservation-service"
  "payment-service"
  "ticket-service"
  "notification-service"
  "api-gateway"
)

for service in "${SERVICES[@]}"; do
  echo "=========================================="
  echo "Building: $service"
  echo "=========================================="

  # Build image
  docker build -t ${PROJECT_NAME}-${service}:latest \
    -f backend/services/${service}/Dockerfile \
    ./backend/services/${service}

  # Tag for ECR
  docker tag ${PROJECT_NAME}-${service}:latest \
    ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}-${service}:latest

  # Push to ECR
  docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}-${service}:latest

  echo "✅ $service pushed to ECR"
  echo ""
done

echo "✅ All backend services built and pushed!"
```

**✅ Verification:**

```bash
# List all images in ECR
for service in "${SERVICES[@]}"; do
  aws ecr list-images --repository-name ${PROJECT_NAME}-${service}
done
```

**Note:** Frontend is deployed to S3 (not ECS), so it doesn't need a Docker image or ECR repository. See Phase 9 for frontend deployment.

---

## 🎯 Phase 5: ECS Cluster & Task Definitions (30 minutes)

### 5.1 Create ECS Cluster

```bash
source aws-resources.txt

# Create ECS cluster
aws ecs create-cluster \
  --cluster-name $CLUSTER_NAME \
  --capacity-providers FARGATE FARGATE_SPOT \
  --default-capacity-provider-strategy "capacityProvider=FARGATE,weight=1" \
  --settings "name=containerInsights,value=enabled" \
  --tags "key=Name,value=$CLUSTER_NAME"

echo "✅ ECS cluster created: $CLUSTER_NAME"
```

**✅ Verification:**

```bash
aws ecs describe-clusters --clusters $CLUSTER_NAME
```

### 5.2 Create Task Definitions

We'll create individual task definitions for each service. First, create CloudWatch log groups:

```bash
source aws-resources.txt

# Create CloudWatch log groups for all services (including redis)
SERVICES=("auth-service" "event-service" "seat-service" "reservation-service" "payment-service" "ticket-service" "notification-service" "api-gateway" "redis")

for service in "${SERVICES[@]}"; do
  aws logs create-log-group --log-group-name /ecs/${PROJECT_NAME}-${service} || true
done

echo "✅ CloudWatch log groups created"
```

Now create individual task definitions:

**⚠️ Important:** Before creating task definitions, verify that all secrets exist in Secrets Manager (created in section 2.9):

```bash
source aws-resources.txt

# Verify secrets exist and get ARNs (save to aws-resources.txt)
echo "Verifying secrets exist and retrieving ARNs..."
RDS_SECRET_ARN=$(aws secretsmanager describe-secret --secret-id ${PROJECT_NAME}/rds/credentials --query 'ARN' --output text) || { echo "❌ RDS secret not found! Run section 2.9 first."; exit 1; }
JWT_SECRET_ARN=$(aws secretsmanager describe-secret --secret-id ${PROJECT_NAME}/jwt/secret --query 'ARN' --output text) || { echo "❌ JWT secret not found! Run section 2.9 first."; exit 1; }
REDIS_SECRET_ARN=$(aws secretsmanager describe-secret --secret-id ${PROJECT_NAME}/redis/credentials --query 'ARN' --output text) || { echo "❌ Redis secret not found! Run section 2.9 first."; exit 1; }

# Save secret ARNs to aws-resources.txt (only if not already present)
grep -q "^RDS_SECRET_ARN=" aws-resources.txt || echo "RDS_SECRET_ARN=$RDS_SECRET_ARN" >> aws-resources.txt
grep -q "^JWT_SECRET_ARN=" aws-resources.txt || echo "JWT_SECRET_ARN=$JWT_SECRET_ARN" >> aws-resources.txt
grep -q "^REDIS_SECRET_ARN=" aws-resources.txt || echo "REDIS_SECRET_ARN=$REDIS_SECRET_ARN" >> aws-resources.txt

echo "✅ All secrets verified and ARNs saved to aws-resources.txt"
```

#### 5.2.1 Auth Service Task Definition

**Note:** Auth Service uses local JWT authentication - Cognito is NOT required.

```bash
source aws-resources.txt

# Get secret ARNs from aws-resources.txt (saved in previous step)
source aws-resources.txt

# Verify ARNs exist
if [ -z "$RDS_SECRET_ARN" ] || [ -z "$JWT_SECRET_ARN" ]; then
  echo "❌ Error: Failed to retrieve secret ARNs. Make sure secrets exist in Secrets Manager."
  exit 1
fi

echo "RDS Secret ARN: $RDS_SECRET_ARN"
echo "JWT Secret ARN: $JWT_SECRET_ARN"

# Create task definition
cat > task-def-auth-service.json << EOF
{
  "family": "${PROJECT_NAME}-auth-service",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "$ECS_TASK_ROLE_ARN",
  "taskRoleArn": "$ECS_TASK_ROLE_ARN",
  "containerDefinitions": [
    {
      "name": "auth-service",
      "image": "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}-auth-service:latest",
      "essential": true,
      "portMappings": [{"containerPort": 3001, "protocol": "tcp"}],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "PORT", "value": "3001"},
        {"name": "AWS_REGION", "value": "${AWS_REGION}"},
        {"name": "DB_DATABASE", "value": "auth_db"},
        {"name": "DB_SYNCHRONIZE", "value": "false"}
      ],
      "secrets": [
        {"name": "DB_HOST", "valueFrom": "${RDS_SECRET_ARN}:host::"},
        {"name": "DB_PORT", "valueFrom": "${RDS_SECRET_ARN}:port::"},
        {"name": "DB_USERNAME", "valueFrom": "${RDS_SECRET_ARN}:username::"},
        {"name": "DB_PASSWORD", "valueFrom": "${RDS_SECRET_ARN}:password::"},
        {"name": "JWT_SECRET", "valueFrom": "${JWT_SECRET_ARN}:secret::"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/${PROJECT_NAME}-auth-service",
          "awslogs-region": "${AWS_REGION}",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1"],
        "interval": 30,
        "timeout": 10,
        "retries": 3,
        "startPeriod": 90
      }
    }
  ]
}
EOF

aws ecs register-task-definition --cli-input-json file://task-def-auth-service.json
echo "✅ Auth service task definition created"
```

#### 5.2.2 Event Service Task Definition

```bash
source aws-resources.txt
# Secret ARNs are already in aws-resources.txt from section 2.9

cat > task-def-event-service.json << EOF
{
  "family": "${PROJECT_NAME}-event-service",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "$ECS_TASK_ROLE_ARN",
  "taskRoleArn": "$ECS_TASK_ROLE_ARN",
  "containerDefinitions": [
    {
      "name": "event-service",
      "image": "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}-event-service:latest",
      "essential": true,
      "portMappings": [{"containerPort": 3002, "protocol": "tcp"}],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "PORT", "value": "3002"},
        {"name": "AWS_REGION", "value": "${AWS_REGION}"},
        {"name": "DB_DATABASE", "value": "event_db"},
        {"name": "DB_SYNCHRONIZE", "value": "false"},
        {"name": "S3_BUCKET_NAME", "value": "${S3_EVENT_IMAGES_BUCKET}"}
      ],
      "secrets": [
        {"name": "DB_HOST", "valueFrom": "${RDS_SECRET_ARN}:host::"},
        {"name": "DB_PORT", "valueFrom": "${RDS_SECRET_ARN}:port::"},
        {"name": "DB_USERNAME", "valueFrom": "${RDS_SECRET_ARN}:username::"},
        {"name": "DB_PASSWORD", "valueFrom": "${RDS_SECRET_ARN}:password::"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/${PROJECT_NAME}-event-service",
          "awslogs-region": "${AWS_REGION}",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:3002/health || exit 1"],
        "interval": 30,
        "timeout": 10,
        "retries": 3,
        "startPeriod": 90
      }
    }
  ]
}
EOF

aws ecs register-task-definition --cli-input-json file://task-def-event-service.json
echo "✅ Event service task definition created"
```

#### 5.2.3 Seat Service Task Definition

**Note:** Redis is used for distributed seat locking.

```bash
source aws-resources.txt
# Secret ARNs are already in aws-resources.txt from section 2.9

cat > task-def-seat-service.json << EOF
{
  "family": "${PROJECT_NAME}-seat-service",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "$ECS_TASK_ROLE_ARN",
  "taskRoleArn": "$ECS_TASK_ROLE_ARN",
  "containerDefinitions": [
    {
      "name": "seat-service",
      "image": "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}-seat-service:latest",
      "essential": true,
      "portMappings": [{"containerPort": 3003, "protocol": "tcp"}],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "PORT", "value": "3003"},
        {"name": "AWS_REGION", "value": "${AWS_REGION}"},
        {"name": "DB_DATABASE", "value": "seat_db"},
        {"name": "DB_SYNCHRONIZE", "value": "false"},
        {"name": "REDIS_HOST", "value": "redis.${PROJECT_NAME}.local"},
        {"name": "REDIS_PORT", "value": "6379"}
      ],
      "secrets": [
        {"name": "DB_HOST", "valueFrom": "${RDS_SECRET_ARN}:host::"},
        {"name": "DB_PORT", "valueFrom": "${RDS_SECRET_ARN}:port::"},
        {"name": "DB_USERNAME", "valueFrom": "${RDS_SECRET_ARN}:username::"},
        {"name": "DB_PASSWORD", "valueFrom": "${RDS_SECRET_ARN}:password::"},
        {"name": "REDIS_PASSWORD", "valueFrom": "${REDIS_SECRET_ARN}:password::"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/${PROJECT_NAME}-seat-service",
          "awslogs-region": "${AWS_REGION}",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:3003/api/health || exit 1"],
        "interval": 30,
        "timeout": 10,
        "retries": 3,
        "startPeriod": 90
      }
    }
  ]
}
EOF

aws ecs register-task-definition --cli-input-json file://task-def-seat-service.json
echo "✅ Seat service task definition created"
```

#### 5.2.4 Reservation Service Task Definition

```bash
source aws-resources.txt
# Secret ARNs are already in aws-resources.txt from section 2.9

cat > task-def-reservation-service.json << EOF
{
  "family": "${PROJECT_NAME}-reservation-service",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "$ECS_TASK_ROLE_ARN",
  "taskRoleArn": "$ECS_TASK_ROLE_ARN",
  "containerDefinitions": [
    {
      "name": "reservation-service",
      "image": "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}-reservation-service:latest",
      "essential": true,
      "portMappings": [{"containerPort": 3004, "protocol": "tcp"}],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "PORT", "value": "3004"},
        {"name": "AWS_REGION", "value": "${AWS_REGION}"},
        {"name": "DB_DATABASE", "value": "reservation_db"},
        {"name": "DB_SYNCHRONIZE", "value": "false"},
        {"name": "SQS_RESERVATION_EXPIRY_QUEUE_URL", "value": "$QUEUE_RESERVATION"},
        {"name": "SEAT_SERVICE_URL", "value": "http://seat-service.${PROJECT_NAME}.local:3003"}
      ],
      "secrets": [
        {"name": "DB_HOST", "valueFrom": "${RDS_SECRET_ARN}:host::"},
        {"name": "DB_PORT", "valueFrom": "${RDS_SECRET_ARN}:port::"},
        {"name": "DB_USERNAME", "valueFrom": "${RDS_SECRET_ARN}:username::"},
        {"name": "DB_PASSWORD", "valueFrom": "${RDS_SECRET_ARN}:password::"},
        {"name": "JWT_SECRET", "valueFrom": "${JWT_SECRET_ARN}:secret::"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/${PROJECT_NAME}-reservation-service",
          "awslogs-region": "${AWS_REGION}",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:3004/api/health || exit 1"],
        "interval": 30,
        "timeout": 10,
        "retries": 3,
        "startPeriod": 90
      }
    }
  ]
}
EOF

aws ecs register-task-definition --cli-input-json file://task-def-reservation-service.json
echo "✅ Reservation service task definition created"
```

#### 5.2.5 Payment Service Task Definition

```bash
source aws-resources.txt

# Secret ARNs are already in aws-resources.txt from section 2.9

cat > task-def-payment-service.json << EOF
{
  "family": "${PROJECT_NAME}-payment-service",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "$ECS_TASK_ROLE_ARN",
  "taskRoleArn": "$ECS_TASK_ROLE_ARN",
  "containerDefinitions": [
    {
      "name": "payment-service",
      "image": "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}-payment-service:latest",
      "essential": true,
      "portMappings": [{"containerPort": 3005, "protocol": "tcp"}],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "PORT", "value": "3005"},
        {"name": "AWS_REGION", "value": "${AWS_REGION}"},
        {"name": "DB_DATABASE", "value": "payment_db"},
        {"name": "DB_SYNCHRONIZE", "value": "false"},
        {"name": "SQS_TICKET_GENERATION_QUEUE_URL", "value": "$QUEUE_TICKET"},
        {"name": "RESERVATION_SERVICE_URL", "value": "http://reservation-service.${PROJECT_NAME}.local:3004"},
        {"name": "SEAT_SERVICE_URL", "value": "http://seat-service.${PROJECT_NAME}.local:3003"},
        {"name": "TICKET_SERVICE_URL", "value": "http://ticket-service.${PROJECT_NAME}.local:3006"}
      ],
      "secrets": [
        {"name": "DB_HOST", "valueFrom": "${RDS_SECRET_ARN}:host::"},
        {"name": "DB_PORT", "valueFrom": "${RDS_SECRET_ARN}:port::"},
        {"name": "DB_USERNAME", "valueFrom": "${RDS_SECRET_ARN}:username::"},
        {"name": "DB_PASSWORD", "valueFrom": "${RDS_SECRET_ARN}:password::"},
        {"name": "JWT_SECRET", "valueFrom": "${JWT_SECRET_ARN}:secret::"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/${PROJECT_NAME}-payment-service",
          "awslogs-region": "${AWS_REGION}",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:3005/api/health || exit 1"],
        "interval": 30,
        "timeout": 10,
        "retries": 3,
        "startPeriod": 90
      }
    }
  ]
}
EOF

aws ecs register-task-definition --cli-input-json file://task-def-payment-service.json
echo "✅ Payment service task definition created"
```

#### 5.2.6 Ticket Service Task Definition

**⚠️ Important:** After ALB is created in Phase 6, you MUST update `API_GATEWAY_URL` to use the ALB DNS. See section "6.2.1 Update Ticket Service with ALB DNS" for detailed steps.

```bash
source aws-resources.txt

# Secret ARNs are already in aws-resources.txt from section 2.9

cat > task-def-ticket-service.json << EOF
{
  "family": "${PROJECT_NAME}-ticket-service",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "$ECS_TASK_ROLE_ARN",
  "taskRoleArn": "$ECS_TASK_ROLE_ARN",
  "containerDefinitions": [
    {
      "name": "ticket-service",
      "image": "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}-ticket-service:latest",
      "essential": true,
      "portMappings": [{"containerPort": 3006, "protocol": "tcp"}],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "PORT", "value": "3006"},
        {"name": "AWS_REGION", "value": "${AWS_REGION}"},
        {"name": "DB_DATABASE", "value": "ticket_db"},
        {"name": "DB_SYNCHRONIZE", "value": "false"},
        {"name": "S3_BUCKET_NAME", "value": "${S3_TICKETS_BUCKET}"},
        {"name": "SQS_TICKET_GENERATION_QUEUE_URL", "value": "$QUEUE_TICKET"},
        {"name": "SQS_NOTIFICATION_QUEUE_URL", "value": "$QUEUE_NOTIFICATION"},
        {"name": "EVENT_SERVICE_URL", "value": "http://event-service.${PROJECT_NAME}.local:3002"},
        {"name": "SEAT_SERVICE_URL", "value": "http://seat-service.${PROJECT_NAME}.local:3003"},
        {"name": "RESERVATION_SERVICE_URL", "value": "http://reservation-service.${PROJECT_NAME}.local:3004"},
        {"name": "AUTH_SERVICE_URL", "value": "http://auth-service.${PROJECT_NAME}.local:3001"},
        {"name": "API_GATEWAY_URL", "value": "http://api-gateway.${PROJECT_NAME}.local:3000"}
      ],
      "secrets": [
        {"name": "DB_HOST", "valueFrom": "${RDS_SECRET_ARN}:host::"},
        {"name": "DB_PORT", "valueFrom": "${RDS_SECRET_ARN}:port::"},
        {"name": "DB_USERNAME", "valueFrom": "${RDS_SECRET_ARN}:username::"},
        {"name": "DB_PASSWORD", "valueFrom": "${RDS_SECRET_ARN}:password::"},
        {"name": "JWT_SECRET", "valueFrom": "${JWT_SECRET_ARN}:secret::"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/${PROJECT_NAME}-ticket-service",
          "awslogs-region": "${AWS_REGION}",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:3006/api/health || exit 1"],
        "interval": 30,
        "timeout": 10,
        "retries": 3,
        "startPeriod": 90
      }
    }
  ]
}
EOF

aws ecs register-task-definition --cli-input-json file://task-def-ticket-service.json
echo "✅ Ticket service task definition created"
```

#### 5.2.7 Notification Service Task Definition

```bash
source aws-resources.txt

# Secret ARNs are already in aws-resources.txt from section 2.9

cat > task-def-notification-service.json << EOF
{
  "family": "${PROJECT_NAME}-notification-service",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "$ECS_TASK_ROLE_ARN",
  "taskRoleArn": "$ECS_TASK_ROLE_ARN",
  "containerDefinitions": [
    {
      "name": "notification-service",
      "image": "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}-notification-service:latest",
      "essential": true,
      "portMappings": [{"containerPort": 3007, "protocol": "tcp"}],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "PORT", "value": "3007"},
        {"name": "AWS_REGION", "value": "${AWS_REGION}"},
        {"name": "DB_DATABASE", "value": "notification_db"},
        {"name": "DB_SYNCHRONIZE", "value": "false"},
        {"name": "SQS_NOTIFICATION_QUEUE_URL", "value": "$QUEUE_NOTIFICATION"},
        {"name": "SES_FROM_EMAIL", "value": "$SES_FROM_EMAIL"}
      ],
      "secrets": [
        {"name": "DB_HOST", "valueFrom": "${RDS_SECRET_ARN}:host::"},
        {"name": "DB_PORT", "valueFrom": "${RDS_SECRET_ARN}:port::"},
        {"name": "DB_USERNAME", "valueFrom": "${RDS_SECRET_ARN}:username::"},
        {"name": "DB_PASSWORD", "valueFrom": "${RDS_SECRET_ARN}:password::"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/${PROJECT_NAME}-notification-service",
          "awslogs-region": "${AWS_REGION}",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:3007/api/health || exit 1"],
        "interval": 30,
        "timeout": 10,
        "retries": 3,
        "startPeriod": 90
      }
    }
  ]
}
EOF

aws ecs register-task-definition --cli-input-json file://task-def-notification-service.json
echo "✅ Notification service task definition created"
```

#### 5.2.8 API Gateway Task Definition

**Note:** API Gateway uses more resources (512 CPU, 1024 memory) and has Redis for rate limiting.

```bash
source aws-resources.txt

# Secret ARNs are already in aws-resources.txt from section 2.9

cat > task-def-api-gateway.json << EOF
{
  "family": "${PROJECT_NAME}-api-gateway",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "$ECS_TASK_ROLE_ARN",
  "taskRoleArn": "$ECS_TASK_ROLE_ARN",
  "containerDefinitions": [
    {
      "name": "api-gateway",
      "image": "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}-api-gateway:latest",
      "essential": true,
      "portMappings": [{"containerPort": 3000, "protocol": "tcp"}],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "PORT", "value": "3000"},
        {"name": "AWS_REGION", "value": "${AWS_REGION}"},
        {"name": "AUTH_SERVICE_URL", "value": "http://auth-service.${PROJECT_NAME}.local:3001"},
        {"name": "EVENT_SERVICE_URL", "value": "http://event-service.${PROJECT_NAME}.local:3002"},
        {"name": "SEAT_SERVICE_URL", "value": "http://seat-service.${PROJECT_NAME}.local:3003"},
        {"name": "RESERVATION_SERVICE_URL", "value": "http://reservation-service.${PROJECT_NAME}.local:3004"},
        {"name": "PAYMENT_SERVICE_URL", "value": "http://payment-service.${PROJECT_NAME}.local:3005"},
        {"name": "TICKET_SERVICE_URL", "value": "http://ticket-service.${PROJECT_NAME}.local:3006"},
        {"name": "NOTIFICATION_SERVICE_URL", "value": "http://notification-service.${PROJECT_NAME}.local:3007"},
        {"name": "REDIS_HOST", "value": "redis.${PROJECT_NAME}.local"},
        {"name": "REDIS_PORT", "value": "6379"}
      ],
      "secrets": [
        {"name": "JWT_SECRET", "valueFrom": "${JWT_SECRET_ARN}:secret::"},
        {"name": "REDIS_PASSWORD", "valueFrom": "${REDIS_SECRET_ARN}:password::"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/${PROJECT_NAME}-api-gateway",
          "awslogs-region": "${AWS_REGION}",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1"],
        "interval": 30,
        "timeout": 10,
        "retries": 3,
        "startPeriod": 90
      }
    }
  ]
}
EOF

aws ecs register-task-definition --cli-input-json file://task-def-api-gateway.json
echo "✅ API Gateway task definition created"
```

**✅ Verification:**

```bash
# List all task definitions
aws ecs list-task-definitions --family-prefix ${PROJECT_NAME}
```

### 5.3 Create Redis Task Definition

Redis runs as an ECS task (not ElastiCache) and needs a separate task definition:

#### Redis Task Definition (ECS - Cost Effective Alternative to ElastiCache)

**Why ECS instead of ElastiCache:**

- **Cost:** ~$3/month vs ~$12/month for ElastiCache
- **Simplicity:** Simple Redis use case (seat locking, rate limiting)
- **Sufficient:** For development/testing; consider ElastiCache for production HA

**📌 Standard Approach:** Tasks in private subnets can't access Docker Hub. Push Redis image to ECR first.

**Step 1: Push Redis Image to ECR**

```bash
source aws-resources.txt

# Login to ECR
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

# Create ECR repository for Redis
aws ecr describe-repositories --repository-names ${PROJECT_NAME}-redis 2>/dev/null || \
aws ecr create-repository \
  --repository-name ${PROJECT_NAME}-redis \
  --image-scanning-configuration scanOnPush=true \
  --encryption-configuration encryptionType=AES256

# Pull Redis image from Docker Hub (on local machine with internet)
docker pull redis:7-alpine

# Tag for ECR
docker tag redis:7-alpine \
  ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}-redis:7-alpine

docker tag redis:7-alpine \
  ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}-redis:latest

# Push to ECR
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}-redis:7-alpine
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}-redis:latest

echo "✅ Redis image pushed to ECR"
```

**Step 2: Create Redis Task Definition (Using ECR Image)**

```bash
source aws-resources.txt

# Secret ARNs are already in aws-resources.txt from section 2.9

# Create CloudWatch log group
aws logs create-log-group --log-group-name /ecs/${PROJECT_NAME}-redis || true

# Create Redis task definition (using ECR image, not Docker Hub)
cat > task-def-redis.json << EOF
{
  "family": "${PROJECT_NAME}-redis",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "$ECS_TASK_ROLE_ARN",
  "taskRoleArn": "$ECS_TASK_ROLE_ARN",
  "containerDefinitions": [
    {
      "name": "redis",
      "image": "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}-redis:7-alpine",
      "essential": true,
      "portMappings": [{"containerPort": 6379, "protocol": "tcp"}],
      "command": ["sh", "-c", "redis-server --requirepass \"$REDIS_PASSWORD\""],
      "secrets": [
        {"name": "REDIS_PASSWORD", "valueFrom": "${REDIS_SECRET_ARN}:password::"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/${PROJECT_NAME}-redis",
          "awslogs-region": "${AWS_REGION}",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "redis-cli -a \"$REDIS_PASSWORD\" ping || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 10
      }
    }
  ]
}
EOF

aws ecs register-task-definition --cli-input-json file://task-def-redis.json
echo "✅ Redis task definition created"
```

**✅ Verification:**

```bash
# List all task definitions
aws ecs list-task-definitions --family-prefix ${PROJECT_NAME}
```

---

## 🚀 Phase 6: ECS Services Deployment (30 minutes)

**📌 Critical Deployment Order (Standard AWS Approach):**

1. **6.1** - Create ALB (must be done first)
2. **6.2** - Create Target Groups (required for API Gateway)
3. **6.3** - Setup Service Discovery (for inter-service communication)
4. **6.4** - Deploy Services (API Gateway requires ALB + Target Group from steps 1-2)

**⚠️ Important:** API Gateway service (6.4.8) **requires** the target group from section 6.2. This ensures ECS automatically manages ALB target registration (standard AWS approach). Do not skip or reorder these sections.

**Why This Order Matters:**

- ECS can automatically register/deregister targets when services include load balancer configuration
- This is the production-standard approach - no manual target registration needed
- If you create services before ALB/Target Groups, you'll need manual workarounds (not recommended)

### 6.1 Create Application Load Balancer

```bash
source aws-resources.txt

# Create ALB
ALB_ARN=$(aws elbv2 create-load-balancer \
  --name ${PROJECT_NAME}-alb \
  --subnets $PUBLIC_SUBNET_1 $PUBLIC_SUBNET_2 \
  --security-groups $ALB_SG \
  --scheme internet-facing \
  --type application \
  --ip-address-type ipv4 \
  --query 'LoadBalancers[0].LoadBalancerArn' \
  --output text)

echo "ALB ARN: $ALB_ARN"
echo "ALB_ARN=$ALB_ARN" >> aws-resources.txt

# Get ALB DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers \
  --load-balancer-arns $ALB_ARN \
  --query 'LoadBalancers[0].DNSName' \
  --output text)

echo "ALB DNS: $ALB_DNS"
echo "ALB_DNS=$ALB_DNS" >> aws-resources.txt

# Wait for ALB to be active
echo "Waiting for ALB to be active..."
aws elbv2 wait load-balancer-available --load-balancer-arns $ALB_ARN
echo "✅ ALB is ready!"

# ⚠️ Important: Update ticket-service API_GATEWAY_URL to use ALB DNS
# Ticket service needs the public ALB URL for generating ticket download links
echo ""
echo "⚠️  IMPORTANT: Update ticket-service task definition with ALB DNS for API_GATEWAY_URL"
echo "   Current: http://api-gateway.${PROJECT_NAME}.local:3000"
echo "   Update to: http://${ALB_DNS}"
echo "   See instructions below for updating the task definition"
```

### 6.2 Create Target Groups

```bash
source aws-resources.txt

# Create target group for API Gateway
TG_API_GW=$(aws elbv2 create-target-group \
  --name ${PROJECT_NAME}-api-gateway-tg \
  --protocol HTTP \
  --port 3000 \
  --vpc-id $VPC_ID \
  --target-type ip \
  --health-check-path /health \
  --health-check-interval-seconds 30 \
  --health-check-timeout-seconds 5 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --query 'TargetGroups[0].TargetGroupArn' \
  --output text)

echo "API Gateway Target Group: $TG_API_GW"
echo "TG_API_GW=$TG_API_GW" >> aws-resources.txt

# Create listener for ALB (port 80)
LISTENER_ARN=$(aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=forward,TargetGroupArn=$TG_API_GW \
  --query 'Listeners[0].ListenerArn' \
  --output text)

echo "Listener ARN: $LISTENER_ARN"
echo "LISTENER_ARN=$LISTENER_ARN" >> aws-resources.txt

echo "✅ Target groups and listener created!"
```

### 6.2.1 Update Ticket Service with ALB DNS (Important)

**⚠️ Important:** The ticket service uses `API_GATEWAY_URL` to generate ticket download URLs that users access. This must be the public ALB DNS name, not the internal service discovery URL.

```bash
source aws-resources.txt

# Check if service exists
SERVICE_EXISTS=$(aws ecs describe-services \
  --cluster ${PROJECT_NAME}-cluster \
  --services ${PROJECT_NAME}-ticket-service \
  --query 'services[0].status' \
  --output text 2>/dev/null)

if [ "$SERVICE_EXISTS" = "ACTIVE" ]; then
  echo "✅ Service exists. Updating task definition and service..."
  UPDATE_SERVICE=true
else
  echo "⚠️  Service doesn't exist yet (will be created in section 6.4)."
  echo "   Registering task definition now. Service will use it when created."
  UPDATE_SERVICE=false
fi

# Get current task definition
aws ecs describe-task-definition \
  --task-definition ${PROJECT_NAME}-ticket-service \
  --query 'taskDefinition' > task-def-ticket-service-current.json

# Update API_GATEWAY_URL to use ALB DNS and remove ALL metadata fields
# Build a clean JSON with only allowed fields for task definition registration
cat task-def-ticket-service-current.json | \
  jq --arg alb_dns "$ALB_DNS" '{
    family: .family,
    networkMode: .networkMode,
    requiresCompatibilities: .requiresCompatibilities,
    cpu: .cpu,
    memory: .memory,
    executionRoleArn: .executionRoleArn,
    taskRoleArn: .taskRoleArn,
    containerDefinitions: [
      .containerDefinitions[0] |
      del(.cpu) |
      .environment = (.environment | map(
        if .name == "API_GATEWAY_URL" then .value = "http://\($alb_dns)" else . end
      ))
    ]
  }' > task-def-ticket-service-updated.json

# Register new task definition revision
NEW_TASK_DEF_ARN=$(aws ecs register-task-definition \
  --cli-input-json file://task-def-ticket-service-updated.json \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)

echo "✅ New task definition registered: $NEW_TASK_DEF_ARN"

# Update the service only if it exists
if [ "$UPDATE_SERVICE" = "true" ]; then
  aws ecs update-service \
    --cluster ${PROJECT_NAME}-cluster \
    --service ${PROJECT_NAME}-ticket-service \
    --task-definition ${PROJECT_NAME}-ticket-service \
    --force-new-deployment

  echo "✅ Service updated with new task definition"
  echo "   Service is deploying. This may take 2-3 minutes."
else
  echo "✅ Task definition ready. When service is created in section 6.4, it will use this task definition."
  echo "   Or run this command again after section 6.4 to update the existing service."
fi
```

**Note:** This update is required for ticket download URLs to work correctly. Users will access tickets via the public ALB, not the internal service discovery URL.

---

### 6.3 Setup AWS Cloud Map (Service Discovery)

**Why Service Discovery?**

- ✅ Automatic DNS resolution for services
- ✅ Health check-based service registration
- ✅ No need to hardcode IPs or service names
- ✅ Works seamlessly with ECS Fargate
- ✅ Production-ready approach

```bash
source aws-resources.txt

# Create private DNS namespace for service discovery
NAMESPACE_ID=$(aws servicediscovery create-private-dns-namespace \
  --name ${PROJECT_NAME}.local \
  --vpc $VPC_ID \
  --description "Service discovery namespace for ${PROJECT_NAME}" \
  --query 'OperationId' \
  --output text)

echo "Service Discovery Namespace Operation ID: $NAMESPACE_ID"
echo "NAMESPACE_OP_ID=$NAMESPACE_ID" >> aws-resources.txt

# Wait for namespace to be created (takes 30-60 seconds)
echo "Waiting for namespace to be ready..."
aws servicediscovery get-operation --operation-id $NAMESPACE_ID --query 'Operation.Status' --output text

# Poll until ready
while true; do
  STATUS=$(aws servicediscovery get-operation --operation-id $NAMESPACE_ID --query 'Operation.Status' --output text)
  if [ "$STATUS" = "SUCCESS" ]; then
    break
  fi
  echo "Status: $STATUS, waiting..."
  sleep 5
done

# Get the actual namespace ID
NAMESPACE_ARN=$(aws servicediscovery list-namespaces \
  --filters "Name=TYPE,Values=DNS_PRIVATE" \
  --query "Namespaces[?Name=='${PROJECT_NAME}.local'].Arn" \
  --output text)

NAMESPACE_ID=$(aws servicediscovery list-namespaces \
  --filters "Name=TYPE,Values=DNS_PRIVATE" \
  --query "Namespaces[?Name=='${PROJECT_NAME}.local'].Id" \
  --output text)

echo "Namespace ID: $NAMESPACE_ID"
echo "Namespace ARN: $NAMESPACE_ARN"
echo "NAMESPACE_ID=$NAMESPACE_ID" >> aws-resources.txt
echo "NAMESPACE_ARN=$NAMESPACE_ARN" >> aws-resources.txt

echo "✅ Service Discovery namespace created!"
```

**How Service Discovery Works:**

- Each service gets a DNS name: `<service-name>.${PROJECT_NAME}.local`
- Example: `auth-service.ticket-booking.local` resolves to the service's private IP
- ECS automatically registers/deregisters services based on health checks
- Services can communicate using these DNS names
- **DNS Format:** `http://<service-name>.<project-name>.local:<port>`
  - Auth Service: `http://auth-service.ticket-booking.local:3001`
  - Event Service: `http://event-service.ticket-booking.local:3002`
  - Seat Service: `http://seat-service.ticket-booking.local:3003`
  - And so on...

**Benefits:**

- ✅ No hardcoded IPs - DNS automatically resolves to current task IPs
- ✅ Automatic failover - unhealthy tasks are removed from DNS
- ✅ Load balancing - Multiple tasks share the same DNS name
- ✅ Production-ready - Used by AWS for service mesh and microservices

### 6.4 Deploy ECS Services with Service Discovery

Deploy services with service discovery enabled. Each service needs:

1. Service Discovery entry (for DNS resolution)
2. ECS Service (runs the tasks)

**Setup:**

```bash
source aws-resources.txt

# Set cluster name (if not already in aws-resources.txt)
CLUSTER_NAME=${CLUSTER_NAME:-${PROJECT_NAME}-cluster}
echo "Using cluster: $CLUSTER_NAME"
```

#### 6.4.1 Deploy Auth Service

```bash
source aws-resources.txt
CLUSTER_NAME=${CLUSTER_NAME:-${PROJECT_NAME}-cluster}

# Check if service discovery already exists, create if not
AUTH_SD_ARN=$(aws servicediscovery list-services \
  --filters "Name=NAMESPACE_ID,Values=$NAMESPACE_ID" \
  --query "Services[?Name=='auth-service'].Arn" \
  --output text 2>/dev/null)

if [ -z "$AUTH_SD_ARN" ]; then
  echo "Creating service discovery for auth-service..."
  AUTH_SD_ARN=$(aws servicediscovery create-service \
    --name auth-service \
    --namespace-id $NAMESPACE_ID \
    --dns-config "NamespaceId=${NAMESPACE_ID},DnsRecords=[{Type=A,TTL=60}]" \
    --health-check-custom-config "FailureThreshold=2" \
    --query 'Service.Arn' \
    --output text)
  echo "AUTH_SD_ARN=$AUTH_SD_ARN" >> aws-resources.txt
  echo "✅ Service discovery created for auth-service"
else
  echo "✅ Service discovery already exists for auth-service"
fi

# Check if ECS service already exists
if aws ecs describe-services --cluster $CLUSTER_NAME --services ${PROJECT_NAME}-auth-service --query 'services[0].status' --output text 2>/dev/null | grep -q ACTIVE; then
  echo "⚠️  ECS service ${PROJECT_NAME}-auth-service already exists. Skipping creation."
else
  # Create ECS service
  aws ecs create-service \
    --cluster $CLUSTER_NAME \
    --service-name ${PROJECT_NAME}-auth-service \
    --task-definition ${PROJECT_NAME}-auth-service \
    --desired-count 1 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNET_1,$PRIVATE_SUBNET_2],securityGroups=[$ECS_SG],assignPublicIp=DISABLED}" \
    --service-registries "registryArn=${AUTH_SD_ARN}" \
    --tags "key=Name,value=${PROJECT_NAME}-auth-service"

  echo "✅ Auth service deployed: auth-service.${PROJECT_NAME}.local:3001"
fi
```

#### 6.4.2 Deploy Event Service

```bash
source aws-resources.txt
CLUSTER_NAME=${CLUSTER_NAME:-${PROJECT_NAME}-cluster}

# Check if service discovery already exists
EVENT_SD_ARN=$(aws servicediscovery list-services \
  --filters "Name=NAMESPACE_ID,Values=$NAMESPACE_ID" \
  --query "Services[?Name=='event-service'].Arn" \
  --output text 2>/dev/null)

if [ -z "$EVENT_SD_ARN" ]; then
  echo "Creating service discovery for event-service..."
  EVENT_SD_ARN=$(aws servicediscovery create-service \
    --name event-service \
    --namespace-id $NAMESPACE_ID \
    --dns-config "NamespaceId=${NAMESPACE_ID},DnsRecords=[{Type=A,TTL=60}]" \
    --health-check-custom-config "FailureThreshold=2" \
    --query 'Service.Arn' \
    --output text)
  echo "EVENT_SD_ARN=$EVENT_SD_ARN" >> aws-resources.txt
  echo "✅ Service discovery created for event-service"
else
  echo "✅ Service discovery already exists for event-service"
fi

# Check if ECS service already exists
if aws ecs describe-services --cluster $CLUSTER_NAME --services ${PROJECT_NAME}-event-service --query 'services[0].status' --output text 2>/dev/null | grep -q ACTIVE; then
  echo "⚠️  ECS service ${PROJECT_NAME}-event-service already exists. Skipping creation."
else
  aws ecs create-service \
    --cluster $CLUSTER_NAME \
    --service-name ${PROJECT_NAME}-event-service \
    --task-definition ${PROJECT_NAME}-event-service \
    --desired-count 1 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNET_1,$PRIVATE_SUBNET_2],securityGroups=[$ECS_SG],assignPublicIp=DISABLED}" \
    --service-registries "registryArn=${EVENT_SD_ARN}" \
    --tags "key=Name,value=${PROJECT_NAME}-event-service"

  echo "✅ Event service deployed: event-service.${PROJECT_NAME}.local:3002"
fi
```

#### 6.4.3 Deploy Seat Service

```bash
source aws-resources.txt
CLUSTER_NAME=${CLUSTER_NAME:-${PROJECT_NAME}-cluster}

SEAT_SD_ARN=$(aws servicediscovery list-services \
  --filters "Name=NAMESPACE_ID,Values=$NAMESPACE_ID" \
  --query "Services[?Name=='seat-service'].Arn" \
  --output text 2>/dev/null)

if [ -z "$SEAT_SD_ARN" ]; then
  SEAT_SD_ARN=$(aws servicediscovery create-service \
    --name seat-service \
    --namespace-id $NAMESPACE_ID \
    --dns-config "NamespaceId=${NAMESPACE_ID},DnsRecords=[{Type=A,TTL=60}]" \
    --health-check-custom-config "FailureThreshold=2" \
    --query 'Service.Arn' \
    --output text)
  echo "SEAT_SD_ARN=$SEAT_SD_ARN" >> aws-resources.txt
  echo "✅ Service discovery created for seat-service"
else
  echo "✅ Service discovery already exists for seat-service"
fi

if aws ecs describe-services --cluster $CLUSTER_NAME --services ${PROJECT_NAME}-seat-service --query 'services[0].status' --output text 2>/dev/null | grep -q ACTIVE; then
  echo "⚠️  ECS service ${PROJECT_NAME}-seat-service already exists. Skipping creation."
else
  aws ecs create-service \
    --cluster $CLUSTER_NAME \
    --service-name ${PROJECT_NAME}-seat-service \
    --task-definition ${PROJECT_NAME}-seat-service \
    --desired-count 1 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNET_1,$PRIVATE_SUBNET_2],securityGroups=[$ECS_SG],assignPublicIp=DISABLED}" \
    --service-registries "registryArn=${SEAT_SD_ARN}" \
    --tags "key=Name,value=${PROJECT_NAME}-seat-service"

  echo "✅ Seat service deployed: seat-service.${PROJECT_NAME}.local:3003"
fi
```

#### 6.4.4 Deploy Reservation Service

```bash
source aws-resources.txt
CLUSTER_NAME=${CLUSTER_NAME:-${PROJECT_NAME}-cluster}

RESERVATION_SD_ARN=$(aws servicediscovery list-services \
  --filters "Name=NAMESPACE_ID,Values=$NAMESPACE_ID" \
  --query "Services[?Name=='reservation-service'].Arn" \
  --output text 2>/dev/null)

if [ -z "$RESERVATION_SD_ARN" ]; then
  RESERVATION_SD_ARN=$(aws servicediscovery create-service \
    --name reservation-service \
    --namespace-id $NAMESPACE_ID \
    --dns-config "NamespaceId=${NAMESPACE_ID},DnsRecords=[{Type=A,TTL=60}]" \
    --health-check-custom-config "FailureThreshold=2" \
    --query 'Service.Arn' \
    --output text)
  echo "RESERVATION_SD_ARN=$RESERVATION_SD_ARN" >> aws-resources.txt
  echo "✅ Service discovery created for reservation-service"
else
  echo "✅ Service discovery already exists for reservation-service"
fi

if aws ecs describe-services --cluster $CLUSTER_NAME --services ${PROJECT_NAME}-reservation-service --query 'services[0].status' --output text 2>/dev/null | grep -q ACTIVE; then
  echo "⚠️  ECS service ${PROJECT_NAME}-reservation-service already exists. Skipping creation."
else
  aws ecs create-service \
    --cluster $CLUSTER_NAME \
    --service-name ${PROJECT_NAME}-reservation-service \
    --task-definition ${PROJECT_NAME}-reservation-service \
    --desired-count 1 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNET_1,$PRIVATE_SUBNET_2],securityGroups=[$ECS_SG],assignPublicIp=DISABLED}" \
    --service-registries "registryArn=${RESERVATION_SD_ARN}" \
    --tags "key=Name,value=${PROJECT_NAME}-reservation-service"

  echo "✅ Reservation service deployed: reservation-service.${PROJECT_NAME}.local:3004"
fi
```

#### 6.4.5 Deploy Payment Service

```bash
source aws-resources.txt
CLUSTER_NAME=${CLUSTER_NAME:-${PROJECT_NAME}-cluster}

PAYMENT_SD_ARN=$(aws servicediscovery list-services \
  --filters "Name=NAMESPACE_ID,Values=$NAMESPACE_ID" \
  --query "Services[?Name=='payment-service'].Arn" \
  --output text 2>/dev/null)

if [ -z "$PAYMENT_SD_ARN" ]; then
  PAYMENT_SD_ARN=$(aws servicediscovery create-service \
    --name payment-service \
    --namespace-id $NAMESPACE_ID \
    --dns-config "NamespaceId=${NAMESPACE_ID},DnsRecords=[{Type=A,TTL=60}]" \
    --health-check-custom-config "FailureThreshold=2" \
    --query 'Service.Arn' \
    --output text)
  echo "PAYMENT_SD_ARN=$PAYMENT_SD_ARN" >> aws-resources.txt
  echo "✅ Service discovery created for payment-service"
else
  echo "✅ Service discovery already exists for payment-service"
fi

if aws ecs describe-services --cluster $CLUSTER_NAME --services ${PROJECT_NAME}-payment-service --query 'services[0].status' --output text 2>/dev/null | grep -q ACTIVE; then
  echo "⚠️  ECS service ${PROJECT_NAME}-payment-service already exists. Skipping creation."
else
  aws ecs create-service \
    --cluster $CLUSTER_NAME \
    --service-name ${PROJECT_NAME}-payment-service \
    --task-definition ${PROJECT_NAME}-payment-service \
    --desired-count 1 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNET_1,$PRIVATE_SUBNET_2],securityGroups=[$ECS_SG],assignPublicIp=DISABLED}" \
    --service-registries "registryArn=${PAYMENT_SD_ARN}" \
    --tags "key=Name,value=${PROJECT_NAME}-payment-service"

  echo "✅ Payment service deployed: payment-service.${PROJECT_NAME}.local:3005"
fi
```

#### 6.4.6 Deploy Ticket Service

```bash
source aws-resources.txt
CLUSTER_NAME=${CLUSTER_NAME:-${PROJECT_NAME}-cluster}

TICKET_SD_ARN=$(aws servicediscovery list-services \
  --filters "Name=NAMESPACE_ID,Values=$NAMESPACE_ID" \
  --query "Services[?Name=='ticket-service'].Arn" \
  --output text 2>/dev/null)

if [ -z "$TICKET_SD_ARN" ]; then
  TICKET_SD_ARN=$(aws servicediscovery create-service \
    --name ticket-service \
    --namespace-id $NAMESPACE_ID \
    --dns-config "NamespaceId=${NAMESPACE_ID},DnsRecords=[{Type=A,TTL=60}]" \
    --health-check-custom-config "FailureThreshold=2" \
    --query 'Service.Arn' \
    --output text)
  echo "TICKET_SD_ARN=$TICKET_SD_ARN" >> aws-resources.txt
  echo "✅ Service discovery created for ticket-service"
else
  echo "✅ Service discovery already exists for ticket-service"
fi

if aws ecs describe-services --cluster $CLUSTER_NAME --services ${PROJECT_NAME}-ticket-service --query 'services[0].status' --output text 2>/dev/null | grep -q ACTIVE; then
  echo "⚠️  ECS service ${PROJECT_NAME}-ticket-service already exists. Skipping creation."
else
  aws ecs create-service \
    --cluster $CLUSTER_NAME \
    --service-name ${PROJECT_NAME}-ticket-service \
    --task-definition ${PROJECT_NAME}-ticket-service \
    --desired-count 1 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNET_1,$PRIVATE_SUBNET_2],securityGroups=[$ECS_SG],assignPublicIp=DISABLED}" \
    --service-registries "registryArn=${TICKET_SD_ARN}" \
    --tags "key=Name,value=${PROJECT_NAME}-ticket-service"

  echo "✅ Ticket service deployed: ticket-service.${PROJECT_NAME}.local:3006"
fi
```

#### 6.4.7 Deploy Notification Service

```bash
source aws-resources.txt
CLUSTER_NAME=${CLUSTER_NAME:-${PROJECT_NAME}-cluster}

NOTIFICATION_SD_ARN=$(aws servicediscovery list-services \
  --filters "Name=NAMESPACE_ID,Values=$NAMESPACE_ID" \
  --query "Services[?Name=='notification-service'].Arn" \
  --output text 2>/dev/null)

if [ -z "$NOTIFICATION_SD_ARN" ]; then
  NOTIFICATION_SD_ARN=$(aws servicediscovery create-service \
    --name notification-service \
    --namespace-id $NAMESPACE_ID \
    --dns-config "NamespaceId=${NAMESPACE_ID},DnsRecords=[{Type=A,TTL=60}]" \
    --health-check-custom-config "FailureThreshold=2" \
    --query 'Service.Arn' \
    --output text)
  echo "NOTIFICATION_SD_ARN=$NOTIFICATION_SD_ARN" >> aws-resources.txt
  echo "✅ Service discovery created for notification-service"
else
  echo "✅ Service discovery already exists for notification-service"
fi

if aws ecs describe-services --cluster $CLUSTER_NAME --services ${PROJECT_NAME}-notification-service --query 'services[0].status' --output text 2>/dev/null | grep -q ACTIVE; then
  echo "⚠️  ECS service ${PROJECT_NAME}-notification-service already exists. Skipping creation."
else
  aws ecs create-service \
    --cluster $CLUSTER_NAME \
    --service-name ${PROJECT_NAME}-notification-service \
    --task-definition ${PROJECT_NAME}-notification-service \
    --desired-count 1 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNET_1,$PRIVATE_SUBNET_2],securityGroups=[$ECS_SG],assignPublicIp=DISABLED}" \
    --service-registries "registryArn=${NOTIFICATION_SD_ARN}" \
    --tags "key=Name,value=${PROJECT_NAME}-notification-service"

  echo "✅ Notification service deployed: notification-service.${PROJECT_NAME}.local:3007"
fi
```

#### 6.4.8 Deploy API Gateway

```bash
source aws-resources.txt
CLUSTER_NAME=${CLUSTER_NAME:-${PROJECT_NAME}-cluster}

API_GATEWAY_SD_ARN=$(aws servicediscovery list-services \
  --filters "Name=NAMESPACE_ID,Values=$NAMESPACE_ID" \
  --query "Services[?Name=='api-gateway'].Arn" \
  --output text 2>/dev/null)

if [ -z "$API_GATEWAY_SD_ARN" ]; then
  API_GATEWAY_SD_ARN=$(aws servicediscovery create-service \
    --name api-gateway \
    --namespace-id $NAMESPACE_ID \
    --dns-config "NamespaceId=${NAMESPACE_ID},DnsRecords=[{Type=A,TTL=60}]" \
    --health-check-custom-config "FailureThreshold=2" \
    --query 'Service.Arn' \
    --output text)
  echo "API_GATEWAY_SD_ARN=$API_GATEWAY_SD_ARN" >> aws-resources.txt
  echo "✅ Service discovery created for api-gateway"
else
  echo "✅ Service discovery already exists for api-gateway"
fi

if aws ecs describe-services --cluster $CLUSTER_NAME --services ${PROJECT_NAME}-api-gateway --query 'services[0].status' --output text 2>/dev/null | grep -q ACTIVE; then
  echo "⚠️  ECS service ${PROJECT_NAME}-api-gateway already exists. Skipping creation."
  echo "   If tasks aren't registered with ALB, use section 6.5 (Option 2) to manually register."
else
  # Check if target group exists (created in section 6.2)
  if [ -z "$TG_API_GW" ]; then
    echo "⚠️  Warning: TG_API_GW not found. Make sure you've run section 6.2 (Create Target Groups) first."
    echo "   Creating service without load balancer. You'll need to manually register tasks in section 6.5."
    aws ecs create-service \
      --cluster $CLUSTER_NAME \
      --service-name ${PROJECT_NAME}-api-gateway \
      --task-definition ${PROJECT_NAME}-api-gateway \
      --desired-count 1 \
      --launch-type FARGATE \
      --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNET_1,$PRIVATE_SUBNET_2],securityGroups=[$ECS_SG],assignPublicIp=DISABLED}" \
      --service-registries "registryArn=${API_GATEWAY_SD_ARN}" \
      --tags "key=Name,value=${PROJECT_NAME}-api-gateway"
  else
    # Create service with automatic load balancer registration
    aws ecs create-service \
      --cluster $CLUSTER_NAME \
      --service-name ${PROJECT_NAME}-api-gateway \
      --task-definition ${PROJECT_NAME}-api-gateway \
      --desired-count 1 \
      --launch-type FARGATE \
      --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNET_1,$PRIVATE_SUBNET_2],securityGroups=[$ECS_SG],assignPublicIp=DISABLED}" \
      --load-balancers "targetGroupArn=${TG_API_GW},containerName=api-gateway,containerPort=3000" \
      --service-registries "registryArn=${API_GATEWAY_SD_ARN}" \
      --tags "key=Name,value=${PROJECT_NAME}-api-gateway"

    echo "✅ API Gateway deployed with automatic ALB registration: api-gateway.${PROJECT_NAME}.local:3000"
  fi
fi
```

#### 6.4.9 Deploy Redis Service

```bash
source aws-resources.txt
CLUSTER_NAME=${CLUSTER_NAME:-${PROJECT_NAME}-cluster}

REDIS_SD_ARN=$(aws servicediscovery list-services \
  --filters "Name=NAMESPACE_ID,Values=$NAMESPACE_ID" \
  --query "Services[?Name=='redis'].Arn" \
  --output text 2>/dev/null)

if [ -z "$REDIS_SD_ARN" ]; then
  REDIS_SD_ARN=$(aws servicediscovery create-service \
    --name redis \
    --namespace-id $NAMESPACE_ID \
    --dns-config "NamespaceId=${NAMESPACE_ID},DnsRecords=[{Type=A,TTL=60}]" \
    --health-check-custom-config "FailureThreshold=2" \
    --query 'Service.Arn' \
    --output text)
  echo "REDIS_SD_ARN=$REDIS_SD_ARN" >> aws-resources.txt
  echo "✅ Service discovery created for redis"
else
  echo "✅ Service discovery already exists for redis"
fi

if aws ecs describe-services --cluster $CLUSTER_NAME --services ${PROJECT_NAME}-redis --query 'services[0].status' --output text 2>/dev/null | grep -q ACTIVE; then
  echo "⚠️  ECS service ${PROJECT_NAME}-redis already exists. Skipping creation."
else
  aws ecs create-service \
    --cluster $CLUSTER_NAME \
    --service-name ${PROJECT_NAME}-redis \
    --task-definition ${PROJECT_NAME}-redis \
    --desired-count 1 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNET_1,$PRIVATE_SUBNET_2],securityGroups=[$REDIS_SG],assignPublicIp=DISABLED}" \
    --service-registries "registryArn=${REDIS_SD_ARN}" \
    --tags "key=Name,value=${PROJECT_NAME}-redis"

  echo "✅ Redis service deployed: redis.${PROJECT_NAME}.local:6379"
fi
```

**✅ Verification:**

```bash
source aws-resources.txt
CLUSTER_NAME=${CLUSTER_NAME:-${PROJECT_NAME}-cluster}

# Check all services are running
aws ecs list-services --cluster $CLUSTER_NAME

# Check service status
for service in auth-service event-service seat-service reservation-service payment-service ticket-service notification-service api-gateway redis; do
  echo "Checking ${service}..."
  aws ecs describe-services \
    --cluster $CLUSTER_NAME \
    --services ${PROJECT_NAME}-${service} \
    --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount}' \
    --output table
done
```

**🔍 Troubleshooting: If tasks aren't running (runningCount = 0), check task status:**

```bash
source aws-resources.txt
CLUSTER_NAME=${CLUSTER_NAME:-${PROJECT_NAME}-cluster}

# Check task status for a specific service (replace with your service name)
SERVICE_NAME="api-gateway"  # Change this to check other services

# List tasks for the service
TASK_ARNS=$(aws ecs list-tasks \
  --cluster $CLUSTER_NAME \
  --service-name ${PROJECT_NAME}-${SERVICE_NAME} \
  --query 'taskArns[]' \
  --output text)

if [ ! -z "$TASK_ARNS" ]; then
  for TASK_ARN in $TASK_ARNS; do
    echo "=== Task: $TASK_ARN ==="

    # Get task details
    aws ecs describe-tasks \
      --cluster $CLUSTER_NAME \
      --tasks $TASK_ARN \
      --query 'tasks[0].{LastStatus:lastStatus,DesiredStatus:desiredStatus,StopCode:stopCode,StoppedReason:stoppedReason,HealthStatus:healthStatus}' \
      --output table

    # Check container status
    aws ecs describe-tasks \
      --cluster $CLUSTER_NAME \
      --tasks $TASK_ARN \
      --query 'tasks[0].containers[0].{Name:name,LastStatus:lastStatus,Reason:reason,ExitCode:exitCode}' \
      --output table
  done
else
  echo "No tasks found for ${PROJECT_NAME}-${SERVICE_NAME}"
fi

# Check CloudWatch logs for errors
echo ""
echo "=== Recent CloudWatch Logs ==="
aws logs tail /ecs/${PROJECT_NAME}-${SERVICE_NAME} --since 10m --format short
```

### 6.5 Verify API Gateway ALB Integration

**📌 Standard Approach:** If you followed section 6.4.8 correctly, ECS automatically manages target registration. This section is for verification only.

```bash
source aws-resources.txt
CLUSTER_NAME=${CLUSTER_NAME:-${PROJECT_NAME}-cluster}

echo "=== Verifying API Gateway ALB Integration ==="

# 1. Check service has load balancer configuration
echo ""
echo "1. Checking service load balancer configuration..."
HAS_LB=$(aws ecs describe-services \
  --cluster $CLUSTER_NAME \
  --services ${PROJECT_NAME}-api-gateway \
  --query 'services[0].loadBalancers[0].targetGroupArn' \
  --output text 2>/dev/null)

if [ ! -z "$HAS_LB" ] && [ "$HAS_LB" != "None" ]; then
  echo "   ✅ Service has load balancer configuration: $HAS_LB"
  echo "   ✅ ECS will automatically manage target registration"
else
  echo "   ❌ Service missing load balancer configuration!"
  echo "   Run section 6.4.8 to add it (standard approach)"
fi

# 2. Check target health
echo ""
echo "2. Checking target group health..."
aws elbv2 describe-target-health \
  --target-group-arn $TG_API_GW \
  --output json | jq '.TargetHealthDescriptions[] | {Target: .Target.Id, Port: .Target.Port, Health: .TargetHealth.State, Reason: .TargetHealth.Reason}'

# 3. Check service status
echo ""
echo "3. Checking service status..."
aws ecs describe-services \
  --cluster $CLUSTER_NAME \
  --services ${PROJECT_NAME}-api-gateway \
  --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount}' \
  --output table

# 4. Test ALB endpoint (wait for health checks to pass)
echo ""
echo "4. Testing ALB endpoint..."
echo "   ⏳ Wait 60-90 seconds after service starts for health checks to pass"
echo "   Then test: curl http://$ALB_DNS/health"
echo ""
echo "✅ Verification complete!"
echo ""
echo "📌 Note: If targets show as unhealthy, check:"
echo "   - Security group allows ALB → ECS (port 3000)"
echo "   - API Gateway health endpoint responds: /health"
echo "   - Task is running and healthy in ECS"
```

---

## 🔄 Phase 7: Load Balancer Configuration (15 minutes)

**⚠️ Optional - Not Required for Current Setup**

**Note:** This phase is **optional** for the current deployment. In section 6.2, the ALB listener was already created with a **default action** that forwards all traffic to the API Gateway target group. This means:

- All requests to `http://$ALB_DNS/*` are automatically forwarded to API Gateway
- API Gateway handles all routing internally
- No additional listener rules are needed

**When Phase 7 is needed:**

- If you want path-based routing (e.g., `/api/*` → API Gateway, `/static/*` → S3)
- If you want to route different paths to different target groups
- If you're setting up multiple services behind the ALB

**For current setup:** You can skip Phase 7 and proceed to Phase 8 (Database Migrations) or Phase 9 (Frontend Deployment).

**Test your ALB (without Phase 7):**

```bash
source aws-resources.txt
curl -s http://$ALB_DNS/health | jq '.'
curl -s http://$ALB_DNS/api/health | jq '.'
```

---

### 7.1 Configure ALB Listener Rules (Optional)

```bash
source aws-resources.txt

# Create rule for API routes (forward to API Gateway)
aws elbv2 create-rule \
  --listener-arn $LISTENER_ARN \
  --priority 100 \
  --conditions Field=path-pattern,Values='/api/*' \
  --actions Type=forward,TargetGroupArn=$TG_API_GW

echo "✅ ALB listener rules configured!"
```

### 7.2 Update Frontend Environment Variable (Optional)

**Note:** Frontend configuration to use ALB DNS name will be done in Phase 9. This section is just a placeholder.

---

## 🗄️ Phase 8: Database Migrations & Seeders (30 minutes)

### 8.1 Create Databases

**⚠️ Note:** If you already created databases in section 2.3.1, skip this step and proceed to 8.2 (Run Migrations).

If databases weren't created earlier, use the same script from section 2.3.1:

```bash
# See section 2.3.1 for the complete database creation script
# It creates all 7 databases: auth_db, event_db, seat_db, reservation_db, payment_db, ticket_db, notification_db
```

### 8.2 Run Migrations

**📌 Standard Approach for Private Subnets:** Since RDS is in a private subnet, migrations **must** be run via ECS tasks. This is the production-standard approach.

**Option 1: Run migrations from local machine (Only if RDS is publicly accessible - NOT recommended)**

**⚠️ Note:** This option only works if RDS is publicly accessible. In our setup, RDS is in a private subnet for security, so this won't work. Use Option 2 instead.

```bash
# This will NOT work with private subnet RDS
# Only included for reference if you have public RDS
source aws-resources.txt

# Get RDS endpoint
RDS_ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier ${PROJECT_NAME}-postgres \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text)

# Set up port forwarding or use VPN to connect
# Then run migrations for each service:
# (This requires RDS to be publicly accessible, which is not our setup)
```

**Option 2: Run migrations via ECS task (Standard Approach - Recommended)**

**📌 Standard Approach:** Use the provided script to run migrations for all services via ECS tasks.

```bash
# Run migrations for each service via ECS task
# Example for auth-service:
aws ecs run-task \
  --cluster ${CLUSTER_NAME} \
  --task-definition ${PROJECT_NAME}-auth-service \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[${PRIVATE_SUBNET_1},${PRIVATE_SUBNET_2}],securityGroups=[${ECS_SECURITY_GROUP}],assignPublicIp=DISABLED}" \
  --overrides '{
    "containerOverrides": [{
      "name": "auth-service",
      "command": ["npm", "run", "migration:run"]
    }]
  }'

# Repeat for: event-service, seat-service, reservation-service, payment-service, ticket-service, notification-service
```

This script will:

- Run migrations for all 7 services via ECS tasks
- Check task status and exit codes
- Show migration logs
- Verify success

**Manual approach (if you prefer step-by-step):**

```bash
source aws-resources.txt
CLUSTER_NAME=${CLUSTER_NAME:-${PROJECT_NAME}-cluster}

# Function to run migrations for a service
run_migrations() {
  local SERVICE_NAME=$1
  local TASK_DEF="${PROJECT_NAME}-${SERVICE_NAME}"

  echo "Running migrations for: $SERVICE_NAME"

  # Run task with migration command override
  TASK_ARN=$(aws ecs run-task \
    --cluster $CLUSTER_NAME \
    --task-definition $TASK_DEF \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNET_1,$PRIVATE_SUBNET_2],securityGroups=[$ECS_SG],assignPublicIp=DISABLED}" \
    --overrides "{\"containerOverrides\":[{\"name\":\"${SERVICE_NAME}\",\"command\":[\"sh\",\"-c\",\"npm run migration:run && sleep 3600\"]}]}" \
    --query 'tasks[0].taskArn' \
    --output text)

  echo "✅ Migration task started: $TASK_ARN"
  echo "   Wait 60 seconds, then check logs:"
  echo "   aws logs tail /ecs/${PROJECT_NAME}-${SERVICE_NAME} --since 2m"
  echo ""
  sleep 5
}

# Run migrations for each service
run_migrations "auth-service"
run_migrations "event-service"
run_migrations "seat-service"
run_migrations "reservation-service"
run_migrations "payment-service"
run_migrations "ticket-service"
run_migrations "notification-service"
```

**✅ Verification after migrations:**

```bash
# Check migration status
./check-migrations-status.sh

# Or check specific service logs
aws logs tail /ecs/${PROJECT_NAME}-auth-service --since 5m --format short | grep -i migration
```

### 8.3 Check Migration Status

**📌 Standard Approach:** Verify migrations have been run successfully before proceeding.

**Method 1: Using the Check Script (Recommended)**

```bash
# Run the comprehensive migration status check
./check-migrations-status.sh
```

This script checks:

- If migrations table exists in each database
- How many migrations have been run
- What tables exist in each database
- Service health (indicates if database is ready)

**Method 2: Direct RDS Check (if RDS is publicly accessible)**

```bash
source aws-resources.txt

# Get RDS credentials
RDS_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id ${PROJECT_NAME}/rds/credentials \
  --query 'SecretString' \
  --output text)

RDS_ENDPOINT=$(echo $RDS_SECRET | jq -r '.host')
DB_USER=$(echo $RDS_SECRET | jq -r '.username')
DB_PASS=$(echo $RDS_SECRET | jq -r '.password')

# Check migrations for a specific service (example: auth-service)
PGPASSWORD=$DB_PASS psql -h $RDS_ENDPOINT -U $DB_USER -d auth_db -c "
  SELECT timestamp, name FROM migrations ORDER BY timestamp;
"

# Check tables
PGPASSWORD=$DB_PASS psql -h $RDS_ENDPOINT -U $DB_USER -d auth_db -c "\dt"
```

**Method 3: Check via ECS Task (if RDS is not publicly accessible)**

```bash
source aws-resources.txt
CLUSTER_NAME=${CLUSTER_NAME:-${PROJECT_NAME}-cluster}

# Run migration:show command via ECS task
aws ecs run-task \
  --cluster $CLUSTER_NAME \
  --task-definition ${PROJECT_NAME}-auth-service \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNET_1,$PRIVATE_SUBNET_2],securityGroups=[$ECS_SG],assignPublicIp=DISABLED}" \
  --overrides '{"containerOverrides":[{"name":"auth-service","command":["sh","-c","npm run migration:show && sleep 3600"]}]}' \
  --query 'tasks[0].taskArn' \
  --output text

# Wait 30 seconds, then check logs
sleep 30
aws logs tail /ecs/${PROJECT_NAME}-auth-service --since 2m --format short | grep -i migration
```

**Method 4: Check Service Logs (Quick Check)**

```bash
# Check if services started successfully (indicates tables exist)
for service in auth-service event-service seat-service reservation-service payment-service ticket-service notification-service; do
  echo "=== $service ==="
  aws logs tail /ecs/${PROJECT_NAME}-${service} --since 5m --format short 2>/dev/null | \
    grep -i "table.*does not exist\|relation.*does not exist\|successfully started\|listening" | tail -3
  echo ""
done
```

**✅ Expected Results:**

- **Migrations table exists:** `SELECT COUNT(*) FROM migrations;` returns a number > 0
- **Tables exist:** `\dt` shows all entity tables (users, events, seats, etc.)
- **Service running:** No "table does not exist" errors in logs
- **Service started:** Logs show "Nest application successfully started"

**❌ If migrations haven't been run:**

- Migrations table doesn't exist
- No tables in database (or only system tables)
- Services show "table does not exist" errors
- Run section 8.2 to execute migrations

---

### 8.4 Run Seeders

**📌 Standard Approach:** Use the provided script to run seeders via ECS tasks when RDS is in private subnet.

**⚠️ Prerequisites:**

- Migrations must be run first (section 8.2)
- Services must be rebuilt with seeder source files included (Dockerfiles updated)

**Option 1: Using the Seeder Script (Recommended)**

```bash
# Run seeders for event-service and seat-service via ECS task
# Example for event-service:
aws ecs run-task \
  --cluster ${CLUSTER_NAME} \
  --task-definition ${PROJECT_NAME}-event-service \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[${PRIVATE_SUBNET_1},${PRIVATE_SUBNET_2}],securityGroups=[${ECS_SECURITY_GROUP}],assignPublicIp=DISABLED}" \
  --overrides '{
    "containerOverrides": [{
      "name": "event-service",
      "command": ["npm", "run", "seed:run"]
    }]
  }'

# Repeat for: seat-service
```

This script will:

- Run seeders for event-service and seat-service via ECS tasks
- Check task status and exit codes
- Show seeder logs
- Verify success

**Option 2: Manual Approach**

```bash
source aws-resources.txt
CLUSTER_NAME=${CLUSTER_NAME:-${PROJECT_NAME}-cluster}

# Function to run seeders for a service
run_seeders() {
  local SERVICE_NAME=$1
  local TASK_DEF="${PROJECT_NAME}-${SERVICE_NAME}"

  echo "Running seeders for: $SERVICE_NAME"

  # Run task with seeder command override
  TASK_ARN=$(aws ecs run-task \
    --cluster $CLUSTER_NAME \
    --task-definition $TASK_DEF \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNET_1,$PRIVATE_SUBNET_2],securityGroups=[$ECS_SG],assignPublicIp=DISABLED}" \
    --overrides "{\"containerOverrides\":[{\"name\":\"${SERVICE_NAME}\",\"command\":[\"sh\",\"-c\",\"npm run seed:run && sleep 3600\"]}]}" \
    --query 'tasks[0].taskArn' \
    --output text)

  echo "✅ Seeder task started: $TASK_ARN"
  echo "   Wait 30 seconds, then check logs:"
  echo "   aws logs tail /ecs/${PROJECT_NAME}-${SERVICE_NAME} --since 2m"
  echo ""
  sleep 5
}

# Run seeders (only for services that have seeders)
run_seeders "event-service"  # Populates events and venues
run_seeders "seat-service"   # Populates seats
```

**✅ Verification:**

```bash
# Check seeder logs
aws logs tail /ecs/${PROJECT_NAME}-event-service --since 5m --format short | grep -i "seeder\|seed\|success\|error"
aws logs tail /ecs/${PROJECT_NAME}-seat-service --since 5m --format short | grep -i "seeder\|seed\|success\|error"

# Verify data was seeded (check database or API endpoints)
```

---

## 🌐 Phase 9: Frontend Deployment (20 minutes)

### 9.1 Build Frontend with Production Environment

```bash
source aws-resources.txt

cd frontend

# Create production .env file
# Note: Use HTTPS if ALB has SSL certificate, otherwise use HTTP
# For S3 website endpoint (HTTP), use HTTP API URL to avoid mixed content errors
# For S3 object URL (HTTPS), you need HTTPS API URL or configure ALB with SSL
cat > .env.production << EOF
VITE_API_URL=http://${ALB_DNS}
EOF

# Alternative: If ALB has HTTPS configured, use:
# VITE_API_URL=https://${ALB_DNS}

# Build frontend
npm install
npm run build

# Verify build
ls -la dist/
```

### 9.2 Deploy Frontend to S3

**📌 Standard Approach:** Use the provided script to handle Block Public Access settings and bucket policy.

**Option 1: Using the Deployment Script (Recommended)**

```bash
# Build and deploy frontend to S3
cd frontend
npm run build

# Upload to S3
aws s3 sync dist/ s3://${FRONTEND_BUCKET}/ --delete

# Invalidate CloudFront cache (if using CloudFront)
# aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/*"

cd ..
```

This script will:

- Disable Block Public Access settings (required for public bucket policy)
- Upload frontend files to S3
- Set proper content types
- Configure bucket policy for public read access

**Option 2: Manual Deployment**

```bash
source aws-resources.txt

# Step 1: Disable Block Public Access settings (REQUIRED before setting bucket policy)
aws s3api put-public-access-block \
  --bucket ${S3_FRONTEND_BUCKET} \
  --public-access-block-configuration \
    "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false" \
  --region $AWS_REGION

# Step 2: Upload frontend to S3
aws s3 sync frontend/dist/ s3://${S3_FRONTEND_BUCKET}/ \
  --delete \
  --cache-control "public, max-age=31536000, immutable" \
  --region $AWS_REGION

# Step 3: Set proper content types
aws s3 cp s3://${S3_FRONTEND_BUCKET}/index.html s3://${S3_FRONTEND_BUCKET}/index.html \
  --content-type "text/html" \
  --cache-control "public, max-age=0, must-revalidate" \
  --metadata-directive REPLACE \
  --region $AWS_REGION

# Step 4: Set bucket policy for public read access
cat > bucket-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::${S3_FRONTEND_BUCKET}/*"
    }
  ]
}
EOF

aws s3api put-bucket-policy \
  --bucket ${S3_FRONTEND_BUCKET} \
  --policy file://bucket-policy.json \
  --region $AWS_REGION

echo "✅ Frontend deployed to S3!"
```

**⚠️ Important:** You **must** disable Block Public Access settings **before** setting the bucket policy, otherwise you'll get an `AccessDenied` error.

### 9.3 (Optional) Setup CloudFront Distribution

For better performance and HTTPS:

```bash
source aws-resources.txt

# Create CloudFront distribution
cat > cloudfront-config.json << EOF
{
  "CallerReference": "${S3_FRONTEND_BUCKET}-$(date +%s)",
  "Comment": "Frontend distribution for ${PROJECT_NAME}",
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "S3-${S3_FRONTEND_BUCKET}",
        "DomainName": "${S3_FRONTEND_BUCKET}.s3.${AWS_REGION}.amazonaws.com",
        "S3OriginConfig": {
          "OriginAccessIdentity": ""
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-${S3_FRONTEND_BUCKET}",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 2,
      "Items": ["GET", "HEAD"]
    },
    "ForwardedValues": {
      "QueryString": false,
      "Cookies": {"Forward": "none"}
    },
    "MinTTL": 0,
    "DefaultTTL": 86400,
    "MaxTTL": 31536000
  },
  "Enabled": true,
  "PriceClass": "PriceClass_100"
}
EOF

# Note: CloudFront setup is optional and can be done via AWS Console for easier configuration
echo "⚠️  CloudFront setup recommended but optional. You can configure it via AWS Console."
```

**✅ Verification:**

```bash
source aws-resources.txt

# Get S3 website endpoint
aws s3api get-bucket-website --bucket ${S3_FRONTEND_BUCKET}

# Test frontend (if using S3 website hosting)
# URL: http://${S3_FRONTEND_BUCKET}.s3-website.${AWS_REGION}.amazonaws.com
# Note: Format is s3-website.REGION (with dot), NOT s3-website-REGION
```

**⚠️ Important: Mixed Content Issue**

If you access the frontend via the S3 object URL (HTTPS):

- URL: `https://${S3_FRONTEND_BUCKET}.s3.${AWS_REGION}.amazonaws.com`
- **Problem:** Browser blocks HTTP API calls from HTTPS page (mixed content)

**Solutions:**

1. **Use S3 Website Endpoint (HTTP) - Recommended for now:**

   ```bash
   # Access via HTTP website endpoint (no mixed content issue)
   # Note: Format is s3-website.REGION (with dot), NOT s3-website-REGION
   http://${S3_FRONTEND_BUCKET}.s3-website.${AWS_REGION}.amazonaws.com
   ```

2. **Configure ALB with HTTPS (Production-ready):**

   - Request ACM certificate
   - Create HTTPS listener on ALB (port 443)
   - Rebuild frontend with `VITE_API_URL=https://${ALB_DNS}`
   - Then use S3 object URL (HTTPS) or CloudFront

3. **Use CloudFront Distribution:**
   - CloudFront provides HTTPS automatically
   - Configure ALB with HTTPS for API calls
   - Best for production

**Quick Fix Script:**

```bash
./fix-frontend-mixed-content.sh
```

This script helps you choose the best solution for your setup.

**⚠️ If S3 Website Endpoint is Not Reachable:**

If `http://${S3_FRONTEND_BUCKET}.s3-website.${AWS_REGION}.amazonaws.com` is not accessible:

**⚠️ Important:** The correct URL format is `s3-website.REGION` (with dot), NOT `s3-website-REGION` (with hyphen).

1. **Run the website hosting fix script:**

   ```bash
   ./fix-s3-website-hosting.sh
   ```

2. **Or manually verify and fix:**

   ```bash
   source aws-resources.txt

   # Check if website hosting is configured
   aws s3api get-bucket-website --bucket ${S3_FRONTEND_BUCKET} --region $AWS_REGION

   # If not configured, set it up:
   cat > website-config.json << EOF
   {
     "IndexDocument": {
       "Suffix": "index.html"
     },
     "ErrorDocument": {
       "Key": "index.html"
     }
   }
   EOF

   aws s3api put-bucket-website \
     --bucket ${S3_FRONTEND_BUCKET} \
     --website-configuration file://website-config.json \
     --region $AWS_REGION

   # Disable Block Public Access
   aws s3api put-public-access-block \
     --bucket ${S3_FRONTEND_BUCKET} \
     --public-access-block-configuration \
       "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false" \
     --region $AWS_REGION

   # Set bucket policy
   cat > bucket-policy.json << EOF
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PublicReadGetObject",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::${S3_FRONTEND_BUCKET}/*"
       }
     ]
   }
   EOF

   aws s3api put-bucket-policy \
     --bucket ${S3_FRONTEND_BUCKET} \
     --policy file://bucket-policy.json \
     --region $AWS_REGION
   ```

3. **Wait 1-2 minutes for DNS propagation**, then try again.

---

## ✅ Phase 10: Testing & Verification (45 minutes)

This section provides comprehensive end-to-end testing for your deployed application, covering the complete ticket booking flow from user registration to receiving email notifications.

### 10.1 Pre-Test Setup

```bash
# Load all resource IDs
source aws-resources.txt

# Set base URL for all tests
export BASE_URL="http://$ALB_DNS"

# Verify ALB is accessible
echo "Testing ALB connectivity..."
curl -s -o /dev/null -w "%{http_code}" $BASE_URL/health
# Expected: 200
```

### 10.2 Verify All ECS Services Are Running

```bash
SERVICES=(
  "auth-service"
  "event-service"
  "seat-service"
  "reservation-service"
  "payment-service"
  "ticket-service"
  "notification-service"
  "api-gateway"
  "redis"
)

echo "=== Checking ECS Service Status ==="
for service in "${SERVICES[@]}"; do
  echo -n "Checking $service... "
  STATUS=$(aws ecs describe-services \
    --cluster $CLUSTER_NAME \
    --services ${PROJECT_NAME}-${service} \
    --query 'services[0].{Running:runningCount,Desired:desiredCount,Status:status}' \
    --output json)
  RUNNING=$(echo $STATUS | jq -r '.Running')
  DESIRED=$(echo $STATUS | jq -r '.Desired')
  if [ "$RUNNING" == "$DESIRED" ] && [ "$RUNNING" != "0" ]; then
    echo "✅ Running ($RUNNING/$DESIRED)"
  else
    echo "❌ Not Ready ($RUNNING/$DESIRED)"
  fi
done
```

### 10.3 Test Health Endpoints

```bash
echo "=== Testing Health Endpoints ==="

# API Gateway health
echo -n "API Gateway: "
curl -s $BASE_URL/health | jq -r '.status // "FAILED"'

# All services via API Gateway
echo -n "All Services via Gateway: "
curl -s $BASE_URL/api/health | jq -r '.status // "FAILED"'
```

---

## 🎯 10.4 Complete End-to-End Flow Testing

Follow these steps in order to test the complete ticket booking flow.

### Step 1: User Registration

```bash
echo "=== Step 1: User Registration ==="

# Register a new user (use your real email to receive notifications)
REGISTER_RESPONSE=$(curl -s -X POST $BASE_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "YOUR_REAL_EMAIL@example.com",
    "password": "Test1234!",
    "firstName": "Test",
    "lastName": "User"
  }')

echo "Registration Response:"
echo $REGISTER_RESPONSE | jq '.'

# Check for success
if echo $REGISTER_RESPONSE | jq -e '.id' > /dev/null 2>&1; then
  echo "✅ User registered successfully"
  USER_ID=$(echo $REGISTER_RESPONSE | jq -r '.id')
  echo "User ID: $USER_ID"
else
  echo "❌ Registration failed"
  echo "Error: $(echo $REGISTER_RESPONSE | jq -r '.message // .error')"
fi
```

### Step 2: User Login

```bash
echo "=== Step 2: User Login ==="

LOGIN_RESPONSE=$(curl -s -X POST $BASE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "YOUR_REAL_EMAIL@example.com",
    "password": "Test1234!"
  }')

echo "Login Response:"
echo $LOGIN_RESPONSE | jq '.'

# Extract access token
TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.accessToken')

if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
  echo "✅ Login successful"
  echo "Access Token: ${TOKEN:0:50}..."
  export AUTH_TOKEN="$TOKEN"
else
  echo "❌ Login failed"
fi
```

### Step 3: List Events

```bash
echo "=== Step 3: List Available Events ==="

EVENTS_RESPONSE=$(curl -s $BASE_URL/api/events \
  -H "Authorization: Bearer $AUTH_TOKEN")

echo "Events Response:"
echo $EVENTS_RESPONSE | jq '.'

# Get first event ID
EVENT_ID=$(echo $EVENTS_RESPONSE | jq -r '.[0].id // empty')

if [ -n "$EVENT_ID" ]; then
  echo "✅ Events retrieved successfully"
  echo "First Event ID: $EVENT_ID"
  export EVENT_ID
else
  echo "⚠️ No events found. Creating a test event..."

  # Create a test event (admin required - use seeder data or create manually)
  echo "Please ensure database seeders have run to populate events."
fi
```

### Step 4: Get Event Details and Seats

```bash
echo "=== Step 4: Get Event Details ==="

# Get event details
EVENT_DETAILS=$(curl -s $BASE_URL/api/events/$EVENT_ID \
  -H "Authorization: Bearer $AUTH_TOKEN")

echo "Event Details:"
echo $EVENT_DETAILS | jq '.'

EVENT_NAME=$(echo $EVENT_DETAILS | jq -r '.title // .name')
echo "Event Name: $EVENT_NAME"
```

```bash
echo "=== Step 4b: Get Available Seats ==="

SEATS_RESPONSE=$(curl -s "$BASE_URL/api/seats?eventId=$EVENT_ID&status=AVAILABLE" \
  -H "Authorization: Bearer $AUTH_TOKEN")

echo "Available Seats:"
echo $SEATS_RESPONSE | jq '.[0:5]'  # Show first 5 seats

# Get first 2 available seat IDs
SEAT_ID_1=$(echo $SEATS_RESPONSE | jq -r '.[0].id // empty')
SEAT_ID_2=$(echo $SEATS_RESPONSE | jq -r '.[1].id // empty')

if [ -n "$SEAT_ID_1" ]; then
  echo "✅ Seats retrieved successfully"
  echo "Seat 1 ID: $SEAT_ID_1"
  echo "Seat 2 ID: $SEAT_ID_2"
  export SEAT_ID_1 SEAT_ID_2
else
  echo "❌ No available seats found"
fi
```

### Step 5: Create Reservation

```bash
echo "=== Step 5: Create Reservation ==="

# Generate unique idempotency key
IDEMPOTENCY_KEY="res-$(date +%s)-$(openssl rand -hex 4)"

RESERVATION_RESPONSE=$(curl -s -X POST $BASE_URL/api/reservations \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"eventId\": \"$EVENT_ID\",
    \"seatIds\": [\"$SEAT_ID_1\", \"$SEAT_ID_2\"],
    \"idempotencyKey\": \"$IDEMPOTENCY_KEY\"
  }")

echo "Reservation Response:"
echo $RESERVATION_RESPONSE | jq '.'

RESERVATION_ID=$(echo $RESERVATION_RESPONSE | jq -r '.id // empty')

if [ -n "$RESERVATION_ID" ]; then
  echo "✅ Reservation created successfully"
  echo "Reservation ID: $RESERVATION_ID"
  echo "Expires At: $(echo $RESERVATION_RESPONSE | jq -r '.expiresAt')"
  export RESERVATION_ID
else
  echo "❌ Reservation failed"
  echo "Error: $(echo $RESERVATION_RESPONSE | jq -r '.message // .error')"
fi
```

### Step 6: Verify Seats Are Locked

```bash
echo "=== Step 6: Verify Seats Are Locked ==="

# Check seat 1 status
SEAT_1_STATUS=$(curl -s $BASE_URL/api/seats/$SEAT_ID_1 \
  -H "Authorization: Bearer $AUTH_TOKEN")

echo "Seat 1 Status:"
echo $SEAT_1_STATUS | jq '{id, status, lockedUntil}'

STATUS=$(echo $SEAT_1_STATUS | jq -r '.status')
if [ "$STATUS" == "LOCKED" ] || [ "$STATUS" == "RESERVED" ]; then
  echo "✅ Seat is properly locked/reserved"
else
  echo "⚠️ Seat status: $STATUS"
fi
```

### Step 7: Initiate Payment

```bash
echo "=== Step 7: Initiate Payment ==="

# Generate unique idempotency key for payment
PAYMENT_IDEMPOTENCY_KEY="pay-$(date +%s)-$(openssl rand -hex 4)"

PAYMENT_RESPONSE=$(curl -s -X POST $BASE_URL/api/payments/initiate \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"reservationId\": \"$RESERVATION_ID\",
    \"paymentMethod\": \"CARD\",
    \"idempotencyKey\": \"$PAYMENT_IDEMPOTENCY_KEY\"
  }")

echo "Payment Initiation Response:"
echo $PAYMENT_RESPONSE | jq '.'

PAYMENT_ID=$(echo $PAYMENT_RESPONSE | jq -r '.id // empty')

if [ -n "$PAYMENT_ID" ]; then
  echo "✅ Payment initiated successfully"
  echo "Payment ID: $PAYMENT_ID"
  export PAYMENT_ID
else
  echo "❌ Payment initiation failed"
  echo "Error: $(echo $PAYMENT_RESPONSE | jq -r '.message // .error')"
fi
```

### Step 8: Confirm Payment (Triggers Ticket Generation & Email)

```bash
echo "=== Step 8: Confirm Payment ==="

CONFIRM_RESPONSE=$(curl -s -X POST $BASE_URL/api/payments/confirm \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"paymentId\": \"$PAYMENT_ID\",
    \"transactionId\": \"txn_$(openssl rand -hex 8)\"
  }")

echo "Payment Confirmation Response:"
echo $CONFIRM_RESPONSE | jq '.'

PAYMENT_STATUS=$(echo $CONFIRM_RESPONSE | jq -r '.status // empty')

if [ "$PAYMENT_STATUS" == "COMPLETED" ] || [ "$PAYMENT_STATUS" == "SUCCESS" ]; then
  echo "✅ Payment confirmed successfully"
  echo ""
  echo "🎫 What happens next (automatically):"
  echo "   1. ✅ Payment status updated to COMPLETED"
  echo "   2. ✅ Seats status updated to SOLD"
  echo "   3. ✅ Ticket generation triggered via SQS"
  echo "   4. ✅ Ticket PDF generated and uploaded to S3"
  echo "   5. ✅ Email notification sent via SES"
else
  echo "❌ Payment confirmation failed"
  echo "Status: $PAYMENT_STATUS"
fi
```

### Step 9: Verify Ticket Generation

```bash
echo "=== Step 9: Verify Ticket Generation ==="

# Wait a few seconds for async processing
echo "Waiting 10 seconds for ticket generation..."
sleep 10

# Get tickets for user
TICKETS_RESPONSE=$(curl -s "$BASE_URL/api/tickets?userId=$USER_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN")

echo "User Tickets:"
echo $TICKETS_RESPONSE | jq '.'

TICKET_ID=$(echo $TICKETS_RESPONSE | jq -r '.[0].id // empty')

if [ -n "$TICKET_ID" ]; then
  echo "✅ Ticket generated successfully"
  echo "Ticket ID: $TICKET_ID"
  export TICKET_ID

  # Get ticket details
  TICKET_DETAILS=$(curl -s $BASE_URL/api/tickets/$TICKET_ID \
    -H "Authorization: Bearer $AUTH_TOKEN")

  echo "Ticket Details:"
  echo $TICKET_DETAILS | jq '.'

  TICKET_STATUS=$(echo $TICKET_DETAILS | jq -r '.status')
  PDF_URL=$(echo $TICKET_DETAILS | jq -r '.pdfUrl // empty')

  echo "Ticket Status: $TICKET_STATUS"
  if [ -n "$PDF_URL" ]; then
    echo "PDF URL: $PDF_URL"
  fi
else
  echo "⚠️ Ticket not found yet. Check CloudWatch logs for ticket-service"
fi
```

### Step 10: Download Ticket PDF

```bash
echo "=== Step 10: Download Ticket PDF ==="

if [ -n "$TICKET_ID" ]; then
  # Get download URL
  DOWNLOAD_URL="$BASE_URL/api/tickets/$TICKET_ID/download"

  echo "Download URL: $DOWNLOAD_URL"

  # Download the PDF
  curl -s -o "ticket-$TICKET_ID.pdf" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    "$DOWNLOAD_URL"

  # Check if file was downloaded
  if [ -f "ticket-$TICKET_ID.pdf" ] && [ -s "ticket-$TICKET_ID.pdf" ]; then
    echo "✅ Ticket PDF downloaded successfully"
    echo "File: ticket-$TICKET_ID.pdf"
    echo "Size: $(ls -lh ticket-$TICKET_ID.pdf | awk '{print $5}')"
  else
    echo "❌ Failed to download ticket PDF"
  fi
else
  echo "⚠️ No ticket ID available"
fi
```

### Step 11: Verify Email Notification

```bash
echo "=== Step 11: Verify Email Notification ==="

# Check notification service logs
echo "Checking CloudWatch logs for notification-service..."
aws logs tail /ecs/${PROJECT_NAME}-notification-service \
  --since 5m \
  --filter-pattern "TICKET_READY" \
  --format short | head -20

# Alternative: Check SES send statistics
echo ""
echo "SES Send Statistics (last 24 hours):"
aws ses get-send-statistics \
  --query 'SendDataPoints[-1]' \
  --output table

echo ""
echo "📧 Check your email inbox for:"
echo "   Subject: 'Your Tickets Are Ready - $EVENT_NAME'"
echo "   From: noreply@ticketbooking.local (or your configured SES email)"
```

### Step 12: Verify Final State

```bash
echo "=== Step 12: Final State Verification ==="

echo ""
echo "--- Reservation Status ---"
curl -s $BASE_URL/api/reservations/$RESERVATION_ID \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq '{id, status, eventId}'

echo ""
echo "--- Payment Status ---"
curl -s $BASE_URL/api/payments/$PAYMENT_ID \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq '{id, status, amount}'

echo ""
echo "--- Seat Status (should be SOLD) ---"
curl -s $BASE_URL/api/seats/$SEAT_ID_1 \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq '{id, status}'

echo ""
echo "--- Ticket Status ---"
if [ -n "$TICKET_ID" ]; then
  curl -s $BASE_URL/api/tickets/$TICKET_ID \
    -H "Authorization: Bearer $AUTH_TOKEN" | jq '{id, status, pdfUrl}'
fi
```

---

## 🔍 10.5 Check CloudWatch Logs

```bash
echo "=== Checking Service Logs ==="

# API Gateway logs
echo "API Gateway logs:"
aws logs tail /ecs/${PROJECT_NAME}-api-gateway --since 10m --format short | tail -10

# Payment Service logs
echo ""
echo "Payment Service logs:"
aws logs tail /ecs/${PROJECT_NAME}-payment-service --since 10m --format short | tail -10

# Ticket Service logs
echo ""
echo "Ticket Service logs:"
aws logs tail /ecs/${PROJECT_NAME}-ticket-service --since 10m --format short | tail -10

# Notification Service logs
echo ""
echo "Notification Service logs:"
aws logs tail /ecs/${PROJECT_NAME}-notification-service --since 10m --format short | tail -10
```

---

## 🌐 10.6 Test Frontend Application

```bash
echo "=== Frontend Testing ==="

# Get frontend URL
FRONTEND_URL="http://${S3_FRONTEND_BUCKET}.s3-website.${AWS_REGION}.amazonaws.com"
echo "Frontend URL: $FRONTEND_URL"

echo ""
echo "Manual Frontend Testing Steps:"
echo "1. Open $FRONTEND_URL in your browser"
echo "2. Register a new user or login with test credentials"
echo "3. Browse events and select one"
echo "4. Select seats on the seat map"
echo "5. Complete the checkout process"
echo "6. Verify ticket download works"
echo "7. Check your email for confirmation"
```

---

## ✅ 10.7 Complete Testing Checklist

**Infrastructure Verification:**

- [ ] All 8 ECS services are running (runningCount = desiredCount)
- [ ] ALB health checks passing
- [ ] CloudWatch logs being generated
- [ ] S3 buckets accessible

**Authentication Flow:**

- [ ] User registration works
- [ ] User login returns valid JWT token
- [ ] Token is accepted for authenticated requests

**Booking Flow:**

- [ ] Events list loads correctly
- [ ] Event details and seats retrieved
- [ ] Seat availability checked
- [ ] Reservation created successfully
- [ ] Seats locked after reservation

**Payment Flow:**

- [ ] Payment initiated successfully
- [ ] Payment confirmed successfully
- [ ] Saga pattern handles transaction correctly

**Ticket Generation:**

- [ ] Ticket generated after payment
- [ ] PDF uploaded to S3
- [ ] Ticket download URL works
- [ ] PDF file downloads correctly

**Notifications:**

- [ ] Notification sent to SQS queue
- [ ] Notification processed by consumer
- [ ] Email sent via SES
- [ ] Email received in inbox

**Frontend:**

- [ ] Frontend loads correctly
- [ ] Login/Register works
- [ ] Event browsing works
- [ ] Booking flow completes
- [ ] Ticket download works

---

## 📈 Phase 11: Scaling Test (Optional) (1 hour)

See `docs/SCALING_TEST_GUIDE.md` for detailed scaling test instructions.

**Quick Summary:**

1. Configure auto-scaling for Event Service
2. Generate load using `ab` or `wrk`
3. Monitor scaling in CloudWatch
4. Verify service handles increased load

**Estimated Cost:** ~$1-2 for scaling test

---

## 🧹 Phase 12: Cleanup (15 minutes)

**⚠️ IMPORTANT:** Run cleanup immediately after testing to avoid ongoing AWS charges!

**Estimated ongoing costs if NOT cleaned up:**

- RDS: ~$12/month (db.t3.micro)
- Redis ECS Task: ~$3/month (Fargate, included in ECS costs)
- NAT Gateway: ~$32/month + data charges
- ALB: ~$16/month + data charges
- ECS: ~$7/day (9 Fargate tasks: 8 services + redis)
- VPC Endpoints: ~$42/month (6 interface endpoints × $7/month each)

**Total if left running: ~$120-150/month**

**Note:** We use Redis as ECS task (~$3/month) instead of ElastiCache (~$12/month) to reduce costs.

---

### 🚀 Automated Cleanup Script (Recommended)

**Use the complete cleanup script that handles all resources in the correct order:**

```bash
./cleanup-aws-complete.sh
```

**What it deletes:**

- ✅ ECS Services (9 services) and Cluster
- ✅ Application Load Balancer (listener, target groups, ALB)
- ✅ Cloud Map (Service Discovery services and namespace)
- ✅ RDS PostgreSQL instance (all 7 databases)
- ✅ S3 Buckets (frontend, event-images, tickets-pdf)
- ✅ SQS Queues (5 queues: payment, ticket, notification, reservation, DLQ)
- ✅ Secrets Manager Secrets (RDS, Redis, JWT)
- ✅ VPC Endpoints (7 endpoints: Secrets Manager, ECR API, ECR DKR, CloudWatch Logs, SQS, SES, S3)
- ✅ NAT Gateway and Elastic IP
- ✅ VPC and all networking (subnets, route tables, IGW, security groups, RDS subnet group)
- ✅ CloudWatch Log Groups (all service logs)
- ✅ ECR Repositories (all services + postgres, redis if created)
- ✅ IAM Role and inline policies (S3, SQS, SES access)

**Features:**

- ✅ Deletes all resources in the correct dependency order
- ✅ Handles missing resources gracefully (won't fail if already deleted)
- ✅ Includes verification steps
- ✅ Requires confirmation: Type `DELETE ALL` to proceed

**Make it executable and run:**

```bash
chmod +x cleanup-aws-complete.sh
./cleanup-aws-complete.sh
```

**After cleanup, verify:**

```bash
./verify-cleanup.sh
```

---

### 📋 Manual Cleanup Guide

**For step-by-step manual cleanup with detailed explanations, see:**

**File:** `CLEANUP_MANUAL_GUIDE.md`

**View it:**

```bash
cat CLEANUP_MANUAL_GUIDE.md
# Or open in your editor
```

**The manual guide includes:**

- ✅ Detailed step-by-step instructions (16 steps)
- ✅ Explanations for why each step is needed
- ✅ Proper deletion order to avoid dependency errors
- ✅ Verification commands for each step
- ✅ Troubleshooting tips
- ✅ Copy-paste ready commands

**Use manual cleanup when:**

- You want to understand each step
- You need to delete resources selectively
- Automated script encounters issues
- You want to verify each deletion before proceeding

---

### 🗑️ Legacy Cleanup Script (Old - Use New Script Instead)

**⚠️ Note:** The old cleanup script below is kept for reference but is missing VPC endpoints and some IAM policies. Use `cleanup-aws-complete.sh` instead.

<details>
<summary>Old cleanup script (click to expand)</summary>

````bash
#!/bin/bash
set -e

# Load resource IDs
source aws-resources.txt

echo "🧹 Starting AWS Cleanup..."
echo "Project: $PROJECT_NAME"
echo ""

# Confirm before proceeding
read -p "⚠️  This will DELETE ALL resources. Continue? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Cleanup cancelled."
  exit 1
fi

echo ""
echo "=== Phase 1: Stopping ECS Services ==="
# Note: Include redis as it runs as ECS task (not ElastiCache)
SERVICES=("redis" "auth-service" "event-service" "seat-service" "reservation-service" "payment-service" "ticket-service" "notification-service" "api-gateway")

```bash
#!/bin/bash
set -e

# Load resource IDs
source aws-resources.txt

echo "🧹 Starting AWS Cleanup..."
echo "Project: $PROJECT_NAME"
echo ""

# Confirm before proceeding
read -p "⚠️  This will DELETE ALL resources. Continue? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Cleanup cancelled."
  exit 1
fi

echo ""
echo "=== Phase 1: Stopping ECS Services ==="
# Note: Include redis as it runs as ECS task (not ElastiCache)
SERVICES=("redis" "auth-service" "event-service" "seat-service" "reservation-service" "payment-service" "ticket-service" "notification-service" "api-gateway")

for service in "${SERVICES[@]}"; do
  echo "Stopping $service..."
  aws ecs update-service --cluster $CLUSTER_NAME --service ${PROJECT_NAME}-${service} --desired-count 0 || true
done
echo "Waiting 60 seconds for services to stop..."
sleep 60

echo ""
echo "=== Phase 2: Deleting ECS Services ==="
for service in "${SERVICES[@]}"; do
  echo "Deleting $service..."
  aws ecs delete-service --cluster $CLUSTER_NAME --service ${PROJECT_NAME}-${service} --force || true
done

echo ""
echo "=== Phase 3: Deleting Load Balancer ==="
aws elbv2 delete-listener --listener-arn $LISTENER_ARN || true
aws elbv2 delete-target-group --target-group-arn $TG_API_GW || true
aws elbv2 delete-load-balancer --load-balancer-arn $ALB_ARN || true
echo "Waiting 30 seconds for ALB to delete..."
sleep 30

echo ""
echo "=== Phase 4: Deleting ECS Cluster ==="
aws ecs delete-cluster --cluster $CLUSTER_NAME || true

echo ""
echo "=== Phase 5: Deleting Cloud Map ==="
if [ ! -z "$NAMESPACE_ID" ]; then
  DISCOVERY_SERVICES=$(aws servicediscovery list-services --filters "Name=NAMESPACE_ID,Values=$NAMESPACE_ID" --query 'Services[].Id' --output text)
  for SVC_ID in $DISCOVERY_SERVICES; do
    aws servicediscovery delete-service --id $SVC_ID || true
  done
  aws servicediscovery delete-namespace --id $NAMESPACE_ID || true
fi

echo ""
echo "=== Phase 6: Deleting RDS ==="
aws rds delete-db-instance --db-instance-identifier ${PROJECT_NAME}-postgres --skip-final-snapshot || true
echo "RDS deletion initiated (takes 5-10 minutes in background)"

echo ""
echo "=== Phase 7: Deleting Redis ECS Service ==="
# Stop and delete Redis ECS service (we use ECS instead of ElastiCache)
aws ecs update-service --cluster $CLUSTER_NAME --service ${PROJECT_NAME}-redis --desired-count 0 || true
sleep 10
aws ecs delete-service --cluster $CLUSTER_NAME --service ${PROJECT_NAME}-redis --force || true
# Note: ElastiCache cleanup below is only needed if you used ElastiCache instead of ECS Redis
# aws elasticache delete-cache-cluster --cache-cluster-id ${PROJECT_NAME}-redis || true
# aws elasticache delete-cache-subnet-group --cache-subnet-group-name ${PROJECT_NAME}-redis-subnet-group || true

echo ""
echo "=== Phase 8: Deleting S3 Buckets ==="
aws s3 rm s3://${S3_FRONTEND_BUCKET} --recursive || true
aws s3 rm s3://${S3_EVENT_IMAGES_BUCKET} --recursive || true
aws s3 rm s3://${S3_TICKETS_BUCKET} --recursive || true
aws s3 rb s3://${S3_FRONTEND_BUCKET} || true
aws s3 rb s3://${S3_EVENT_IMAGES_BUCKET} || true
aws s3 rb s3://${S3_TICKETS_BUCKET} || true

echo ""
echo "=== Phase 9: Deleting SQS Queues ==="
aws sqs delete-queue --queue-url $QUEUE_PAYMENT || true
aws sqs delete-queue --queue-url $QUEUE_TICKET || true
aws sqs delete-queue --queue-url $QUEUE_NOTIFICATION || true
aws sqs delete-queue --queue-url $QUEUE_RESERVATION || true
aws sqs delete-queue --queue-url $QUEUE_DLQ || true

echo ""
echo "=== Phase 10: Deleting Secrets ==="
aws secretsmanager delete-secret --secret-id ${PROJECT_NAME}/rds/credentials --force-delete-without-recovery || true
aws secretsmanager delete-secret --secret-id ${PROJECT_NAME}/redis/credentials --force-delete-without-recovery || true
aws secretsmanager delete-secret --secret-id ${PROJECT_NAME}/jwt/secret --force-delete-without-recovery || true
# Note: Cognito is NOT used - skip cognito secret deletion
# aws secretsmanager delete-secret --secret-id ${PROJECT_NAME}/cognito/credentials --force-delete-without-recovery || true

echo ""
# Note: Cognito is NOT used in current codebase - skip this section
# echo "=== Phase 11: Deleting Cognito ==="
# aws cognito-idp delete-user-pool --user-pool-id $COGNITO_POOL_ID || true

echo ""
echo "=== Phase 11: Deleting NAT Gateway ==="
aws ec2 delete-nat-gateway --nat-gateway-id $NAT_GW_ID || true
echo "Waiting 60 seconds for NAT Gateway to delete..."
sleep 60
aws ec2 release-address --allocation-id $EIP_ALLOC || true

echo ""
echo "=== Phase 13: Deleting VPC Resources ==="
# Delete subnets
aws ec2 delete-subnet --subnet-id $PUBLIC_SUBNET_1 || true
aws ec2 delete-subnet --subnet-id $PUBLIC_SUBNET_2 || true
aws ec2 delete-subnet --subnet-id $PRIVATE_SUBNET_1 || true
aws ec2 delete-subnet --subnet-id $PRIVATE_SUBNET_2 || true

# Delete route tables (must delete routes first)
aws ec2 delete-route --route-table-id $PRIVATE_RT --destination-cidr-block 0.0.0.0/0 || true
aws ec2 delete-route-table --route-table-id $PUBLIC_RT || true
aws ec2 delete-route-table --route-table-id $PRIVATE_RT || true

# Delete Internet Gateway
aws ec2 detach-internet-gateway --internet-gateway-id $IGW_ID --vpc-id $VPC_ID || true
aws ec2 delete-internet-gateway --internet-gateway-id $IGW_ID || true

# Delete security groups
aws ec2 delete-security-group --group-id $ALB_SG || true
aws ec2 delete-security-group --group-id $ECS_SG || true
aws ec2 delete-security-group --group-id $RDS_SG || true
aws ec2 delete-security-group --group-id $REDIS_SG || true

# Delete RDS subnet group
aws rds delete-db-subnet-group --db-subnet-group-name ${PROJECT_NAME}-db-subnet-group || true

# Delete VPC
aws ec2 delete-vpc --vpc-id $VPC_ID || true

echo ""
echo "=== Phase 14: Deleting CloudWatch Logs ==="
for service in "${SERVICES[@]}"; do
  aws logs delete-log-group --log-group-name /ecs/${PROJECT_NAME}-${service} || true
done
aws logs delete-log-group --log-group-name /ecs/${PROJECT_NAME}-db-init || true

echo ""
echo "=== Phase 15: Deleting ECR Repositories ==="
for service in "${SERVICES[@]}"; do
  aws ecr batch-delete-image --repository-name ${PROJECT_NAME}-${service} --image-ids imageTag=latest || true
  aws ecr delete-repository --repository-name ${PROJECT_NAME}-${service} --force || true
done

echo ""
echo "=== Phase 16: Deleting IAM Roles ==="
# Detach policies first
aws iam detach-role-policy --role-name ${PROJECT_NAME}-ecs-task-role --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy || true
aws iam detach-role-policy --role-name ${PROJECT_NAME}-ecs-task-role --policy-arn arn:aws:iam::${AWS_ACCOUNT_ID}:policy/${PROJECT_NAME}-ecs-task-policy || true

# Delete custom policy
aws iam delete-policy --policy-arn arn:aws:iam::${AWS_ACCOUNT_ID}:policy/${PROJECT_NAME}-ecs-task-policy || true

# Delete role
aws iam delete-role --role-name ${PROJECT_NAME}-ecs-task-role || true

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "🔍 Verifying no resources remain..."
aws ecs list-clusters | grep $PROJECT_NAME || echo "✅ No ECS clusters"
aws rds describe-db-instances | grep $PROJECT_NAME || echo "✅ No RDS instances (or still deleting)"
aws s3 ls | grep $PROJECT_NAME || echo "✅ No S3 buckets"
aws ec2 describe-vpcs --filters "Name=tag:Name,Values=$PROJECT_NAME*" --query 'Vpcs[].VpcId' || echo "✅ No VPCs"

echo ""
echo "⚠️  Note: Some resources (RDS) take 5-10 minutes to fully delete."
echo "    Run verification again in 10 minutes to confirm everything is deleted."
````

Make it executable and run:

```bash
chmod +x cleanup-aws.sh
./cleanup-aws.sh
```

---

---

### 📋 Quick Reference: Cleanup Order

Resources must be deleted in this order:

1. **ECS Services** (stop → delete)
2. **Load Balancer** (listener → target groups → ALB)
3. **ECS Cluster**
4. **Cloud Map** (services → namespace)
5. **RDS Instance**
6. **S3 Buckets** (empty → delete)
7. **SQS Queues**
8. **Secrets Manager Secrets**
9. **VPC Endpoints** (interface → gateway)
10. **NAT Gateway & Elastic IP**
11. **VPC & Networking** (subnet group → subnets → route tables → IGW → security groups → VPC)
12. **CloudWatch Log Groups**
13. **ECR Repositories**
14. **IAM Role & Policies** (inline policies → managed policies → role)

**For detailed manual steps, see `CLEANUP_MANUAL_GUIDE.md`**

---

### 📋 Legacy Manual Cleanup Steps (Reference Only)

**⚠️ Note:** These steps are kept for reference. For complete cleanup, use `cleanup-aws-complete.sh` or see `CLEANUP_MANUAL_GUIDE.md` for updated manual steps.

<details>
<summary>Legacy manual cleanup steps (click to expand)</summary>

### 12.1 Stop All ECS Services

```bash
source aws-resources.txt

SERVICES=(
  "auth-service"
  "event-service"
  "seat-service"
  "reservation-service"
  "payment-service"
  "ticket-service"
  "notification-service"
  "api-gateway"
  "redis"
)

for service in "${SERVICES[@]}"; do
  echo "Stopping $service..."
  aws ecs update-service \
    --cluster $CLUSTER_NAME \
    --service ${PROJECT_NAME}-${service} \
    --desired-count 0
done

# Wait for services to stop
echo "Waiting for services to stop..."
sleep 120
```

### 12.2 Delete ECS Services

```bash
for service in "${SERVICES[@]}"; do
  echo "Deleting $service..."
  aws ecs delete-service \
    --cluster $CLUSTER_NAME \
    --service ${PROJECT_NAME}-${service} \
    --force
done
```

### 12.3 Delete Load Balancer

```bash
# Delete listener first
aws elbv2 delete-listener --listener-arn $LISTENER_ARN

# Delete target groups
aws elbv2 delete-target-group --target-group-arn $TG_API_GW

# Delete load balancer
aws elbv2 delete-load-balancer --load-balancer-arn $ALB_ARN

echo "✅ Load balancer deleted"
```

### 12.4 Delete ECS Cluster

```bash
aws ecs delete-cluster --cluster $CLUSTER_NAME
echo "✅ ECS cluster deleted"
```

### 12.5 Delete RDS Instance

```bash
aws rds delete-db-instance \
  --db-instance-identifier ${PROJECT_NAME}-postgres \
  --skip-final-snapshot

echo "✅ RDS instance deletion initiated (takes 5-10 minutes)"
```

### 12.6 ~~Delete ElastiCache~~ (SKIP - Using ECS Redis Instead)

**Note:** We use Redis as an ECS task, not ElastiCache. Redis ECS service is deleted with other services in step 12.2.

<details>
<summary>Only if you used ElastiCache (not recommended)</summary>

```bash
aws elasticache delete-cache-cluster \
  --cache-cluster-id ${PROJECT_NAME}-redis

# Wait for cluster deletion
sleep 60

# Delete subnet group
aws elasticache delete-cache-subnet-group \
  --cache-subnet-group-name ${PROJECT_NAME}-redis-subnet-group

echo "✅ ElastiCache deletion initiated"
```

</details>

### 12.7 Delete S3 Buckets

```bash
# Empty buckets first
aws s3 rm s3://${S3_FRONTEND_BUCKET} --recursive
aws s3 rm s3://${S3_EVENT_IMAGES_BUCKET} --recursive
aws s3 rm s3://${S3_TICKETS_BUCKET} --recursive

# Delete buckets
aws s3 rb s3://${S3_FRONTEND_BUCKET}
aws s3 rb s3://${S3_EVENT_IMAGES_BUCKET}
aws s3 rb s3://${S3_TICKETS_BUCKET}

echo "✅ S3 buckets deleted"
```

### 12.8 Delete SQS Queues

```bash
aws sqs delete-queue --queue-url $QUEUE_PAYMENT
aws sqs delete-queue --queue-url $QUEUE_TICKET
aws sqs delete-queue --queue-url $QUEUE_NOTIFICATION
aws sqs delete-queue --queue-url $QUEUE_RESERVATION
aws sqs delete-queue --queue-url $QUEUE_DLQ

echo "✅ SQS queues deleted"
```

### 12.9 Delete Secrets

```bash
aws secretsmanager delete-secret \
  --secret-id ${PROJECT_NAME}/rds/credentials \
  --force-delete-without-recovery

aws secretsmanager delete-secret \
  --secret-id ${PROJECT_NAME}/redis/credentials \
  --force-delete-without-recovery

aws secretsmanager delete-secret \
  --secret-id ${PROJECT_NAME}/jwt/secret \
  --force-delete-without-recovery

# Note: Cognito secret not created since Cognito is not used
# aws secretsmanager delete-secret \
#   --secret-id ${PROJECT_NAME}/cognito/credentials \
#   --force-delete-without-recovery

echo "✅ Secrets deleted"
```

### 12.10 ~~Delete Cognito User Pool~~ (SKIP - Not Used)

**Note:** Cognito is NOT used in the current codebase. The Auth Service uses local JWT authentication.

<details>
<summary>Only if you created Cognito (not recommended)</summary>

```bash
aws cognito-idp delete-user-pool --user-pool-id $COGNITO_POOL_ID
echo "✅ Cognito User Pool deleted"
```

</details>

### 12.11 Delete VPC Endpoints

**⚠️ IMPORTANT:** VPC endpoints must be deleted before VPC!

```bash
# Delete interface endpoints
if [ ! -z "$SECRETS_VPC_ENDPOINT" ]; then
  aws ec2 delete-vpc-endpoints --vpc-endpoint-ids "$SECRETS_VPC_ENDPOINT" --region $AWS_REGION
fi
if [ ! -z "$ECR_API_VPC_ENDPOINT" ]; then
  aws ec2 delete-vpc-endpoints --vpc-endpoint-ids "$ECR_API_VPC_ENDPOINT" --region $AWS_REGION
fi
if [ ! -z "$ECR_DKR_VPC_ENDPOINT" ]; then
  aws ec2 delete-vpc-endpoints --vpc-endpoint-ids "$ECR_DKR_VPC_ENDPOINT" --region $AWS_REGION
fi
if [ ! -z "$LOGS_VPC_ENDPOINT" ]; then
  aws ec2 delete-vpc-endpoints --vpc-endpoint-ids "$LOGS_VPC_ENDPOINT" --region $AWS_REGION
fi
if [ ! -z "$SQS_VPC_ENDPOINT" ]; then
  aws ec2 delete-vpc-endpoints --vpc-endpoint-ids "$SQS_VPC_ENDPOINT" --region $AWS_REGION
fi
if [ ! -z "$SES_VPC_ENDPOINT" ]; then
  aws ec2 delete-vpc-endpoints --vpc-endpoint-ids "$SES_VPC_ENDPOINT" --region $AWS_REGION
fi

# Delete gateway endpoint (S3)
if [ ! -z "$S3_VPC_ENDPOINT" ]; then
  aws ec2 delete-vpc-endpoints --vpc-endpoint-ids "$S3_VPC_ENDPOINT" --region $AWS_REGION
fi

echo "✅ VPC endpoints deleted"
```

### 12.12 Delete NAT Gateway

```bash
aws ec2 delete-nat-gateway --nat-gateway-id $NAT_GW_ID --region $AWS_REGION

# Wait for NAT Gateway to delete
sleep 60

# Release Elastic IP
aws ec2 release-address --allocation-id $EIP_ALLOC --region $AWS_REGION

echo "✅ NAT Gateway deleted"
```

### 12.13 Delete VPC and Networking

```bash
# Delete subnets
aws ec2 delete-subnet --subnet-id $PUBLIC_SUBNET_1
aws ec2 delete-subnet --subnet-id $PUBLIC_SUBNET_2
aws ec2 delete-subnet --subnet-id $PRIVATE_SUBNET_1
aws ec2 delete-subnet --subnet-id $PRIVATE_SUBNET_2

# Delete route tables
aws ec2 delete-route-table --route-table-id $PUBLIC_RT
aws ec2 delete-route-table --route-table-id $PRIVATE_RT

# Detach and delete Internet Gateway
aws ec2 detach-internet-gateway \
  --internet-gateway-id $IGW_ID \
  --vpc-id $VPC_ID

aws ec2 delete-internet-gateway --internet-gateway-id $IGW_ID

# Delete security groups
aws ec2 delete-security-group --group-id $ALB_SG
aws ec2 delete-security-group --group-id $ECS_SG
aws ec2 delete-security-group --group-id $RDS_SG
aws ec2 delete-security-group --group-id $REDIS_SG

# Delete VPC
aws ec2 delete-vpc --vpc-id $VPC_ID

echo "✅ VPC and networking deleted"
```

### 12.13 Delete CloudWatch Log Groups

```bash
for service in "${SERVICES[@]}"; do
  aws logs delete-log-group --log-group-name /ecs/${PROJECT_NAME}-${service} || true
done

aws logs delete-log-group --log-group-name /ecs/${PROJECT_NAME}-db-init || true

echo "✅ CloudWatch log groups deleted"
```

### 12.14 Delete Cloud Map Services and Namespace

```bash
source aws-resources.txt

# List all services in namespace
SERVICES=$(aws servicediscovery list-services \
  --filters "Name=NAMESPACE_ID,Values=$NAMESPACE_ID" \
  --query 'Services[].Id' \
  --output text)

# Delete all service discovery services
for SERVICE_ID in $SERVICES; do
  echo "Deleting service discovery service: $SERVICE_ID"
  aws servicediscovery delete-service --id $SERVICE_ID || true
done

# Delete namespace
if [ ! -z "$NAMESPACE_ID" ]; then
  echo "Deleting namespace: $NAMESPACE_ID"
  aws servicediscovery delete-namespace --id $NAMESPACE_ID || true
fi

echo "✅ Cloud Map resources deleted"
```

### 12.15 Delete ECR Repositories

```bash
# Note: Frontend is not in ECR (deployed to S3), so only backend services are listed
SERVICES=(
  "auth-service"
  "event-service"
  "seat-service"
  "reservation-service"
  "payment-service"
  "ticket-service"
  "notification-service"
  "api-gateway"
)

for service in "${SERVICES[@]}"; do
  # Delete all images first
  aws ecr batch-delete-image \
    --repository-name ${PROJECT_NAME}-${service} \
    --image-ids imageTag=latest || true

  # Delete repository
  aws ecr delete-repository \
    --repository-name ${PROJECT_NAME}-${service} \
    --force || true
done

echo "✅ ECR repositories deleted"
```

### 12.16 Delete IAM Roles and Policies

```bash
source aws-resources.txt

# Get AWS Account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Detach policies from ECS task role
aws iam detach-role-policy \
  --role-name ${PROJECT_NAME}-ecs-task-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy || true

aws iam detach-role-policy \
  --role-name ${PROJECT_NAME}-ecs-task-role \
  --policy-arn arn:aws:iam::${AWS_ACCOUNT_ID}:policy/${PROJECT_NAME}-ecs-task-policy || true

# Delete custom policy
aws iam delete-policy \
  --policy-arn arn:aws:iam::${AWS_ACCOUNT_ID}:policy/${PROJECT_NAME}-ecs-task-policy || true

# Delete role
aws iam delete-role --role-name ${PROJECT_NAME}-ecs-task-role || true

echo "✅ IAM roles and policies deleted"
```

### 12.17 Delete RDS Subnet Group

```bash
# Wait for RDS to finish deleting first
echo "Waiting for RDS to finish deleting..."
aws rds wait db-instance-deleted --db-instance-identifier ${PROJECT_NAME}-postgres || true

# Delete subnet group
aws rds delete-db-subnet-group \
  --db-subnet-group-name ${PROJECT_NAME}-db-subnet-group || true

echo "✅ RDS subnet group deleted"
```

---

## ✅ Final Verification Checklist

Run these commands to verify all resources are deleted:

```bash
source aws-resources.txt
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "=== Final Verification ==="
echo ""

echo "1. ECS Clusters:"
aws ecs list-clusters --query "clusterArns[?contains(@, '$PROJECT_NAME')]" --output text
# Expected: (empty)

echo ""
echo "2. RDS Instances:"
aws rds describe-db-instances --query "DBInstances[?contains(DBInstanceIdentifier, '$PROJECT_NAME')].DBInstanceIdentifier" --output text
# Expected: (empty or "deleting")

echo ""
echo "3. Redis ECS Service:"
aws ecs describe-services --cluster ${PROJECT_NAME}-cluster --services ${PROJECT_NAME}-redis --query "services[].status" --output text 2>/dev/null || echo "(not found - good)"
# Expected: (not found) - Redis runs as ECS task, deleted with other services

# Note: ElastiCache check not needed - we use ECS Redis instead
# aws elasticache describe-cache-clusters --query "CacheClusters[?contains(CacheClusterId, '$PROJECT_NAME')].CacheClusterId" --output text

echo ""
echo "4. S3 Buckets:"
aws s3 ls | grep $PROJECT_NAME || echo "(none found)"
# Expected: (none found)

echo ""
echo "5. SQS Queues:"
aws sqs list-queues --queue-name-prefix $PROJECT_NAME --query 'QueueUrls' --output text
# Expected: (empty)

echo ""
echo "6. VPCs:"
aws ec2 describe-vpcs --filters "Name=tag:Name,Values=${PROJECT_NAME}-vpc" --query 'Vpcs[].VpcId' --output text
# Expected: (empty)

echo ""
echo "7. Load Balancers:"
aws elbv2 describe-load-balancers --query "LoadBalancers[?contains(LoadBalancerName, '$PROJECT_NAME')].LoadBalancerName" --output text
# Expected: (empty)

echo ""
echo "8. ECR Repositories:"
aws ecr describe-repositories --query "repositories[?contains(repositoryName, '$PROJECT_NAME')].repositoryName" --output text
# Expected: (empty)

echo ""
echo "9. Secrets Manager:"
aws secretsmanager list-secrets --query "SecretList[?contains(Name, '$PROJECT_NAME')].Name" --output text
# Expected: (empty)

echo ""
echo "10. CloudWatch Log Groups:"
aws logs describe-log-groups --log-group-name-prefix /ecs/${PROJECT_NAME} --query 'logGroups[].logGroupName' --output text
# Expected: (empty)

echo ""
echo "11. NAT Gateways:"
aws ec2 describe-nat-gateways --filter "Name=state,Values=available,pending" --query "NatGateways[?contains(Tags[?Key=='Name'].Value | [0], '$PROJECT_NAME')].NatGatewayId" --output text
# Expected: (empty)

echo ""
echo "=== Verification Complete ==="
echo ""
echo "If all checks show empty results, cleanup is complete!"
echo "If any resources remain, delete them manually via AWS Console."
```

---

## 💰 Cost Summary

**Resources and their costs (us-east-1 pricing):**

| Resource         | Running Cost             | Notes                |
| ---------------- | ------------------------ | -------------------- |
| ECS Fargate      | ~$0.04/hour per task     | 9 tasks = ~$8.64/day |
| RDS db.t3.micro  | ~$0.017/hour             | ~$12/month           |
| Redis (ECS task) | Included in ECS above    | ~$3/month            |
| NAT Gateway      | ~$0.045/hour + data      | ~$32/month base      |
| ALB              | ~$0.0225/hour + data     | ~$16/month base      |
| S3               | ~$0.023/GB/month         | Minimal for testing  |
| SQS              | Free tier covers testing | ~0 for testing       |

**Services NOT used (cost savings):**
| ~~AWS Cognito~~ | Not used | Auth uses local JWT |
| ~~ElastiCache~~ | Not used | Using ECS Redis |

**Testing Cost Estimate:**

- 5 hours of deployment + testing: ~$5-10
- Left running 24 hours: ~$15-20
- Left running 1 week: ~$50-80

**⚠️ Always run cleanup after testing!**

---

## 🔧 Troubleshooting

### Issue 1: ECS Tasks Not Starting

**Symptoms:** Tasks stuck in PENDING state

**Solutions:**

1. Check task logs in CloudWatch
2. Verify security group allows traffic
3. Check task definition for errors
4. Verify Secrets Manager permissions
5. Check VPC networking (subnets, route tables)

```bash
# Check task status
aws ecs describe-tasks \
  --cluster $CLUSTER_NAME \
  --tasks <TASK_ARN>

# Check CloudWatch logs
aws logs tail /ecs/${PROJECT_NAME}-<service-name> --follow
```

### Issue 2: ALB 504 Gateway Timeout

**Symptoms:** ALB returns 504 Gateway Timeout when accessing endpoints

**Root Cause:** API Gateway service was created without load balancer configuration, so ECS isn't automatically managing target registration.

**📌 Standard Solution (Recommended):**

Update the service to include load balancer configuration - this is the production-standard approach:

```bash
source aws-resources.txt
CLUSTER_NAME=${CLUSTER_NAME:-${PROJECT_NAME}-cluster}

# Update service with load balancer configuration (standard approach)
aws ecs update-service \
  --cluster $CLUSTER_NAME \
  --service ${PROJECT_NAME}-api-gateway \
  --load-balancers "targetGroupArn=${TG_API_GW},containerName=api-gateway,containerPort=3000" \
  --force-new-deployment \
  --query 'service.{ServiceName:serviceName,Status:status,LoadBalancers:loadBalancers}' \
  --output json | jq '.'

echo "✅ Service updated. ECS will now automatically manage target registration."
echo "⏳ Wait 2-3 minutes for deployment to complete, then test: curl http://$ALB_DNS/health"
```

**Why This Is The Standard Approach:**

- ECS automatically registers new tasks when they start
- ECS automatically deregisters tasks when they stop
- No manual intervention needed
- This is how production deployments work

**Diagnostic Commands:**

```bash
source aws-resources.txt
CLUSTER_NAME=${CLUSTER_NAME:-${PROJECT_NAME}-cluster}

# 1. Check if service has load balancer configuration
aws ecs describe-services \
  --cluster $CLUSTER_NAME \
  --services ${PROJECT_NAME}-api-gateway \
  --query 'services[0].loadBalancers[0].targetGroupArn' \
  --output text
# Expected: Should return target group ARN (not empty/None)

# 2. Check target group health
aws elbv2 describe-target-health \
  --target-group-arn $TG_API_GW \
  --output json | jq '.TargetHealthDescriptions[] | {Target: .Target.Id, Health: .TargetHealth.State, Reason: .TargetHealth.Reason}'

# 3. Check service status
aws ecs describe-services \
  --cluster $CLUSTER_NAME \
  --services ${PROJECT_NAME}-api-gateway \
  --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount}' \
  --output table

# 4. Verify security group allows ALB → ECS (port 3000)
aws ec2 authorize-security-group-ingress \
  --group-id $ECS_SG \
  --protocol tcp \
  --port 3000 \
  --source-group $ALB_SG 2>&1 | grep -v "already exists" || echo "✅ Rule already exists"

# 5. Check API Gateway logs
aws logs tail /ecs/${PROJECT_NAME}-api-gateway --since 5m --format short
```

**⚠️ Manual Registration (Temporary Workaround - Not Recommended):**

Only use this if you cannot update the service. The standard solution above is preferred.

```bash
# Get current task IP and register manually (temporary fix)
TASK_ARN=$(aws ecs list-tasks \
  --cluster $CLUSTER_NAME \
  --service-name ${PROJECT_NAME}-api-gateway \
  --query 'taskArns[0]' \
  --output text)

TASK_IP=$(aws ecs describe-tasks \
  --cluster $CLUSTER_NAME \
  --tasks $TASK_ARN \
  --query 'tasks[0].attachments[0].details[?name==`privateIPv4Address`].value' \
  --output text)

if [ ! -z "$TASK_IP" ] && [ "$TASK_IP" != "None" ]; then
  aws elbv2 register-targets \
    --target-group-arn $TG_API_GW \
    --targets Id=$TASK_IP,Port=3000
  echo "⚠️  Temporary fix applied. Update service with load balancer config for permanent solution."
fi
```

### Issue 3: Health Checks Failing

**Symptoms:** ALB shows targets as unhealthy

**Solutions:**

1. Verify health check path is correct (`/health` for API Gateway)
2. Check security group allows ALB → ECS traffic
3. Verify service is listening on correct port
4. Check service logs for errors
5. Verify health check timeout is sufficient (should be 5-10 seconds)

```bash
# Check target health
aws elbv2 describe-target-health --target-group-arn $TG_API_GW

# Check health check configuration
aws elbv2 describe-target-groups \
  --target-group-arns $TG_API_GW \
  --query 'TargetGroups[0].HealthCheckPath' \
  --output text

# Test health endpoint from within task (if possible)
```

### Issue 3: Database Connection Errors

**Symptoms:** Services can't connect to RDS

**Solutions:**

1. Verify RDS security group allows ECS security group
2. Check RDS endpoint is correct
3. Verify database credentials in Secrets Manager
4. Ensure databases exist

```bash
# Test RDS connectivity from ECS task
# Use ECS Exec or create a test task
```

### Issue 4: Service-to-Service Communication Fails

**Symptoms:** Services can't reach each other, API Gateway can't proxy to services

**Solutions:**

1. **Verify Security Group Rules:**

   ```bash
   # Check ECS security group allows inter-service communication
   aws ec2 describe-security-groups --group-ids $ECS_SG \
     --query 'SecurityGroups[0].IpPermissions'

   # Should see rules allowing:
   # - Port 3000 from ALB_SG (ALB → API Gateway)
   # - Ports 3001-3007 from ECS_SG (API Gateway → Services, Service → Service)
   ```

2. **Verify Service URLs:**

   - Services should use Cloud Map DNS names: `http://auth-service.${PROJECT_NAME}.local:3001`
   - Format: `http://<service-name>.${PROJECT_NAME}.local:<port>`
   - Not `localhost`, `127.0.0.1`, or hardcoded IPs
   - Check task definitions have correct Cloud Map DNS URLs

3. **Check VPC Networking:**

   - All services must be in same VPC
   - Services should be in private subnets
   - Verify route tables allow inter-subnet communication

4. **Test Connectivity:**

   ```bash
   # From API Gateway task, test service connectivity
   # Use ECS Exec to connect to a running task
   aws ecs execute-command \
     --cluster $CLUSTER_NAME \
     --task <TASK_ARN> \
     --container api-gateway \
     --command "/bin/sh" \
     --interactive

   # Inside container, test:
   curl http://auth-service.${PROJECT_NAME}.local:3001/health
   ```

5. **Check Service Discovery:**

   ```bash
   # List all services in namespace
   aws servicediscovery list-services \
     --filters "Name=NAMESPACE_ID,Values=$NAMESPACE_ID"

   # Get service details
   aws servicediscovery get-service --id <SERVICE_ID>

   # Test DNS resolution from within a task
   # Use ECS Exec to connect to a running task
   aws ecs execute-command \
     --cluster $CLUSTER_NAME \
     --task <TASK_ARN> \
     --container api-gateway \
     --command "/bin/sh" \
     --interactive

   # Inside container, test DNS:
   nslookup auth-service.${PROJECT_NAME}.local
   curl http://auth-service.${PROJECT_NAME}.local:3001/health
   ```

   - Verify namespace exists: `aws servicediscovery list-namespaces`
   - Check service registrations: `aws servicediscovery list-services`
   - Ensure services are registered: Each ECS service should have a corresponding Cloud Map service

### Issue 5: S3 Access Denied

**Symptoms:** Services can't access S3 buckets

**Solutions:**

1. Verify IAM role has S3 permissions
2. Check bucket policies
3. Verify bucket names match environment variables

### Issue 6: SQS Queue Not Found

**Symptoms:** Services can't find SQS queues

**Solutions:**

1. Verify queue URLs are correct
2. Check IAM permissions for SQS
3. Verify queues exist in same region

### Issue 7: Frontend Can't Reach API

**Symptoms:** Frontend shows CORS or connection errors

**Solutions:**

1. Verify `VITE_API_URL` points to ALB DNS
2. Check ALB security group allows HTTP traffic
3. Verify API Gateway is registered with ALB
4. Check CORS configuration in API Gateway

### Issue 8: High Costs

**Symptoms:** Unexpected AWS charges

**Solutions:**

1. Stop all ECS services when not in use
2. Delete unused resources
3. Use Fargate Spot for non-critical services
4. Monitor CloudWatch billing alarms
5. Delete resources immediately after testing

---

## 📝 Quick Reference

### Important Commands

```bash
# View all resources
source aws-resources.txt
cat aws-resources.txt

# Check service status
aws ecs describe-services --cluster $CLUSTER_NAME --services ${PROJECT_NAME}-api-gateway

# View logs
aws logs tail /ecs/${PROJECT_NAME}-api-gateway --follow

# Test API
curl http://$ALB_DNS/health

# Check Cloud Map services
aws servicediscovery list-services --filters "Name=NAMESPACE_ID,Values=$NAMESPACE_ID"

# Test service discovery DNS (from within a task)
# nslookup auth-service.${PROJECT_NAME}.local

# Stop all services
for service in auth-service event-service seat-service reservation-service payment-service ticket-service notification-service api-gateway; do
  aws ecs update-service --cluster $CLUSTER_NAME --service ${PROJECT_NAME}-${service} --desired-count 0
done
```

### Resource IDs File

All resource IDs are saved in `aws-resources.txt`. Keep this file safe for cleanup.

### Estimated Costs

- **Infrastructure Setup:** ~$0.40/day (RDS, NAT Gateway)
- **ECS Services (9 services):** ~$3-4/day (8 services + Redis as ECS task)
- **ALB:** ~$0.20/day
- **Cloud Map (Service Discovery):** ~$0.10/day (8 services × $0.0125/service)
- **Data Transfer:** Variable
- **Total for 1 day testing:** ~$3-5

---

## ✅ Deployment Checklist

- [ ] Phase 1: AWS Account Setup complete
- [ ] Phase 2: Infrastructure Setup complete
- [ ] Phase 3: ECR Repositories created
- [ ] Phase 4: Docker Images built and pushed
- [ ] Phase 5: Task Definitions created
- [ ] Phase 6: Cloud Map namespace created
- [ ] Phase 6: ECS Services deployed with service discovery
- [ ] Phase 7: Load Balancer configured
- [ ] Phase 8: Migrations and seeders run
- [ ] Phase 9: Frontend deployed
- [ ] Phase 10: Testing completed
- [ ] Phase 11: (Optional) Scaling test completed
- [ ] Phase 12: Cleanup completed (if done testing)

---

## 🎉 Success!

Your microservices application is now deployed on AWS!

**Next Steps:**

1. Monitor services in CloudWatch
2. Set up auto-scaling policies
3. Configure custom domain with Route 53
4. Set up CI/CD pipeline
5. Implement monitoring and alerting

**Support:**

- Check CloudWatch logs for debugging
- Review AWS documentation for each service
- Use AWS Support if needed

---

**Document Version:** 1.0  
**Last Updated:** December 2025  
**Estimated Deployment Time:** 4-5 hours  
**Estimated Cost:** $3-5 for one day of testing
