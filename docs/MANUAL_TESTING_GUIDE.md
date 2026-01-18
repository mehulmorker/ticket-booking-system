# 🧪 Manual Testing Guide

This guide provides step-by-step instructions for manually testing all services and the frontend.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Starting Services](#starting-services)
3. [API Testing with cURL](#api-testing-with-curl)
4. [API Testing with Postman](#api-testing-with-postman)
5. [Frontend Testing](#frontend-testing)
6. [End-to-End Flow Testing](#end-to-end-flow-testing)
7. [Saga Pattern Testing](#8-saga-pattern-testing)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

1. **Run Saga Pattern Database Migration (Required for Payment Service):**

   ```bash
   # Using TypeORM migration (Recommended)
   cd backend/services/payment-service
   npm run migration:run
   ```

   **Note:** This migration must be run **before** starting the Payment Service if you want to use the Saga Pattern. The migration creates the `saga_executions` and `saga_steps` tables in the `payment_db` database.

   ⚠️ **Note:** TypeORM migrations are the standard approach and should be used for all services.

2. **All services must be running:**

   ```bash
   # Start infrastructure
   cd infrastructure
   docker-compose up -d

   # Start all backend services (in separate terminals)
   # Auth Service (Port 3001)
   # Event Service (Port 3002)
   # Seat Service (Port 3003)
   # Reservation Service (Port 3004)
   # Payment Service (Port 3005)
   # Ticket Service (Port 3006)
   # Notification Service (Port 3007)
   # API Gateway (Port 3000)
   ```

3. **Frontend must be running:**

   ```bash
   cd frontend
   npm run dev
   # Frontend runs on http://localhost:5173
   ```

4. **Tools needed:**
   - Postman (or similar API client)
   - Browser (for frontend testing)
   - cURL (for command-line testing)

---

## Starting Services

### Step 1: Start Infrastructure

```bash
cd infrastructure
docker-compose up -d

# Verify services are running
docker-compose ps

# Check logs if needed
docker-compose logs postgres    # or: docker compose logs postgres
docker-compose logs redis       # or: docker compose logs redis
docker-compose logs localstack  # or: docker compose logs localstack

# Follow logs in real-time
docker-compose logs -f postgres
docker-compose logs -f redis
docker-compose logs -f localstack
```

### Step 2: Start Backend Services

Open 8 separate terminal windows and run:

```bash
# Terminal 1 - Auth Service
cd backend/services/auth-service
npm run start:dev

# Terminal 2 - Event Service
cd backend/services/event-service
npm run start:dev

# Terminal 3 - Seat Service
cd backend/services/seat-service
npm run start:dev

# Terminal 4 - Reservation Service
cd backend/services/reservation-service
npm run start:dev

# Terminal 5 - Payment Service
cd backend/services/payment-service
npm run start:dev

# Terminal 6 - Ticket Service
cd backend/services/ticket-service
npm run start:dev

# Terminal 7 - Notification Service
cd backend/services/notification-service
npm run start:dev

# Terminal 8 - API Gateway
cd backend/services/api-gateway
npm run start:dev
```

### Step 3: Verify Services

Check health endpoints:

```bash
# API Gateway
curl http://localhost:3000/health

# Auth Service
curl http://localhost:3001/health

# Event Service
curl http://localhost:3002/health

# Seat Service (has /api prefix)
curl http://localhost:3003/api/health

# Reservation Service (has /api prefix)
curl http://localhost:3004/api/health

# Payment Service (has /api prefix)
curl http://localhost:3005/api/health

# Ticket Service (has /api prefix)
curl http://localhost:3006/api/health

# Notification Service (has /api prefix)
curl http://localhost:3007/api/health
```

---

## API Testing with cURL

### Auth Service Testing

#### 1. Register a New User

```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

**Expected Response:**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "test@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "USER"
  }
}
```

**Save the `accessToken` for subsequent requests!**

#### 2. Login

```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!"
  }'
```

#### 3. Get Profile (Protected Route)

```bash
# Replace YOUR_TOKEN with the token from registration/login
curl http://localhost:3001/auth/profile \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 4. Test via API Gateway

```bash
# Register via Gateway
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "gateway@example.com",
    "password": "Test123!",
    "firstName": "Gateway",
    "lastName": "User"
  }'
```

---

### Event Service Testing

#### 1. Create a Venue (Admin Required)

```bash
curl -X POST http://localhost:3002/events/venues \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Concert Hall",
    "address": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "capacity": 500
  }'
```

**Save the `venueId` from the response!**

#### 2. Create an Event

```bash
curl -X POST http://localhost:3002/events \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Summer Concert",
    "description": "Amazing summer concert",
    "category": "CONCERT",
    "venueId": "VENUE_ID_FROM_STEP_1",
    "startDate": "2025-12-31T20:00:00Z",
    "endDate": "2025-12-31T23:00:00Z"
  }'
```

**Save the `eventId` from the response!**

#### 3. Get All Events

```bash
curl http://localhost:3002/events
```

#### 4. Get Event by ID

```bash
curl http://localhost:3002/events/EVENT_ID
```

---

### Seat Service Testing

#### 1. Get Seats for an Event

```bash
curl http://localhost:3003/seats/event/EVENT_ID
```

#### 2. Lock Seats

```bash
curl -X POST http://localhost:3003/seats/lock \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "EVENT_ID",
    "seatIds": ["SEAT_ID_1", "SEAT_ID_2"],
    "lockDuration": 600
  }'
```

#### 3. Release Seats

```bash
curl -X POST http://localhost:3003/api/seats/release \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "EVENT_ID",
    "ownerId": "USER_ID",
    "seats": ["SEAT_ID_1", "SEAT_ID_2"]
  }'
```

#### 4. Extend Lock

```bash
curl -X PUT http://localhost:3003/api/seats/extend-lock \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "EVENT_ID",
    "ownerId": "USER_ID",
    "seats": ["SEAT_ID_1", "SEAT_ID_2"],
    "ttlSeconds": 300
  }'
```

#### 5. Test Automatic Expiry Cleanup ✅ (New Feature)

**Prerequisites:**

- Seat Service must be running
- Redis must be running
- PostgreSQL must be running

**Test Steps:**

1. **Lock Some Seats:**

   ```bash
   curl -X POST http://localhost:3003/api/seats/lock \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "eventId": "EVENT_ID",
       "ownerId": "USER_ID",
       "seats": ["SEAT_ID_1", "SEAT_ID_2"]
     }'
   ```

2. **Verify Locks Created:**

   ```bash
   # Check Redis locks
   docker exec ticket-booking-redis redis-cli -a redispassword \
     KEYS seat-service:seat-lock:*

   # Check database
   psql -h localhost -U postgres -d seat_db -c \
     "SELECT id, status, lock_expires_at FROM seats WHERE status = 'LOCKED';"
   ```

3. **Wait for Expiry (or Manually Expire):**

   **Option A: Wait 5+ minutes** for natural expiry

   **Option B: Manually expire Redis locks:**

   ```bash
   docker exec ticket-booking-redis redis-cli -a redispassword \
     DEL seat-service:seat-lock:SEAT_ID_1
   docker exec ticket-booking-redis redis-cli -a redispassword \
     DEL seat-service:seat-lock:SEAT_ID_2
   ```

4. **Check Seat Service Logs:**

   ```bash
   # Watch logs for cleanup job
   # Should see every 2 minutes:
   # [SeatLockCleanupService] Starting expired lock cleanup job
   # [SeatLockCleanupService] Found X seats with expired locks
   # [SeatLockCleanupService] Updated seat ... from LOCKED to AVAILABLE
   # [SeatLockCleanupService] Cleanup completed in Xms: Y updated, Z skipped, 0 errors
   ```

5. **Verify Database Updated:**

   ```bash
   psql -h localhost -U postgres -d seat_db -c \
     "SELECT id, status, lock_expires_at FROM seats WHERE id IN ('SEAT_ID_1', 'SEAT_ID_2');"
   ```

   - Should show `status = 'AVAILABLE'`
   - Should show `lock_expires_at = NULL`

6. **Verify Redis Locks:**
   ```bash
   docker exec ticket-booking-redis redis-cli -a redispassword \
     KEYS seat-service:seat-lock:*
   ```
   - Should not show expired locks

**Expected Behavior:**

- ✅ Cleanup job runs every 2 minutes
- ✅ Finds seats with expired `lockExpiresAt`
- ✅ Checks Redis lock status
- ✅ Updates database if Redis lock doesn't exist
- ✅ Skips if Redis lock still exists (was extended)
- ✅ Logs all operations

**Test Scenarios:**

1. **Normal Expiry:** Lock expires → Cleanup updates DB ✅
2. **Extended Lock:** Lock extended → Cleanup skips (Redis lock exists) ✅
3. **No Expired Locks:** No expired locks → Cleanup logs "No expired locks found" ✅
4. **Multiple Expired Locks:** Many expired locks → Cleanup processes in batches ✅
5. **Service Restart:** Service restarts → Cleanup resumes on next schedule ✅

---

### Reservation Service Testing

#### 1. Create Reservation

```bash
curl -X POST http://localhost:3004/reservations \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "EVENT_ID",
    "seatIds": ["SEAT_ID_1", "SEAT_ID_2"],
    "idempotencyKey": "unique-key-123"
  }'
```

#### 2. Get Reservation

```bash
curl http://localhost:3004/reservations/RESERVATION_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 3. Extend Reservation

```bash
curl -X POST http://localhost:3004/reservations/RESERVATION_ID/extend \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "duration": 600
  }'
```

---

### Payment Service Testing

#### 1. Initiate Payment

```bash
curl -X POST http://localhost:3005/payments/initiate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reservationId": "RESERVATION_ID",
    "paymentMethod": "CARD",
    "idempotencyKey": "payment-key-123"
  }'
```

#### 2. Process Payment

```bash
curl -X POST http://localhost:3005/payments/process/PAYMENT_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 3. Get Payment Status

```bash
curl http://localhost:3005/payments/PAYMENT_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## API Testing with Postman

### Import Postman Collection

1. **Download Postman Collection:**

   - Collection file: `docs/postman/Ticket-Booking-API.postman_collection.json`
   - Environment file: `docs/postman/Local.postman_environment.json`

2. **Import into Postman:**

   - Open Postman
   - Click "Import"
   - Select the collection file
   - Select the environment file

3. **Set Environment Variables:**
   - `base_url`: `http://localhost:3000` (API Gateway)
   - `auth_token`: (will be set automatically after login)

### Postman Collection Structure

```
Ticket Booking API
├── Auth
│   ├── Register User
│   ├── Login
│   ├── Get Profile
│   └── Refresh Token
├── Events
│   ├── Create Venue
│   ├── Get Venues
│   ├── Create Event
│   ├── Get Events
│   └── Get Event by ID
├── Seats
│   ├── Get Seats by Event
│   ├── Lock Seats
│   └── Release Seats
├── Reservations
│   ├── Create Reservation
│   ├── Get Reservation
│   └── Extend Reservation
└── Payments
    ├── Initiate Payment
    ├── Process Payment
    └── Get Payment
```

### Testing Flow in Postman

1. **Register/Login:**

   - Run "Register User" or "Login"
   - Token is automatically saved to `auth_token` variable

2. **Create Event:**

   - Run "Create Venue" (save venue ID)
   - Run "Create Event" (save event ID)

3. **Book Seats:**

   - Run "Get Seats by Event"
   - Run "Lock Seats" (save seat IDs)
   - Run "Create Reservation" (save reservation ID)

4. **Process Payment:**
   - Run "Initiate Payment" (save payment ID)
   - Run "Process Payment"

---

## Notification Service Testing

### Overview

The Notification Service handles sending emails and SMS notifications to users. It supports:

- **Email notifications** via AWS SES (or LocalStack in development)
- **SMS notifications** via AWS SNS (or LocalStack in development)
- **Email templates** for various events (booking confirmation, payment receipt, ticket ready, etc.)

### Prerequisites

- ✅ Notification Service running on port 3007
- ✅ LocalStack running (for SQS/SES/SNS in development)
- ✅ Infrastructure services running (PostgreSQL, Redis, LocalStack)

### Test 1: Send Email Notification (Direct API)

**Purpose:** Test email sending functionality directly via API.

```bash
curl -X POST http://localhost:3007/api/notifications/send \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-id-here",
    "type": "EMAIL",
    "event": "TICKET_READY",
    "recipient": "test@example.com",
    "data": {
      "userName": "John Doe",
      "eventName": "Summer Concert",
      "eventDate": "2025-12-31",
      "venueName": "Concert Hall",
      "seatNumbers": "A1, A2",
      "ticketDownloadUrl": "http://localhost:3000/api/tickets/download/ticket-id"
    }
  }'
```

**Expected Response:**

```json
{
  "id": "notification-id",
  "userId": "user-id-here",
  "type": "EMAIL",
  "event": "TICKET_READY",
  "recipient": "test@example.com",
  "status": "SENT",
  "subject": "Your Tickets Are Ready - Summer Concert",
  "body": "Hello John Doe,\n\nYour tickets for Summer Concert are ready!...",
  "sentAt": "2025-12-02T10:30:00Z",
  "externalId": "message-id-from-ses"
}
```

**Verification:**

- ✅ Status should be `SENT`
- ✅ `sentAt` should be populated
- ✅ `externalId` should contain SES message ID
- ✅ Check notification service logs: "Email sent to test@example.com, MessageId: ..."

### Test 2: Send Email via API Gateway

**Purpose:** Test email sending through API Gateway.

```bash
curl -X POST http://localhost:3000/api/notifications/send \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID",
    "type": "EMAIL",
    "event": "PAYMENT_RECEIPT",
    "recipient": "test@example.com",
    "data": {
      "userName": "John Doe",
      "amount": "200.00",
      "transactionId": "txn-12345",
      "paymentMethod": "CARD",
      "paymentDate": "2025-12-02"
    }
  }'
```

### Test 3: Test All Email Templates

**Available Events:**

- `BOOKING_CONFIRMED` - Sent when booking is confirmed
- `PAYMENT_RECEIPT` - Sent after payment is processed
- `TICKET_READY` - Sent when ticket is generated
- `BOOKING_REMINDER` - Sent as reminder before event
- `CANCELLATION` - Sent when booking is cancelled

**Test Booking Confirmation:**

```bash
curl -X POST http://localhost:3007/api/notifications/send \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-id",
    "type": "EMAIL",
    "event": "BOOKING_CONFIRMED",
    "recipient": "test@example.com",
    "data": {
      "userName": "John Doe",
      "eventName": "Summer Concert",
      "eventDate": "2025-12-31",
      "venueName": "Concert Hall",
      "seatNumbers": "A1, A2",
      "reservationId": "reservation-id"
    }
  }'
```

**Test Payment Receipt:**

```bash
curl -X POST http://localhost:3007/api/notifications/send \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-id",
    "type": "EMAIL",
    "event": "PAYMENT_RECEIPT",
    "recipient": "test@example.com",
    "data": {
      "userName": "John Doe",
      "amount": "200.00",
      "transactionId": "txn-12345",
      "paymentMethod": "CARD",
      "paymentDate": "2025-12-02"
    }
  }'
```

### Test 4: Get Notification Status

**Purpose:** Check the status of a sent notification.

```bash
# Get notification by ID
curl http://localhost:3007/api/notifications/NOTIFICATION_ID

# Get notification status
curl http://localhost:3007/api/notifications/NOTIFICATION_ID/status

# Get all notifications for a user
curl http://localhost:3007/api/notifications/user/USER_ID
```

**Expected Response:**

```json
{
  "id": "notification-id",
  "status": "SENT",
  "sentAt": "2025-12-02T10:30:00Z",
  "externalId": "ses-message-id"
}
```

### Test 5: Verify LocalStack Email Logging

**Purpose:** In development, emails are sent to LocalStack (not actually delivered). Verify LocalStack received the request.

```bash
# Check LocalStack logs for SES requests
docker logs ticket-booking-localstack | grep -i ses

# Or follow logs in real-time
docker logs -f ticket-booking-localstack | grep -i ses
```

**Expected Output:**

- Should see SES API calls logged
- Should see email send requests

### Test 6: Check Notification Service Logs

**Purpose:** Verify email sending is logged correctly.

```bash
# Watch notification service logs
# Should see:
# [SesService] Email sent to test@example.com, MessageId: ...
# [NotificationsService] Notification <id> sent via EMAIL to test@example.com
```

### Test 7: Test SMS Notification (Optional)

**Purpose:** Test SMS sending functionality (if SNS is configured).

```bash
curl -X POST http://localhost:3007/api/notifications/send \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-id",
    "type": "SMS",
    "event": "TICKET_READY",
    "recipient": "+1234567890",
    "data": {
      "userName": "John Doe",
      "eventName": "Summer Concert"
    }
  }'
```

**Note:** SMS requires AWS SNS configuration and phone number verification in production.

### Test 8: Test Notification via SQS Queue (Integration Test)

**Purpose:** Test that notifications are automatically triggered via SQS queue after ticket generation.

**✅ Status:** Integration is complete! Ticket service automatically publishes to notification queue.

**Automatic Test (End-to-End Flow):**

The notification is now automatically sent when you complete a booking:

1. **Complete a booking flow:**

   - Create reservation
   - Initiate payment
   - Confirm payment
   - Ticket will be generated automatically
   - **Notification will be sent automatically to SQS queue**

2. **Verify Ticket Service published to queue:**

   ```bash
   docker logs ticket-booking-ticket-service | grep -i notification
   # Should see: "Sent ticket ready notification for ticket..."
   # Should see: "Sent notification message to queue: ..."
   ```

3. **Verify Notification Service consumed the message:**

   ```bash
   docker logs ticket-booking-notification-service | grep -i "Processing notification"
   # Should see: "Processing notification: TICKET_READY via EMAIL to..."
   # Should see: "Successfully sent notification for user..."
   ```

4. **Verify notification was created:**

   ```bash
   curl http://localhost:3007/api/notifications/user/USER_ID
   ```

**Manual Test (Optional - Direct SQS Message):**

You can also test by sending a message directly to the queue (simulates what ticket service does):

```bash
# Using AWS CLI (if configured for LocalStack)
aws --endpoint-url=http://localhost:4566 sqs send-message \
  --queue-url http://localhost:4566/000000000000/notification-queue \
  --message-body '{
    "type": "NOTIFICATION",
    "userId": "user-id",
    "notificationType": "EMAIL",
    "event": "TICKET_READY",
    "recipient": "test@example.com",
    "data": {
      "userName": "John Doe",
      "eventName": "Summer Concert",
      "eventDate": "2025-12-31",
      "venueName": "Concert Hall",
      "seatNumbers": "A1, A2",
      "ticketDownloadUrl": "http://localhost:3000/api/tickets/download/ticket-id"
    }
  }'
```

**Note:** The message format must match what the notification consumer expects:

- `type: "NOTIFICATION"` (required)
- `notificationType: "EMAIL"` (not `type: "EMAIL"`)
- All other fields as shown above

### ✅ Integration Complete

**Current Status:**

- ✅ Notification Service is fully implemented
- ✅ Email/SMS sending works via direct API
- ✅ SQS consumer exists in Notification Service
- ✅ **Ticket Service automatically publishes to notification queue after ticket generation**
- ✅ **Service-to-service authentication implemented for user email lookup**

**Implemented Flow:**

```
Ticket Generated
   ↓
Ticket Service fetches user email from Auth Service (service JWT)
   ↓
Ticket Service publishes to notification-queue
   ↓
Notification Service consumes message
   ↓
Email sent to user automatically
```

**How to Test End-to-End:**

1. **Complete a booking flow:**

   - Create reservation
   - Initiate payment
   - Confirm payment
   - Ticket will be generated automatically
   - Notification will be sent automatically

2. **Check ticket service logs:**

   ```bash
   docker logs ticket-booking-ticket-service | grep -i notification
   # Should see: "Sent ticket ready notification for ticket..."
   ```

3. **Check notification service logs:**

   ```bash
   docker logs ticket-booking-notification-service | grep -i "Processing notification"
   # Should see: "Processing notification: TICKET_READY via EMAIL to..."
   ```

4. **Verify email was sent:**
   - Check LocalStack SES logs
   - Or query notification service database

### Verification Checklist

- [ ] Email notification can be sent via direct API
- [ ] Email notification can be sent via API Gateway
- [ ] All email templates work correctly
- [ ] Notification status can be retrieved
- [ ] LocalStack logs show SES requests
- [ ] Notification service logs show email sending
- [ ] SMS notification works (if configured)
- [ ] SQS consumer processes messages (when manually sent)
- [ ] **Automatic notification sent after ticket generation** ✅
- [ ] **Service-to-service auth works for user email lookup** ✅
- [ ] **End-to-end flow: Payment → Ticket → Notification → Email** ✅

---

## Frontend Testing

### Step 1: Start Frontend

```bash
cd frontend
npm run dev
```

Frontend will be available at: `http://localhost:5173`

### Step 2: Test Authentication Flow

1. **Open Browser:** Navigate to `http://localhost:5173`

2. **Register:**

   - Click "Register" or navigate to `/register`
   - Fill in form:
     - Email: `test@example.com`
     - Password: `Test123!`
     - First Name: `John`
     - Last Name: `Doe`
   - Click "Register"
   - Should redirect to `/events`

3. **Login:**

   - Click "Login" or navigate to `/login`
   - Enter credentials
   - Click "Sign in"
   - Should redirect to `/events`

4. **Logout:**
   - Click "Logout" in header
   - Should redirect to home page

### Step 3: Test Event Browsing

1. **View Events:**

   - Navigate to `/events`
   - Should see list of events (if any exist)
   - Test search functionality
   - Test category filter

2. **View Event Details:**
   - Click on an event card
   - Should see event details page
   - Should see seat selection placeholder

### Step 4: Test Seat Locking & Extension (Future Testing)

**⏳ PENDING: Frontend extend lock integration**

1. **Lock Seats:**

   - Select seats on event detail page
   - Click "Lock Seats"
   - Should see lock confirmation
   - Should see countdown timer showing lock expiry

2. **Automatic Lock Extension (When Implemented):**

   - Start checkout process
   - Wait until lock has < 1 minute remaining
   - Frontend should automatically extend lock
   - Verify countdown timer resets
   - Verify lock expiry time updated

3. **Manual Lock Extension (When Implemented):**

   - Lock seats
   - Click "Extend Lock" button
   - Should extend lock by 5 minutes
   - Verify countdown timer updates
   - Verify API call succeeds

4. **Lock Expiry Handling:**

   - Lock seats
   - Wait for lock to expire (or manually expire in Redis)
   - Try to proceed with checkout
   - Should show error: "Seats are no longer locked"
   - Should prompt user to select seats again

5. **Automatic Expiry Cleanup (Backend):**
   - Lock seats via API
   - Wait 5+ minutes OR manually delete Redis locks
   - Watch Seat Service logs - cleanup job runs every 2 minutes
   - Verify database: seats should be updated to `AVAILABLE`
   - Verify Redis: expired locks should be gone
   - See detailed testing steps in "Seat Service Testing" section below

### Step 5: Test Protected Routes

1. **Try to Access Protected Route Without Login:**

   - Logout if logged in
   - Navigate to `/events/:id` directly
   - Should redirect to `/login`

2. **Access After Login:**
   - Login first
   - Navigate to `/events/:id`
   - Should see event details

---

## End-to-End Flow Testing

### Complete Booking Flow (Step-by-Step)

This section provides the **correct order** for testing the complete booking flow from start to finish. Follow these steps **in sequence** as each step depends on the previous one.

#### Prerequisites

- ✅ All backend services running
- ✅ Frontend running (optional, for UI testing)
- ✅ Infrastructure running (PostgreSQL, Redis, LocalStack)
- ✅ Saga pattern migration completed (for Payment Service)

---

#### Step 1: Register User

**Purpose:** Create a user account and get authentication token.

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@test.com",
    "password": "Test123!",
    "firstName": "Test",
    "lastName": "User"
  }'
```

**Save the response:**

- `user.id` - User ID (use as `USER_ID`)

**Note:** Registration does NOT return a token. You need to login after registration to get the token.

**Expected Response:**

```json
{
  "success": true,
  "message": "User registered successfully",
  "user": {
    "id": "user-id-here",
    "email": "user@test.com",
    ...
  }
}
```

**After Registration, Login to Get Token:**

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@test.com",
    "password": "Test123!"
  }'
```

**Save from login response:**

- `accessToken` - Authentication token (use as `YOUR_TOKEN`)
- `user.id` - User ID (use as `USER_ID`) ⚠️ **IMPORTANT: This is the userId you'll use for locking seats**

**Note:** The `user.id` from the login response is the same as the `sub` field in the JWT token. This userId must be used as `ownerId` when locking seats.

---

#### Step 2: Create Venue

**Purpose:** Create a venue where events will be held.

```bash
curl -X POST http://localhost:3000/api/venues \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Venue",
    "address": "123 Test St",
    "city": "Test City",
    "state": "TS",
    "zipCode": "12345",
    "capacity": 100
  }'
```

**Note:** The endpoint is `/api/venues` (not `/api/events/venues`).

**Save the response:**

- `id` - Venue ID (use as `VENUE_ID`)

---

#### Step 3: Create Event

**Purpose:** Create an event at the venue.

```bash
curl -X POST http://localhost:3000/api/events \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Concert",
    "description": "A test concert event",
    "category": "CONCERT",
    "venueId": "VENUE_ID",
    "eventDate": "2025-12-31T20:00:00Z",
    "startTime": "20:00:00",
    "endTime": "23:00:00",
    "totalSeats": 100
  }'
```

**Note:**

- Use `title` (not `name`)
- Use `eventDate` (not `startDate`)
- Use `startTime` and `endTime` (not `endDate`)
- `totalSeats` is required

**Save the response:**

- `id` - Event ID (use as `EVENT_ID`)

**Note:** After creating the event, seats are automatically created. You may need to wait a moment for seat creation to complete.

---

#### Step 4: Get Available Seats

**Purpose:** View available seats for the event.

```bash
curl http://localhost:3000/api/seats/event/EVENT_ID/available \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Save the response:**

- Select 1-2 seat IDs from the available seats (use as `SEAT_ID_1`, `SEAT_ID_2`)

**Expected Response:**

```json
[
  {
    "id": "seat-id-1",
    "row": "A",
    "number": "1",
    "status": "AVAILABLE",
    ...
  },
  ...
]
```

---

#### Step 5: Lock Seats ⚠️ **REQUIRED BEFORE RESERVATION**

**Purpose:** Lock selected seats for a temporary period (typically 5 minutes). This prevents other users from booking the same seats while you complete your reservation.

**Why this step is required:**

- Creates a Redis lock with TTL (Time To Live)
- Updates seat status in database to `LOCKED`
- Sets `lockedBy` field to your `userId`
- Sets `reservationId` field to `null` (no reservation yet)
- Reservation service validates that seats are locked by you before creating a reservation

```bash
curl -X POST http://localhost:3000/api/seats/lock \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "EVENT_ID",
    "ownerId": "USER_ID",
    "seats": ["SEAT_ID_1", "SEAT_ID_2"]
  }'
```

**⚠️ CRITICAL:**

- Use `USER_ID` from **Step 1 (Login response)** - this is the `user.id` from the login response
- The `ownerId` must match the `userId` that will be extracted from your JWT token when creating the reservation
- The field name is `seats` (not `seatIds`)
- Lock expires in 5 minutes - complete the reservation flow quickly

**How to get USER_ID:**

- From login response: `user.id` field
- Or decode JWT token: The `sub` field in the JWT token payload is your `userId`

**Expected Response:**

```json
{
  "success": true,
  "lockedSeats": ["SEAT_ID_1", "SEAT_ID_2"],
  "lockExpiresAt": "2025-12-02T10:15:00Z"
}
```

**Verify Lock:**

```bash
# Check Redis lock exists
docker exec ticket-booking-redis redis-cli -a redispassword \
  GET "seat-service:seat-lock:SEAT_ID_1"

# Should return: USER_ID (the owner of the lock)

# Verify seat in database (after reservation creation)
# Check that lockedBy = USER_ID and reservationId = RESERVATION_ID
```

---

#### Step 6: Create Reservation

**Purpose:** Create a reservation for the locked seats. The reservation service will:

- Validate that seats are available or locked by the current user
- Create a reservation record
- Update `reservationId` field on seats (simple database update, no lock transfer)
- Keep `lockedBy` as `userId` (no change to Redis lock)
- Set reservation expiry (typically 15 minutes)

**Note:** The reservation service now simply updates the `reservationId` field on seats. The Redis lock remains with your `userId`, and the `reservationId` field tracks which reservation owns the seats. This eliminates lock transfer complexity and race conditions.

```bash
curl -X POST http://localhost:3000/api/reservations \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "EVENT_ID",
    "seatIds": ["SEAT_ID_1", "SEAT_ID_2"],
    "totalAmount": 200.00,
    "idempotencyKey": "reservation-$(date +%s)"
  }'
```

**Save the response:**

- `id` - Reservation ID (use as `RESERVATION_ID`)

**Expected Response:**

```json
{
  "id": "reservation-id-here",
  "userId": "USER_ID",
  "eventId": "EVENT_ID",
  "seatIds": ["SEAT_ID_1", "SEAT_ID_2"],
  "status": "PENDING",
  "expiresAt": "2025-12-02T10:20:00Z",
  ...
}
```

**Verify:**

- Reservation status should be `PENDING`
- Seats should remain `LOCKED` in database
- Seats should have `lockedBy = USER_ID` (Redis lock owner)
- Seats should have `reservationId = RESERVATION_ID` (tracks reservation ownership)

**Verify Seat State in Database:**

```bash
# Check seat has reservationId set
psql -h localhost -U postgres -d seat_db -c "
  SELECT id, status, \"lockedBy\", \"reservationId\", \"lockExpiresAt\"
  FROM seats
  WHERE id = 'SEAT_ID_1';
"

# Should show:
# - status: LOCKED
# - lockedBy: USER_ID
# - reservationId: RESERVATION_ID
# - lockExpiresAt: (timestamp)
```

---

#### Step 7: Initiate Payment

**Purpose:** Create a payment record for the reservation.

```bash
curl -X POST http://localhost:3000/api/payments/initiate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reservationId": "RESERVATION_ID",
    "paymentMethod": "CARD",
    "amount": 200.00,
    "eventId": "EVENT_ID",
    "idempotencyKey": "payment-$(date +%s)"
  }'
```

**Note:** `eventId` is required for the initiate payment endpoint.

**Save the response:**

- `id` - Payment ID (use as `PAYMENT_ID`)

**Expected Response:**

```json
{
  "id": "payment-id-here",
  "reservationId": "RESERVATION_ID",
  "amount": 200.00,
  "status": "PENDING",
  ...
}
```

---

#### Step 8: Confirm Payment (Triggers Saga Pattern) ⚠️ **FINAL STEP**

**Purpose:** Confirm the payment and trigger the Saga Pattern orchestration. This will:

1. Mark payment as `COMPLETED`
2. Confirm reservation (status: `CONFIRMED`)
3. Confirm seats (status: `RESERVED`)
4. Generate ticket (status: `GENERATED`)
5. **Send notification automatically** (via SQS queue) ✅

```bash
curl -X POST http://localhost:3000/api/payments/confirm \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentId": "PAYMENT_ID",
    "transactionId": "txn-$(date +%s)",
    "paymentDetails": "{\"cardLast4\":\"1234\",\"cardBrand\":\"VISA\"}"
  }'
```

**Note:** `paymentDetails` should be a JSON string, not an object.

**Expected Response:**

```json
{
  "id": "PAYMENT_ID",
  "status": "COMPLETED",
  "reservationId": "RESERVATION_ID",
  ...
}
```

---

#### Step 9: Verify Complete Flow

**Verify Payment Status:**

```bash
curl http://localhost:3000/api/payments/PAYMENT_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

- ✅ Status should be `COMPLETED`

**Verify Reservation Status:**

```bash
curl http://localhost:3000/api/reservations/RESERVATION_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

- ✅ Status should be `CONFIRMED`

**Verify Seats Status:**

```bash
curl http://localhost:3000/api/seats/event/EVENT_ID/available \
  -H "Authorization: Bearer YOUR_TOKEN"
```

- ✅ Locked seats should no longer appear in available seats
- ✅ Seats should have status `RESERVED` in database
- ✅ Seats should have `reservationId = null` (cleared after confirmation)
- ✅ Seats should have `lockedBy = null` (cleared after confirmation)

**Verify Ticket Generated:**

```bash
curl http://localhost:3000/api/tickets/reservation/RESERVATION_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

- ✅ Ticket should exist with status `GENERATED`
- ✅ PDF should be available in S3

**Verify Saga Execution:**

```bash
psql -h localhost -U postgres -d payment_db -c "
  SELECT
    id,
    saga_type,
    status,
    started_at,
    completed_at
  FROM saga_executions
  ORDER BY created_at DESC
  LIMIT 1;
"
```

- ✅ Status should be `COMPLETED`

**Verify Saga Steps:**

```bash
psql -h localhost -U postgres -d payment_db -c "
  SELECT
    step_name,
    step_order,
    status,
    started_at,
    completed_at
  FROM saga_steps
  WHERE saga_execution_id = (
    SELECT id FROM saga_executions ORDER BY created_at DESC LIMIT 1
  )
  ORDER BY step_order;
"
```

- ✅ All 4 steps should have status `COMPLETED`:
  1. `charge_payment`
  2. `confirm_reservation`
  3. `confirm_seats`
  4. `generate_ticket`

**Verify Notification Sent:**

```bash
# Check ticket service logs for notification
docker logs ticket-booking-ticket-service | grep -i notification
# Should see: "Sent ticket ready notification for ticket..."
# Should see: "Sent notification message to queue: ..."

# Check notification service logs
docker logs ticket-booking-notification-service | grep -i "Processing notification"
# Should see: "Processing notification: TICKET_READY via EMAIL to..."

# Verify notification in database
curl http://localhost:3007/api/notifications/user/USER_ID
```

- ✅ Notification should be created with status `SENT`
- ✅ Notification should have `event: "TICKET_READY"`
- ✅ Email should be sent to user's email address

---

### Flow Summary

```
1. Register User
   ↓
2. Create Venue
   ↓
3. Create Event (seats auto-created)
   ↓
4. Get Available Seats
   ↓
5. Lock Seats ⚠️ (REQUIRED - Creates Redis lock)
   ↓
6. Create Reservation (Validates locks exist)
   ↓
7. Initiate Payment
   ↓
8. Confirm Payment (Triggers Saga Pattern)
   ↓
   ├─→ Charge Payment
   ├─→ Confirm Reservation
   ├─→ Confirm Seats
   └─→ Generate Ticket
      ↓
   Ticket Service fetches user email (service-to-service auth)
      ↓
   Ticket Service → SQS Notification Queue
      ↓
   Notification Service consumes message
      ↓
   Email sent to user automatically ✅
9. Verify All Steps Completed
```

### Important Notes

- **Step 5 (Lock Seats) is REQUIRED** - The reservation service validates that seats are locked before creating a reservation
- **Lock TTL:** Seats are locked for 10 minutes by default. If you don't complete the flow within this time, locks will expire
- **Reservation TTL:** Reservations expire after 15 minutes if payment is not completed
- **Saga Pattern:** Payment confirmation triggers a 4-step saga orchestration that ensures all steps complete or rollback
- **Idempotency:** Use unique `idempotencyKey` values to prevent duplicate operations

---

## Troubleshooting

### Service Won't Start

1. **Check Port Availability:**

   ```bash
   lsof -i :3001  # Check if port is in use
   kill -9 <PID>  # Kill process if needed
   ```

2. **Check Database Connection:**

   ```bash
   docker-compose ps postgres
   psql -h localhost -p 5432 -U postgres -d auth_db
   ```

3. **Check Environment Variables:**
   ```bash
   cat backend/services/auth-service/.env
   ```

### API Returns 401 Unauthorized

- Check if token is valid
- Check if token is expired
- Verify token format: `Bearer YOUR_TOKEN`

### API Returns 500 Internal Server Error

- Check service logs
- Check database connection
- Check Redis connection (for Seat Service)
- Check LocalStack (for SQS/S3)

### Frontend Can't Connect to API

- Verify API Gateway is running on port 3000
- Check browser console for errors
- Verify CORS is enabled in API Gateway
- Check network tab in browser DevTools

---

## 7. Saga Pattern Testing

### Prerequisites

- ✅ All services running
- ✅ Saga pattern enabled (`USE_SAGA_PATTERN=true` in Payment Service)
- ✅ Database tables created (`saga_executions`, `saga_steps`)
- ✅ Postman collection updated with new endpoints

### ⚠️ Important: Required Flow Order

**Before testing any saga scenario, you MUST follow this order:**

1. **Lock Seats** (Step 2 in Scenario 1) - Creates Redis lock
2. **Create Reservation** (Step 3 in Scenario 1) - Validates locks exist
3. **Initiate Payment** (Step 4 in Scenario 1)
4. **Confirm Payment** (Step 5 in Scenario 1) - Triggers Saga

**Why?** The reservation service validates that seats are locked before creating a reservation. Skipping the lock step will cause reservation creation to fail.

---

### Test Scenario 1: Happy Flow (All Steps Succeed) ✅

**Goal:** Verify complete saga execution when all steps succeed.

#### Step 1: Setup Test Data

```bash
# 1. Register and login to get token
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "saga-test@example.com",
    "password": "Test123!",
    "firstName": "Saga",
    "lastName": "Test"
  }'

# Save the token from response
TOKEN="your-auth-token-here"
USER_ID="user-id-from-response"

# 2. Create an event (or use existing)
EVENT_ID="existing-event-id"

# 3. Get available seats
curl http://localhost:3000/api/seats/event/${EVENT_ID}/available \
  -H "Authorization: Bearer ${TOKEN}"

# Save seat IDs
SEAT_ID_1="seat-id-1"
SEAT_ID_2="seat-id-2"
```

#### Step 2: Lock Seats ⚠️ **REQUIRED**

**Important:** You must lock seats BEFORE creating a reservation. The reservation service validates that seats are locked.

```bash
# Lock seats
curl -X POST http://localhost:3000/api/seats/lock \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"eventId\": \"${EVENT_ID}\",
    \"ownerId\": \"${USER_ID}\",
    \"seats\": [\"${SEAT_ID_1}\", \"${SEAT_ID_2}\"]
  }"

# Verify lock was created
docker exec ticket-booking-redis redis-cli -a redispassword \
  GET "seat-service:seat-lock:${SEAT_ID_1}"
# Should return: USER_ID
```

#### Step 3: Create Reservation

```bash
# Create reservation (validates locks exist)
curl -X POST http://localhost:3000/api/reservations \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"eventId\": \"${EVENT_ID}\",
    \"seatIds\": [\"${SEAT_ID_1}\", \"${SEAT_ID_2}\"],
    \"totalAmount\": 200.00,
    \"idempotencyKey\": \"reservation-$(date +%s)\"
  }"

# Save reservation ID
RESERVATION_ID="reservation-id-from-response"
```

**Expected Result:**

- ✅ Reservation created with status `PENDING`
- ✅ Seats remain locked (status: `LOCKED`)
- ✅ Seats have `lockedBy = USER_ID` (Redis lock owner)
- ✅ Seats have `reservationId = RESERVATION_ID` (tracks reservation ownership)

**Verify Seat State:**

```bash
# Check seat has reservationId set
psql -h localhost -U postgres -d seat_db -c "
  SELECT id, status, \"lockedBy\", \"reservationId\"
  FROM seats
  WHERE id = '${SEAT_ID_1}';
"

# Should show:
# - status: LOCKED
# - lockedBy: USER_ID
# - reservationId: RESERVATION_ID
```

#### Step 4: Initiate Payment

```bash
# Initiate payment
curl -X POST http://localhost:3000/api/payments/initiate \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"reservationId\": \"${RESERVATION_ID}\",
    \"paymentMethod\": \"CARD\",
    \"amount\": 200.00,
    \"eventId\": \"${EVENT_ID}\",
    \"idempotencyKey\": \"payment-$(date +%s)\"
  }"

# Save payment ID
PAYMENT_ID="payment-id-from-response"
```

**Expected Result:**

- ✅ Payment created with status `PENDING`

#### Step 5: Confirm Payment (Triggers Saga)

```bash
# Confirm payment - THIS TRIGGERS THE SAGA
curl -X POST http://localhost:3000/api/payments/confirm \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"paymentId\": \"${PAYMENT_ID}\",
    \"transactionId\": \"txn-$(date +%s)\",
    \"paymentDetails\": \"{\\\"cardLast4\\\":\\\"1234\\\",\\\"cardBrand\\\":\\\"VISA\\\"}\"
  }"
```

**Expected Result:**

- ✅ Payment status: `COMPLETED`
- ✅ Reservation status: `CONFIRMED`
- ✅ Seats status: `RESERVED`
- ✅ Ticket generated (status: `GENERATED`)

#### Step 6: Verify Saga Execution

```bash
# Check saga execution in database
psql -h localhost -U postgres -d payment_db -c "
  SELECT
    id,
    saga_type,
    status,
    started_at,
    completed_at
  FROM saga_executions
  ORDER BY created_at DESC
  LIMIT 1;
"

# Check saga steps
psql -h localhost -U postgres -d payment_db -c "
  SELECT
    step_name,
    step_order,
    status,
    started_at,
    completed_at
  FROM saga_steps
  WHERE saga_execution_id = (
    SELECT id FROM saga_executions ORDER BY created_at DESC LIMIT 1
  )
  ORDER BY step_order;
"
```

**Expected Database State:**

```sql
-- saga_executions
status: "COMPLETED"
completed_at: <timestamp>

-- saga_steps (4 rows)
step_1 (CHARGE_PAYMENT): status = "COMPLETED"
step_2 (CONFIRM_RESERVATION): status = "COMPLETED"
step_3 (CONFIRM_SEATS): status = "COMPLETED"
step_4 (GENERATE_TICKET): status = "COMPLETED"
```

#### Step 7: Verify Final State

```bash
# Check payment
curl http://localhost:3000/api/payments/${PAYMENT_ID} \
  -H "Authorization: Bearer ${TOKEN}"

# Check reservation
curl http://localhost:3000/api/reservations/${RESERVATION_ID} \
  -H "Authorization: Bearer ${TOKEN}"

# Check seats
curl -X POST http://localhost:3000/api/seats/by-ids \
  -H "Content-Type: application/json" \
  -d "{
    \"eventId\": \"${EVENT_ID}\",
    \"seatIds\": [\"${SEAT_ID_1}\", \"${SEAT_ID_2}\"]
  }"

# Check ticket
curl http://localhost:3000/api/tickets/reservation/${RESERVATION_ID} \
  -H "Authorization: Bearer ${TOKEN}"
```

**Expected Final State:**

- ✅ Payment: `COMPLETED`
- ✅ Reservation: `CONFIRMED`
- ✅ Seats: `RESERVED` (status), `reservationId = null`, `lockedBy = null`
- ✅ Ticket: `GENERATED` with PDF URL

**Note:** After confirmation, seats have:

- `status = RESERVED`
- `reservationId = null` (cleared after confirmation)
- `lockedBy = null` (cleared after confirmation)

---

### Test Scenario 2: Failure at Step 1 (Charge Payment) ❌

**Goal:** Verify saga fails early and no compensation is needed.

#### Setup

1. **Lock seats** (Step 2 from Scenario 1) ⚠️ **REQUIRED**
2. **Create reservation** (Step 3 from Scenario 1)
3. **Initiate payment** (Step 4 from Scenario 1)

#### Simulate Failure

**Option A: Payment Already Completed (Idempotency Test)**

```bash
# First confirmation (should succeed)
curl -X POST http://localhost:3000/api/payments/confirm \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"paymentId\": \"${PAYMENT_ID}\",
    \"transactionId\": \"txn-1\"
  }"

# Second confirmation (should be idempotent)
curl -X POST http://localhost:3000/api/payments/confirm \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"paymentId\": \"${PAYMENT_ID}\",
    \"transactionId\": \"txn-2\"
  }"
```

**Expected Result:**

- ✅ Second call should succeed (idempotent)
- ✅ No duplicate operations

**Option B: Invalid Payment Status**

```bash
# Manually set payment to CANCELLED in database
psql -h localhost -U postgres -d payment_db -c "
  UPDATE payments SET status = 'CANCELLED' WHERE id = '${PAYMENT_ID}';
"

# Try to confirm
curl -X POST http://localhost:3000/api/payments/confirm \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"paymentId\": \"${PAYMENT_ID}\",
    \"transactionId\": \"txn-fail\"
  }"
```

**Expected Result:**

- ❌ Error: "Payment cannot be confirmed. Current status: CANCELLED"
- ✅ Saga status: `FAILED`
- ✅ No compensation needed (nothing completed)

---

### Test Scenario 3: Failure at Step 2 (Confirm Reservation) ❌

**Goal:** Verify compensation triggers for Step 1 (refund payment).

#### Setup

1. Create reservation
2. Initiate payment
3. **Stop Reservation Service** (to simulate failure)

```bash
# Stop Reservation Service
# In terminal where Reservation Service is running, press Ctrl+C
```

#### Execute Payment Confirmation

```bash
# Confirm payment (will fail at Step 2)
curl -X POST http://localhost:3000/api/payments/confirm \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"paymentId\": \"${PAYMENT_ID}\",
    \"transactionId\": \"txn-$(date +%s)\"
  }"
```

**Expected Result:**

- ❌ Error: "Failed to confirm reservation" or timeout
- ✅ Saga status: `COMPENSATED`
- ✅ Payment status: `REFUNDED` (compensated)

#### Verify Compensation

```bash
# Check payment status
curl http://localhost:3000/api/payments/${PAYMENT_ID} \
  -H "Authorization: Bearer ${TOKEN}"

# Check saga execution
psql -h localhost -U postgres -d payment_db -c "
  SELECT
    id,
    status,
    error_message,
    compensated_at
  FROM saga_executions
  ORDER BY created_at DESC
  LIMIT 1;
"

# Check saga steps
psql -h localhost -U postgres -d payment_db -c "
  SELECT
    step_name,
    step_order,
    status,
    compensated_at
  FROM saga_steps
  WHERE saga_execution_id = (
    SELECT id FROM saga_executions ORDER BY created_at DESC LIMIT 1
  )
  ORDER BY step_order;
"
```

**Expected Database State:**

```sql
-- saga_executions
status: "COMPENSATED"
compensated_at: <timestamp>
error_message: "Request failed with status code..."

-- saga_steps
step_1 (CHARGE_PAYMENT): status = "COMPENSATED"
step_2 (CONFIRM_RESERVATION): status = "FAILED"
step_3: status = "PENDING" (never executed)
step_4: status = "PENDING" (never executed)
```

---

### Test Scenario 4: Failure at Step 3 (Confirm Seats) ❌

**Goal:** Verify compensation triggers for Steps 2 and 1 (cancel reservation + refund payment).

#### Setup

1. **Lock seats** (Step 2 from Scenario 1) ⚠️ **REQUIRED**
2. **Create reservation** (Step 3 from Scenario 1)
3. **Initiate payment** (Step 4 from Scenario 1)
4. **Stop Seat Service** (to simulate failure)

```bash
# Stop Seat Service
# In terminal where Seat Service is running, press Ctrl+C
```

#### Execute Payment Confirmation

```bash
# Confirm payment (will fail at Step 3)
curl -X POST http://localhost:3000/api/payments/confirm \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"paymentId\": \"${PAYMENT_ID}\",
    \"transactionId\": \"txn-$(date +%s)\"
  }"
```

**Expected Result:**

- ❌ Error: "Failed to confirm seats" or timeout
- ✅ Saga status: `COMPENSATED`
- ✅ Reservation status: `CANCELLED` (compensated)
- ✅ Payment status: `REFUNDED` (compensated)
- ✅ Seats status: `AVAILABLE` (released, `reservationId = null`)

#### Verify Compensation

**Note:** Compensation now queries seats by `reservationId` field for precise targeting. This ensures only the specific reservation's seats are released, even if the user has multiple pending reservations.

```bash
# Check payment
curl http://localhost:3000/api/payments/${PAYMENT_ID} \
  -H "Authorization: Bearer ${TOKEN}"

# Check reservation
curl http://localhost:3000/api/reservations/${RESERVATION_ID} \
  -H "Authorization: Bearer ${TOKEN}"

# Check seats
curl -X POST http://localhost:3000/api/seats/by-ids \
  -H "Content-Type: application/json" \
  -d "{
    \"eventId\": \"${EVENT_ID}\",
    \"seatIds\": [\"${SEAT_ID_1}\", \"${SEAT_ID_2}\"]
  }"

# Check saga steps
psql -h localhost -U postgres -d payment_db -c "
  SELECT
    step_name,
    step_order,
    status,
    compensated_at
  FROM saga_steps
  WHERE saga_execution_id = (
    SELECT id FROM saga_executions ORDER BY created_at DESC LIMIT 1
  )
  ORDER BY step_order;
"
```

**Expected Database State:**

```sql
-- saga_executions
status: "COMPENSATED"

-- saga_steps
step_1 (CHARGE_PAYMENT): status = "COMPENSATED"
step_2 (CONFIRM_RESERVATION): status = "COMPENSATED"
step_3 (CONFIRM_SEATS): status = "FAILED"
step_4: status = "PENDING" (never executed)
```

---

### Test Scenario 5: Failure at Step 4 (Generate Ticket) ❌

**Goal:** Verify compensation triggers for Steps 3, 2, and 1.

#### Setup

1. **Lock seats** (Step 2 from Scenario 1) ⚠️ **REQUIRED**
2. **Create reservation** (Step 3 from Scenario 1)
3. **Initiate payment** (Step 4 from Scenario 1)
4. **Stop Ticket Service** (to simulate failure)

```bash
# Stop Ticket Service
# In terminal where Ticket Service is running, press Ctrl+C
```

#### Execute Payment Confirmation

```bash
# Confirm payment (will fail at Step 4)
curl -X POST http://localhost:3000/api/payments/confirm \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"paymentId\": \"${PAYMENT_ID}\",
    \"transactionId\": \"txn-$(date +%s)\"
  }"
```

**Expected Result:**

- ❌ Error: "Failed to generate ticket" or timeout
- ✅ Saga status: `COMPENSATED`
- ✅ Seats status: `AVAILABLE` (released, `reservationId = null`)
- ✅ Reservation status: `CANCELLED` (compensated)
- ✅ Payment status: `REFUNDED` (compensated)

#### Verify Compensation

**Note:** Compensation queries seats by `reservationId` to release only this reservation's seats.

```bash
# Check all entities
curl http://localhost:3000/api/payments/${PAYMENT_ID} \
  -H "Authorization: Bearer ${TOKEN}"

curl http://localhost:3000/api/reservations/${RESERVATION_ID} \
  -H "Authorization: Bearer ${TOKEN}"

curl -X POST http://localhost:3000/api/seats/by-ids \
  -H "Content-Type: application/json" \
  -d "{
    \"eventId\": \"${EVENT_ID}\",
    \"seatIds\": [\"${SEAT_ID_1}\", \"${SEAT_ID_2}\"]
  }"
```

**Expected Database State:**

```sql
-- saga_steps
step_1: status = "COMPENSATED"
step_2: status = "COMPENSATED"
step_3: status = "COMPENSATED"
step_4: status = "FAILED"
```

---

### Test Scenario 6: Retry Logic ✅

**Goal:** Verify retry logic works for transient failures.

#### Setup

1. **Lock seats** (Step 2 from Scenario 1) ⚠️ **REQUIRED**
2. **Create reservation** (Step 3 from Scenario 1)
3. **Initiate payment** (Step 4 from Scenario 1)
4. **Temporarily stop Reservation Service** (to simulate transient failure)

#### Execute Payment Confirmation

```bash
# Confirm payment (will retry)
curl -X POST http://localhost:3000/api/payments/confirm \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"paymentId\": \"${PAYMENT_ID}\",
    \"transactionId\": \"txn-$(date +%s)\"
  }"

# While request is processing, restart Reservation Service
# (within 1-2 seconds)
```

**Expected Result:**

- ✅ Retry after 1s delay
- ✅ Retry after 2s delay
- ✅ Retry after 4s delay
- ✅ If service is back up, should succeed
- ✅ Check logs for retry attempts

#### Verify Retry Count

```bash
# Check saga steps for retry count
psql -h localhost -U postgres -d payment_db -c "
  SELECT
    step_name,
    step_order,
    status,
    retry_count,
    error_message
  FROM saga_steps
  WHERE saga_execution_id = (
    SELECT id FROM saga_executions ORDER BY created_at DESC LIMIT 1
  )
  ORDER BY step_order;
"
```

**Expected:**

- ✅ `retry_count` > 0 for failed step
- ✅ Step eventually succeeds or fails after max retries

---

### Test Scenario 7: Compensation Endpoints (Direct Testing)

**Goal:** Test compensation endpoints directly (for manual recovery).

#### Test 1: Cancel Reservation (Compensation)

```bash
# First, create and confirm a reservation
# Then test compensation endpoint

curl -X POST http://localhost:3000/api/reservations/${RESERVATION_ID}/cancel \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json"
```

**Expected Result:**

- ✅ Reservation status: `CANCELLED`
- ✅ Seats released (status: `AVAILABLE`)

#### Test 2: Release Seats (Compensation)

```bash
# First, lock some seats
# Then test compensation endpoint

curl -X POST http://localhost:3000/api/seats/release-compensation \
  -H "Content-Type: application/json" \
  -d "{
    \"eventId\": \"${EVENT_ID}\",
    \"ownerId\": \"${RESERVATION_ID}\",
    \"seatIds\": [\"${SEAT_ID_1}\", \"${SEAT_ID_2}\"]
  }"
```

**Expected Result:**

- ✅ Seats status: `AVAILABLE`
- ✅ Redis locks released

#### Test 3: Delete Ticket (Compensation)

```bash
# First, generate a ticket
# Then test compensation endpoint

curl -X DELETE http://localhost:3000/api/tickets/${TICKET_ID}/compensate \
  -H "Authorization: Bearer ${TOKEN}"
```

**Expected Result:**

- ✅ Ticket deleted from database
- ✅ PDF deleted from S3 (if exists)

---

### Test Checklist

#### Happy Flow ✅

- [ ] All 4 steps execute successfully
- [ ] Payment status: `COMPLETED`
- [ ] Reservation status: `CONFIRMED`
- [ ] Seats status: `RESERVED`
- [ ] Ticket generated with PDF
- [ ] **Notification sent automatically** ✅
- [ ] **Email delivered to user** ✅
- [ ] Saga status: `COMPLETED`
- [ ] All steps status: `COMPLETED`

#### Failure Scenarios ❌

- [ ] Failure at Step 1: No compensation needed
- [ ] Failure at Step 2: Payment refunded
- [ ] Failure at Step 3: Reservation cancelled + Payment refunded
- [ ] Failure at Step 4: Seats released + Reservation cancelled + Payment refunded

#### Compensation Verification ✅

- [ ] Compensation executes in reverse order
- [ ] Database state is consistent after compensation
- [ ] All completed steps are compensated
- [ ] Failed step is not compensated (never completed)

#### Retry Logic ✅

- [ ] Retries on 5xx errors
- [ ] Retries on network errors
- [ ] No retries on 4xx errors
- [ ] Exponential backoff works (1s, 2s, 4s)
- [ ] Max retries respected (3 retries)

#### Idempotency ✅

- [ ] Re-running same saga is safe
- [ ] Completed steps are skipped
- [ ] No duplicate operations

#### Compensation Endpoints ✅

- [ ] `POST /api/reservations/{id}/cancel` works
- [ ] `POST /api/seats/release-compensation` works
- [ ] `DELETE /api/tickets/{id}/compensate` works

---

## Next Steps

After manual testing:

1. ✅ Verify all endpoints work
2. ✅ Test complete booking flow
3. ✅ Test error scenarios
4. ✅ Test saga happy flow
5. ✅ Test saga failure flows
6. ✅ Test compensation endpoints
7. ✅ Test frontend integration
8. ✅ Document any issues found
9. ✅ Fix any bugs discovered
10. ✅ Proceed to automated testing

---

**Last Updated:** December 3, 2025  
**Status:** Ready for Manual Testing (Saga Pattern Included)
