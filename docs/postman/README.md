# Postman Collection for Ticket Booking API

This directory contains Postman collections and environments for testing the Ticket Booking Microservices API.

## Files

- `Ticket-Booking-API.postman_collection.json` - Complete API collection ✅ Created
- `Local.postman_environment.json` - Local development environment variables

## Setup

1. **Import Collection:**

   - Open Postman
   - Click "Import"
   - Select `Ticket-Booking-API.postman_collection.json`

2. **Import Environment:**

   - Click "Import"
   - Select `Local.postman_environment.json`
   - Select "Local" environment in dropdown

3. **Start Services:**
   - Ensure all backend services are running
   - Ensure API Gateway is running on port 3000

## Usage

1. **Register/Login:**

   - Run "Register User" or "Login" request
   - Token will be automatically saved to `auth_token` variable

2. **Use Token:**

   - All protected requests automatically use `auth_token`
   - No need to manually add Authorization header

3. **Save IDs:**
   - After creating resources, IDs are saved to environment variables
   - Use these variables in subsequent requests

## Collection Structure

- **Auth** - Authentication endpoints (includes service-to-service endpoint)
- **Events** - Event and venue management
- **Seats** - Seat availability and locking
- **Reservations** - Reservation management
- **Payments** - Payment processing
- **Tickets** - Ticket generation and retrieval
- **Notifications** - Notification management

## Collection Features

- **Automatic Token Management:** Login/Register requests automatically save tokens to environment
- **ID Management:** Created resources (venues, events, seats, etc.) automatically save IDs
- **Bearer Authentication:** All protected routes use Bearer token from environment
- **Organized Structure:** Requests grouped by service for easy navigation
- **Test Scripts:** Automatic variable extraction from responses

## Collection Structure

- **Auth Service** - 7 endpoints (Register, Login, Profile, Refresh, Logout, Update Profile, Get User by ID - Service-to-Service)
- **Events** - 11 endpoints (Venue CRUD, Event CRUD, Search/Filter)
- **Seats** - 4 endpoints (Get Seats, Lock, Release, Extend Lock)
- **Reservations** - 5 endpoints (Create, Get, Extend, Cancel, Get User Reservations)
- **Payments** - 6 endpoints (Initiate, Process, Confirm, Get, Get by Reservation, Refund)
- **Tickets** - 4 endpoints (Generate, Get, Download URL, Verify QR)
- **Notifications** - 4 endpoints (Send, Get, Get Status, Get User Notifications)
- **Health Checks** - 6 endpoints (Gateway + all services)

**Total: 47 API endpoints**

### Service-to-Service Endpoint

**Get User by ID** (`GET /users/:id`) is a service-to-service endpoint that requires a service JWT token (not a regular user token). This endpoint is used internally by other services (e.g., ticket-service) to fetch user email for notifications.

**Note:** To test this endpoint in Postman, you need to:

1. Generate a service JWT token with payload: `{ type: 'service', serviceName: 'test-service' }`
2. Sign it with `JWT_SECRET`
3. Set it in the `service_jwt_token` environment variable

See `docs/SERVICE_TO_SERVICE_AUTH.md` for more details.

## Quick Start

1. Import collection and environment
2. Run "Register User" or "Login" to get token
3. Token is automatically saved - all protected requests will use it
4. Create resources in order: Venue → Event → Seats → Reservation → Payment
5. IDs are automatically saved for chained requests
