#!/bin/bash

# Comprehensive Infrastructure Testing Script
# Tests all infrastructure services: PostgreSQL, Redis, LocalStack

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

cd "$(dirname "$0")"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Infrastructure Testing Suite${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Test 1: Check Docker Compose Services
echo -e "${BLUE}[1/8] Checking Docker Compose Services...${NC}"
if docker-compose ps | grep -q "Up"; then
    echo -e "${GREEN}✅ Docker Compose services are running${NC}"
    docker-compose ps
else
    echo -e "${RED}❌ Docker Compose services not running${NC}"
    exit 1
fi
echo ""

# Test 2: PostgreSQL Connection
echo -e "${BLUE}[2/8] Testing PostgreSQL Connection...${NC}"
if docker-compose exec -T postgres pg_isready -U postgres &> /dev/null; then
    echo -e "${GREEN}✅ PostgreSQL is accepting connections${NC}"
else
    echo -e "${RED}❌ PostgreSQL is not accepting connections${NC}"
    exit 1
fi
echo ""

# Test 3: PostgreSQL Databases
echo -e "${BLUE}[3/8] Verifying PostgreSQL Databases...${NC}"
DB_COUNT=$(docker-compose exec -T postgres psql -U postgres -t -c "SELECT COUNT(*) FROM pg_database WHERE datname LIKE '%_db';" 2>/dev/null | tr -d ' ')
EXPECTED_DBS=7

if [ "$DB_COUNT" = "$EXPECTED_DBS" ]; then
    echo -e "${GREEN}✅ All $EXPECTED_DBS databases exist${NC}"
    echo "   Databases:"
    docker-compose exec -T postgres psql -U postgres -c "\l" 2>/dev/null | grep -E "auth_db|event_db|seat_db|reservation_db|payment_db|ticket_db|notification_db" | while read line; do
        echo "   - $line"
    done
else
    echo -e "${RED}❌ Expected $EXPECTED_DBS databases, found $DB_COUNT${NC}"
    exit 1
fi
echo ""

# Test 4: PostgreSQL UUID Extension
echo -e "${BLUE}[4/8] Testing PostgreSQL UUID Extension...${NC}"
UUID_TEST=$(docker-compose exec -T postgres psql -U postgres -d auth_db -t -c "SELECT uuid_generate_v4();" 2>/dev/null | tr -d ' ' | head -1)
if [ ! -z "$UUID_TEST" ] && [ ${#UUID_TEST} -eq 36 ]; then
    echo -e "${GREEN}✅ UUID extension is working${NC}"
else
    echo -e "${RED}❌ UUID extension not working${NC}"
    exit 1
fi
echo ""

# Test 5: Redis Connection
echo -e "${BLUE}[5/8] Testing Redis Connection...${NC}"
if docker-compose exec -T redis redis-cli -a redispassword ping 2>/dev/null | grep -q PONG; then
    echo -e "${GREEN}✅ Redis is accepting connections${NC}"
else
    echo -e "${RED}❌ Redis is not accepting connections${NC}"
    exit 1
fi
echo ""

# Test 6: Redis Read/Write
echo -e "${BLUE}[6/8] Testing Redis Read/Write Operations...${NC}"
TEST_KEY="infra_test_$(date +%s)"
TEST_VALUE="test_value_123"

docker-compose exec -T redis redis-cli -a redispassword SET "$TEST_KEY" "$TEST_VALUE" &> /dev/null
RETRIEVED=$(docker-compose exec -T redis redis-cli -a redispassword GET "$TEST_KEY" 2>/dev/null | tr -d '\r\n')

if [ "$RETRIEVED" = "$TEST_VALUE" ]; then
    echo -e "${GREEN}✅ Redis read/write operations working${NC}"
    docker-compose exec -T redis redis-cli -a redispassword DEL "$TEST_KEY" &> /dev/null
else
    echo -e "${RED}❌ Redis read/write operations failed${NC}"
    exit 1
fi
echo ""

# Test 7: LocalStack Health
echo -e "${BLUE}[7/8] Testing LocalStack Health...${NC}"
LOCALSTACK_HEALTH=$(curl -s http://localhost:4566/_localstack/health 2>/dev/null || echo "")

if [ ! -z "$LOCALSTACK_HEALTH" ]; then
    if echo "$LOCALSTACK_HEALTH" | grep -q "ready"; then
        echo -e "${GREEN}✅ LocalStack is ready${NC}"
        
        # Check available services
        SERVICES=$(echo "$LOCALSTACK_HEALTH" | python3 -c "import sys, json; data=json.load(sys.stdin); print(','.join(data.get('services', {}).keys()))" 2>/dev/null || echo "")
        if [ ! -z "$SERVICES" ]; then
            echo "   Available services: $SERVICES"
        fi
    else
        echo -e "${YELLOW}⚠️  LocalStack is starting (may take 30-60 seconds)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  LocalStack not responding yet (may be starting)${NC}"
    echo "   This is normal - LocalStack takes 30-60 seconds to fully start"
fi
echo ""

# Test 8: LocalStack AWS Services (if ready)
if [ ! -z "$LOCALSTACK_HEALTH" ] && echo "$LOCALSTACK_HEALTH" | grep -q "ready"; then
    echo -e "${BLUE}[8/8] Testing LocalStack AWS Services...${NC}"
    
    # Test S3
    if docker-compose exec -T localstack aws --endpoint-url=http://localhost:4566 s3 ls 2>/dev/null | grep -q "event-images\|ticket-pdfs"; then
        echo -e "${GREEN}✅ S3 buckets exist${NC}"
    else
        echo -e "${YELLOW}⚠️  S3 buckets may not be initialized yet${NC}"
    fi
    
    # Test SQS
    if docker-compose exec -T localstack aws --endpoint-url=http://localhost:4566 sqs list-queues 2>/dev/null | grep -q "QueueUrl"; then
        echo -e "${GREEN}✅ SQS queues exist${NC}"
    else
        echo -e "${YELLOW}⚠️  SQS queues may not be initialized yet${NC}"
    fi
else
    echo -e "${BLUE}[8/8] Skipping AWS Services Test (LocalStack not ready)${NC}"
    echo -e "${YELLOW}   Run this script again in 30-60 seconds to test AWS services${NC}"
fi
echo ""

# Final Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

PASSED=0
FAILED=0

# Count results
if docker-compose exec -T postgres pg_isready -U postgres &> /dev/null; then ((PASSED++)); else ((FAILED++)); fi
if [ "$DB_COUNT" = "7" ]; then ((PASSED++)); else ((FAILED++)); fi
if docker-compose exec -T redis redis-cli -a redispassword ping 2>/dev/null | grep -q PONG; then ((PASSED++)); else ((FAILED++)); fi
if [ "$RETRIEVED" = "$TEST_VALUE" ]; then ((PASSED++)); else ((FAILED++)); fi

echo -e "Tests Passed: ${GREEN}$PASSED${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "Tests Failed: ${RED}$FAILED${NC}"
fi
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ Infrastructure is ready for backend services!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Start backend services (see MANUAL_TESTING_GUIDE.md)"
    echo "2. Test API endpoints"
    echo "3. Start frontend"
    exit 0
else
    echo -e "${RED}❌ Some infrastructure tests failed${NC}"
    echo "Please check the errors above and fix issues before proceeding"
    exit 1
fi


