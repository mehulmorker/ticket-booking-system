#!/bin/bash

# Service Verification Script
# This script verifies all infrastructure services are running and accessible

echo "🔍 Verifying Infrastructure Services..."
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose not found${NC}"
    exit 1
fi

cd "$(dirname "$0")"

# Check if services are running
echo "📦 Checking Docker containers..."
docker-compose ps

echo ""
echo "🔍 Testing Service Connectivity..."
echo ""

# Test PostgreSQL
echo -n "PostgreSQL (Port 5432): "
if docker-compose exec -T postgres pg_isready -U postgres &> /dev/null; then
    echo -e "${GREEN}✅ Running${NC}"
    
    # Check databases
    echo "   Databases:"
    docker-compose exec -T postgres psql -U postgres -c "\l" 2>/dev/null | grep -E "auth_db|event_db|seat_db|reservation_db|payment_db|ticket_db|notification_db" | while read line; do
        echo "   - $line"
    done
else
    echo -e "${RED}❌ Not accessible${NC}"
fi

# Test Redis
echo -n "Redis (Port 6379): "
if docker-compose exec -T redis redis-cli -a redispassword ping 2>/dev/null | grep -q PONG; then
    echo -e "${GREEN}✅ Running${NC}"
    
    # Test write/read
    docker-compose exec -T redis redis-cli -a redispassword SET test_key "test_value" &> /dev/null
    if docker-compose exec -T redis redis-cli -a redispassword GET test_key 2>/dev/null | grep -q "test_value"; then
        echo "   - Read/Write: ${GREEN}✅ Working${NC}"
        docker-compose exec -T redis redis-cli -a redispassword DEL test_key &> /dev/null
    fi
else
    echo -e "${RED}❌ Not accessible${NC}"
fi

# Test LocalStack
echo -n "LocalStack (Port 4566): "
if curl -s http://localhost:4566/_localstack/health &> /dev/null; then
    echo -e "${GREEN}✅ Running${NC}"
    
    # Check services
    SERVICES=$(curl -s http://localhost:4566/_localstack/health 2>/dev/null | python3 -c "import sys, json; data=json.load(sys.stdin); print(','.join(data.get('services', {}).keys()))" 2>/dev/null || echo "")
    if [ ! -z "$SERVICES" ]; then
        echo "   Available services: $SERVICES"
    fi
else
    echo -e "${YELLOW}⚠️  Not accessible (may be starting)${NC}"
    echo "   Check logs: docker-compose logs localstack"
fi

echo ""
echo "========================================"
echo "✅ Verification Complete"
echo ""
echo "Next steps:"
echo "1. Start backend services (see MANUAL_TESTING_GUIDE.md)"
echo "2. Test API endpoints with Postman or cURL"
echo "3. Start frontend: cd frontend && npm run dev"


