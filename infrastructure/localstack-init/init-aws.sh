#!/bin/bash

# ============================================
# LocalStack AWS Services Initialization
# ============================================
# This script initializes AWS services in LocalStack for local development
# Run automatically when LocalStack container starts
# ============================================

set -e

echo "🚀 Initializing LocalStack AWS services..."

# Wait for LocalStack to be ready
echo "⏳ Waiting for LocalStack to be ready..."
until curl -s http://localstack:4566/_localstack/health | grep -q '"sqs": "available"'; do
  echo "   Waiting for LocalStack services..."
  sleep 2
done

echo "✅ LocalStack is ready!"

# Set AWS CLI to use LocalStack
export AWS_ENDPOINT_URL=http://localstack:4566
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1

# ============================================
# Create S3 Buckets
# ============================================
echo "📦 Creating S3 buckets..."

aws --endpoint-url=$AWS_ENDPOINT_URL s3 mb s3://ticket-booking-frontend 2>/dev/null || echo "   Frontend bucket already exists"
aws --endpoint-url=$AWS_ENDPOINT_URL s3 mb s3://ticket-booking-event-images 2>/dev/null || echo "   Event images bucket already exists"
aws --endpoint-url=$AWS_ENDPOINT_URL s3 mb s3://ticket-booking-tickets-pdf 2>/dev/null || echo "   Tickets PDF bucket already exists"

# Configure CORS for frontend bucket
aws --endpoint-url=$AWS_ENDPOINT_URL s3api put-bucket-cors \
  --bucket ticket-booking-frontend \
  --cors-configuration '{
    "CORSRules": [
      {
        "AllowedOrigins": ["*"],
        "AllowedMethods": ["GET", "HEAD"],
        "AllowedHeaders": ["*"],
        "MaxAgeSeconds": 3000
      }
    ]
  }' 2>/dev/null || echo "   CORS already configured"

echo "✅ S3 buckets created"

# ============================================
# Create SQS Queues
# ============================================
echo "📨 Creating SQS queues..."

aws --endpoint-url=$AWS_ENDPOINT_URL sqs create-queue \
  --queue-name payment-processing-queue \
  --attributes '{"VisibilityTimeout": "300", "MessageRetentionPeriod": "1209600"}' \
  2>/dev/null || echo "   Payment queue already exists"

aws --endpoint-url=$AWS_ENDPOINT_URL sqs create-queue \
  --queue-name ticket-generation-queue \
  --attributes '{"VisibilityTimeout": "300", "MessageRetentionPeriod": "1209600"}' \
  2>/dev/null || echo "   Ticket generation queue already exists"

aws --endpoint-url=$AWS_ENDPOINT_URL sqs create-queue \
  --queue-name notification-queue \
  --attributes '{"VisibilityTimeout": "300", "MessageRetentionPeriod": "1209600"}' \
  2>/dev/null || echo "   Notification queue already exists"

aws --endpoint-url=$AWS_ENDPOINT_URL sqs create-queue \
  --queue-name reservation-expiry-queue \
  --attributes '{"VisibilityTimeout": "300", "MessageRetentionPeriod": "1209600"}' \
  2>/dev/null || echo "   Reservation expiry queue already exists"

# Dead Letter Queue
aws --endpoint-url=$AWS_ENDPOINT_URL sqs create-queue \
  --queue-name dead-letter-queue \
  --attributes '{"MessageRetentionPeriod": "1209600"}' \
  2>/dev/null || echo "   Dead letter queue already exists"

echo "✅ SQS queues created"

# ============================================
# Create SNS Topics
# ============================================
echo "📢 Creating SNS topics..."

aws --endpoint-url=$AWS_ENDPOINT_URL sns create-topic \
  --name booking-confirmed \
  2>/dev/null || echo "   Booking confirmed topic already exists"

aws --endpoint-url=$AWS_ENDPOINT_URL sns create-topic \
  --name payment-failed \
  2>/dev/null || echo "   Payment failed topic already exists"

aws --endpoint-url=$AWS_ENDPOINT_URL sns create-topic \
  --name ticket-generated \
  2>/dev/null || echo "   Ticket generated topic already exists"

echo "✅ SNS topics created"

# ============================================
# Verify SES Email (LocalStack)
# ============================================
echo "📧 Verifying SES email addresses..."

aws --endpoint-url=$AWS_ENDPOINT_URL ses verify-email-identity \
  --email-address noreply@ticketbooking.local \
  2>/dev/null || echo "   Email already verified"

aws --endpoint-url=$AWS_ENDPOINT_URL ses verify-email-identity \
  --email-address admin@ticketbooking.local \
  2>/dev/null || echo "   Email already verified"

echo "✅ SES emails verified"

# ============================================
# Create Secrets in Secrets Manager (Optional)
# ============================================
echo "🔐 Creating secrets in Secrets Manager..."

# JWT Secret
aws --endpoint-url=$AWS_ENDPOINT_URL secretsmanager create-secret \
  --name ticket-booking/jwt/secret \
  --secret-string '{"secret": "your-super-secret-jwt-key-change-in-production"}' \
  2>/dev/null || echo "   JWT secret already exists"

# Database Password (example)
aws --endpoint-url=$AWS_ENDPOINT_URL secretsmanager create-secret \
  --name ticket-booking/rds/password \
  --secret-string '{"password": "postgres"}' \
  2>/dev/null || echo "   Database password secret already exists"

echo "✅ Secrets created"

# ============================================
# Summary
# ============================================
echo ""
echo "🎉 LocalStack initialization complete!"
echo ""
echo "📋 Created Resources:"
echo "   ✅ 3 S3 Buckets"
echo "   ✅ 5 SQS Queues"
echo "   ✅ 3 SNS Topics"
echo "   ✅ 2 SES Email Addresses"
echo "   ✅ 2 Secrets Manager Secrets"
echo ""
echo "🔗 Access URLs:"
echo "   S3: http://localhost:4566"
echo "   SQS: http://localhost:4566"
echo "   SNS: http://localhost:4566"
echo "   SES: http://localhost:4566"
echo "   Secrets Manager: http://localhost:4566"
echo ""
echo "💡 Use AWS CLI with:"
echo "   export AWS_ENDPOINT_URL=http://localhost:4566"
echo "   export AWS_ACCESS_KEY_ID=test"
echo "   export AWS_SECRET_ACCESS_KEY=test"
echo ""

