# Infrastructure as Code - AWS CDK

This directory contains AWS CDK (Cloud Development Kit) infrastructure code for deploying the Ticket Booking microservices platform to AWS.

## 🚀 One-Command Deployment

Instead of manually running 100+ AWS CLI commands, deploy everything with:

```bash
npm run deploy
```

That's it! The entire infrastructure will be created automatically.

---

## 📦 What Gets Deployed

### 1. **Networking** (VpcStack)

- VPC with public and private subnets across 2 AZs
- NAT Gateway for outbound internet access
- VPC Endpoints for AWS services (cost optimization):
  - Secrets Manager
  - ECR (API + Docker)
  - CloudWatch Logs
  - S3 (Gateway Endpoint)
  - SQS
  - SES
- Security Groups for ALB, ECS, RDS, and Redis

### 2. **Databases** (DatabaseStack)

- 7 RDS PostgreSQL instances (one per microservice)
- Redis as ECS Fargate task (cost-effective alternative to ElastiCache)
- Automated backups and SSL/TLS encryption
- Secrets Manager for credentials

### 3. **Storage** (StorageStack)

- S3 bucket for event images
- S3 bucket for ticket PDFs
- SQS queue for notifications (with Dead Letter Queue)
- Lifecycle policies for cost optimization

### 4. **Compute** (EcsClusterStack)

- ECS Fargate cluster
- Task definitions for 8 microservices:
  - auth-service
  - event-service
  - seat-service
  - reservation-service
  - payment-service
  - ticket-service
  - notification-service
  - api-gateway
- IAM roles with least-privilege permissions

### 5. **Load Balancing & Service Discovery** (EcsServicesStack)

- Application Load Balancer (ALB)
- Target groups for each service
- Path-based routing (/api/auth, /api/events, etc.)
- Cloud Map for service discovery
- Auto-scaling policies (CPU and memory-based)

### 6. **Frontend** (FrontendStack)

- S3 bucket for React frontend
- CloudFront CDN distribution
- HTTPS with automatic certificate
- API proxy to backend ALB

---

## 📋 Prerequisites

### 1. Install AWS CDK

```bash
npm install -g aws-cdk
```

### 2. Configure AWS Credentials

```bash
aws configure
# Enter your AWS Access Key ID, Secret Access Key, and region
```

### 3. Verify SES Email

Your email must be verified in AWS SES:

```bash
aws ses verify-email-identity --email-address your-email@example.com
```

Check verification status:

```bash
aws ses get-identity-verification-attributes --identities your-email@example.com
```

### 4. Build Docker Images

Before deploying, build and push your Docker images to ECR:

```bash
# Create ECR repositories
aws ecr create-repository --repository-name ticket-booking-auth
aws ecr create-repository --repository-name ticket-booking-event
aws ecr create-repository --repository-name ticket-booking-seat
aws ecr create-repository --repository-name ticket-booking-reservation
aws ecr create-repository --repository-name ticket-booking-payment
aws ecr create-repository --repository-name ticket-booking-ticket
aws ecr create-repository --repository-name ticket-booking-notification
aws ecr create-repository --repository-name ticket-booking-api-gateway

# Build and push images (see main deployment guide)
```

---

## 🛠️ Installation

### 1. Install Dependencies

```bash
cd infrastructure/cdk
npm install
```

### 2. Update Configuration

Edit `config/config.ts`:

```typescript
export const config: InfrastructureConfig = {
  projectName: "ticket-booking",

  environment: {
    account: "YOUR_AWS_ACCOUNT_ID", // Update this
    region: "ap-south-1", // Update if needed
  },

  ses: {
    verifiedEmail: "your-email@example.com", // Update this
  },

  // ... other settings
};
```

### 3. Bootstrap CDK (First Time Only)

```bash
npm run bootstrap
```

This creates the necessary S3 bucket and IAM roles for CDK deployments.

---

## 🚀 Deployment

### Deploy Everything

```bash
npm run deploy
```

This deploys all 6 stacks in the correct order:

1. VpcStack
2. DatabaseStack
3. StorageStack
4. EcsClusterStack
5. EcsServicesStack
6. FrontendStack

**Estimated Time:** 30-40 minutes

### Deploy Individual Stacks

```bash
# Deploy only VPC
npm run deploy:vpc

# Deploy only databases
npm run deploy:databases

# Deploy only storage
npm run deploy:storage

# Deploy only ECS cluster
npm run deploy:ecs

# Deploy only services
npm run deploy:services

# Deploy only frontend
npm run deploy:frontend
```

---

## 📊 View Deployment Progress

CDK will show real-time progress:

```
TicketBookingVpcStack: creating CloudFormation changeset...
 ✅  TicketBookingVpcStack

Outputs:
TicketBookingVpcStack.VpcId = vpc-0123456789abcdef0
TicketBookingVpcStack.EcsSecurityGroupId = sg-0123456789abcdef0
...
```

---

## 🔍 Verify Deployment

### 1. Check Stack Status

```bash
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE
```

### 2. Get API URL

```bash
aws cloudformation describe-stacks \
  --stack-name TicketBookingServicesStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text
```

### 3. Get Frontend URL

```bash
aws cloudformation describe-stacks \
  --stack-name TicketBookingFrontendStack \
  --query 'Stacks[0].Outputs[?OutputKey==`FrontendUrl`].OutputValue' \
  --output text
```

### 4. Test API

```bash
API_URL=$(aws cloudformation describe-stacks \
  --stack-name TicketBookingServicesStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text)

curl $API_URL/health
```

---

## 🗄️ Run Migrations

After deployment, run database migrations:

```bash
# From project root
./run-migrations-ecs.sh
```

Optionally, run seeders for demo data:

```bash
./run-seeders-ecs.sh
```

---

## 📈 Monitoring

### CloudWatch Logs

```bash
# View logs for a specific service
aws logs tail /ecs/ticket-booking-auth-service --follow

# View all ECS logs
aws logs tail /ecs/ticket-booking --follow
```

### ECS Service Status

```bash
aws ecs list-services --cluster ticket-booking-cluster
aws ecs describe-services --cluster ticket-booking-cluster --services ticket-booking-auth
```

### RDS Status

```bash
aws rds describe-db-instances --query 'DBInstances[*].[DBInstanceIdentifier,DBInstanceStatus]'
```

---

## 💰 Cost Estimation

**Monthly Cost (Approximate):**

| Resource                     | Cost            |
| ---------------------------- | --------------- |
| ECS Fargate (8 services)     | ~$35/month      |
| RDS PostgreSQL (7 instances) | ~$25/month      |
| NAT Gateway                  | ~$32/month      |
| Application Load Balancer    | ~$16/month      |
| S3 + CloudFront              | ~$5/month       |
| **Total**                    | **~$113/month** |

**Cost Optimization Tips:**

- Use VPC Endpoints (saves ~$10/month on NAT data transfer)
- Stop services when not in use
- Use t3.micro instances (Free Tier eligible for 12 months)
- Delete old S3 objects (lifecycle policies included)

---

## 🔄 Updates

### Update Infrastructure Code

```bash
# Make changes to CDK code
# Then deploy changes
npm run deploy
```

CDK automatically detects changes and only updates what's necessary.

### Update Application Code

```bash
# Rebuild and push Docker images
# Then force new deployment
aws ecs update-service \
  --cluster ticket-booking-cluster \
  --service ticket-booking-auth \
  --force-new-deployment
```

---

## 🧹 Cleanup

### Destroy Everything

```bash
npm run destroy
```

This will delete all resources in reverse order.

**⚠️ Warning:** This is irreversible! All data will be lost.

### Destroy Individual Stacks

```bash
cdk destroy TicketBookingFrontendStack
cdk destroy TicketBookingServicesStack
cdk destroy TicketBookingEcsStack
cdk destroy TicketBookingStorageStack
cdk destroy TicketBookingDatabaseStack
cdk destroy TicketBookingVpcStack
```

**Important:** Destroy in reverse order to avoid dependency errors.

---

## 🐛 Troubleshooting

### Error: "No default VPC found"

**Solution:** The CDK creates its own VPC. This error shouldn't occur.

### Error: "Repository does not exist"

**Solution:** Create ECR repositories first (see Prerequisites).

### Error: "Email not verified"

**Solution:** Verify your email in SES:

```bash
aws ses verify-email-identity --email-address your-email@example.com
```

### Error: "Insufficient IAM permissions"

**Solution:** Ensure your AWS user has Administrator access or these permissions:

- CloudFormation
- EC2
- ECS
- RDS
- S3
- SQS
- SES
- IAM
- CloudWatch
- Secrets Manager

### Services Not Starting

**Check logs:**

```bash
aws logs tail /ecs/ticket-booking-auth-service --follow
```

**Common issues:**

- Database not ready (wait 5 minutes after deployment)
- Missing environment variables
- Docker image not found in ECR

---

## 📚 CDK Commands

```bash
# Synthesize CloudFormation templates
npm run synth

# Show differences between deployed and local
npm run diff

# List all stacks
cdk list

# View CloudFormation template
cdk synth TicketBookingVpcStack
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         CloudFront                           │
│                    (Frontend CDN + HTTPS)                    │
└────────────┬────────────────────────────────┬───────────────┘
             │                                 │
             │ Static Files                    │ API Requests
             ▼                                 ▼
      ┌──────────┐                    ┌────────────────┐
      │ S3 Bucket│                    │      ALB       │
      │ Frontend │                    │ (Load Balancer)│
      └──────────┘                    └────────┬───────┘
                                               │
                      ┌────────────────────────┼────────────────┐
                      │                        │                │
                      ▼                        ▼                ▼
              ┌──────────────┐        ┌──────────────┐  ┌──────────────┐
              │ ECS Services │        │ ECS Services │  │ ECS Services │
              │ (Fargate)    │        │ (Fargate)    │  │ (Fargate)    │
              └──────┬───────┘        └──────┬───────┘  └──────┬───────┘
                     │                       │                 │
                     └───────────────────────┼─────────────────┘
                                             │
                     ┌───────────────────────┼─────────────────┐
                     │                       │                 │
                     ▼                       ▼                 ▼
              ┌──────────┐            ┌──────────┐      ┌──────────┐
              │   RDS    │            │  Redis   │      │    S3    │
              │PostgreSQL│            │  (ECS)   │      │  Buckets │
              └──────────┘            └──────────┘      └──────────┘
```

---

## 🎯 Benefits of Using CDK

### vs. Manual AWS CLI Deployment:

| Aspect            | Manual CLI        | AWS CDK      |
| ----------------- | ----------------- | ------------ |
| **Commands**      | 100+ commands     | 1 command    |
| **Time**          | 5+ hours          | 30 minutes   |
| **Errors**        | Prone to mistakes | Type-safe    |
| **Updates**       | Manual tracking   | Automatic    |
| **Rollback**      | Manual            | Automatic    |
| **Documentation** | Separate          | Code is docs |
| **Reusability**   | Copy-paste        | Modular      |

### Key Advantages:

1. **Infrastructure as Code:** Version control your infrastructure
2. **Type Safety:** Catch errors before deployment
3. **Reusability:** Deploy to multiple environments easily
4. **Automatic Dependencies:** CDK handles resource ordering
5. **Rollback:** Automatic rollback on failures
6. **Drift Detection:** Know when manual changes were made
7. **Cost Tracking:** Tag all resources automatically

---

## 📖 Learn More

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [CDK Best Practices](https://docs.aws.amazon.com/cdk/latest/guide/best-practices.html)
- [CDK Examples](https://github.com/aws-samples/aws-cdk-examples)

---

## 🤝 Contributing

To add new infrastructure:

1. Create a new stack in `lib/`
2. Import and instantiate in `bin/app.ts`
3. Add dependencies if needed
4. Test with `npm run synth`
5. Deploy with `npm run deploy`

---

## 📝 License

MIT License - Same as the main project

---

## ✅ Checklist

Before deploying:

- [ ] AWS CLI configured
- [ ] CDK installed globally
- [ ] Dependencies installed (`npm install`)
- [ ] Configuration updated (`config/config.ts`)
- [ ] SES email verified
- [ ] ECR repositories created
- [ ] Docker images built and pushed
- [ ] CDK bootstrapped (`npm run bootstrap`)

After deploying:

- [ ] All stacks deployed successfully
- [ ] API URL accessible
- [ ] Frontend URL accessible
- [ ] Database migrations run
- [ ] Health checks passing
- [ ] Monitoring configured

---

**Ready to deploy? Run `npm run deploy` and grab a coffee! ☕**
