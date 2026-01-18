# Integration Tests

This directory contains integration tests for the Ticket Booking Microservices system.

## Prerequisites

1. All backend services must be running:

   - Auth Service (Port 3001)
   - Event Service (Port 3002)
   - Seat Service (Port 3003)
   - Reservation Service (Port 3004)
   - Payment Service (Port 3005)
   - Ticket Service (Port 3006)
   - Notification Service (Port 3007)
   - API Gateway (Port 3000)

2. Infrastructure services:
   - PostgreSQL (Port 5432)
   - Redis (Port 6379)
   - LocalStack (Port 4566) - for AWS services

## Running Tests

### Run All Integration Tests

```bash
cd tests
npm run test:integration
```

### Run Specific Test Suite

```bash
# Auth service tests
npm test -- auth.test.ts

# Event service tests
npm test -- event.test.ts

# Booking flow tests
npm test -- booking-flow.test.ts

# API Gateway tests
npm test -- api-gateway.test.ts
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

## Test Structure

```
tests/
├── integration/          # Integration test files
│   ├── auth.test.ts      # Auth service tests
│   ├── event.test.ts     # Event service tests
│   ├── booking-flow.test.ts  # End-to-end booking flow
│   └── api-gateway.test.ts   # API Gateway tests
├── utils/                # Test utilities
│   └── test-helpers.ts   # Test client and helpers
├── fixtures/             # Test data fixtures
├── jest.config.js        # Jest configuration
└── package.json          # Test dependencies
```

## Test Coverage

### Auth Service Tests

- User registration
- User login
- Profile management
- Token validation

### Event Service Tests

- Event CRUD operations
- Venue management
- Event listing and filtering

### Booking Flow Tests

- Complete booking flow (Seats → Reservation → Payment)
- Seat locking and releasing
- Idempotent operations

### API Gateway Tests

- Health check aggregation
- Request routing
- JWT validation
- Public vs protected routes

## Environment Variables

Tests use the following environment variables (with defaults):

```bash
API_GATEWAY_URL=http://localhost:3000
AUTH_SERVICE_URL=http://localhost:3001
EVENT_SERVICE_URL=http://localhost:3002
SEAT_SERVICE_URL=http://localhost:3003
RESERVATION_SERVICE_URL=http://localhost:3004
PAYMENT_SERVICE_URL=http://localhost:3005
```

## Test Helpers

The `TestClient` class provides methods to interact with all services:

```typescript
import { TestClient } from "./utils/test-helpers";

const client = new TestClient();

// Register user
const user = await client.register({
  email: "test@example.com",
  password: "Test123!",
  firstName: "John",
  lastName: "Doe",
});

// Set auth token
client.setAuthToken(user.token);

// Create event
const event = await client.createEvent({...}, user.token);
```

## Writing New Tests

1. Import test helpers:

```typescript
import { TestClient, createTestUser } from "../utils/test-helpers";
```

2. Create test client:

```typescript
const client = new TestClient();
```

3. Set up test data:

```typescript
const user = await createTestUser(client);
```

4. Write test cases:

```typescript
it("should do something", async () => {
  const result = await client.someMethod();
  expect(result).toBeDefined();
});
```

## Troubleshooting

### Tests Fail with Connection Errors

- Ensure all services are running
- Check service URLs in environment variables
- Verify database connections

### Tests Fail with Timeout Errors

- Increase timeout in `jest.config.js`
- Check service health endpoints
- Verify infrastructure services are running

### Tests Create Duplicate Data

- Tests use timestamps to create unique data
- Clean up test data if needed
- Use idempotency keys where applicable

## Next Steps

- Add unit tests for individual services
- Add E2E tests with Cypress
- Add load testing scenarios
- Add SQS message flow tests
- Add ticket generation flow tests
