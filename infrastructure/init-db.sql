-- ============================================
-- Ticket Booking Microservices Database Setup
-- ============================================
-- This script initializes all databases required for the microservices
-- Run automatically when PostgreSQL container starts for the first time
-- ============================================

-- Enable UUID extension (required for UUID primary keys)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Create Databases for Each Service
-- ============================================

-- Auth Service Database
CREATE DATABASE auth_db;

-- Event Service Database
CREATE DATABASE event_db;

-- Seat Service Database
CREATE DATABASE seat_db;

-- Reservation Service Database
CREATE DATABASE reservation_db;

-- Payment Service Database
CREATE DATABASE payment_db;

-- Ticket Service Database
CREATE DATABASE ticket_db;

-- Notification Service Database
CREATE DATABASE notification_db;

-- ============================================
-- Create Service Users (Optional - for production security)
-- ============================================
-- Uncomment and modify for production use

-- CREATE USER auth_user WITH PASSWORD 'auth_password';
-- CREATE USER event_user WITH PASSWORD 'event_password';
-- CREATE USER seat_user WITH PASSWORD 'seat_password';
-- CREATE USER reservation_user WITH PASSWORD 'reservation_password';
-- CREATE USER payment_user WITH PASSWORD 'payment_password';
-- CREATE USER ticket_user WITH PASSWORD 'ticket_password';
-- CREATE USER notification_user WITH PASSWORD 'notification_password';

-- ============================================
-- Grant Privileges (if using service users)
-- ============================================
-- GRANT ALL PRIVILEGES ON DATABASE auth_db TO auth_user;
-- GRANT ALL PRIVILEGES ON DATABASE event_db TO event_user;
-- GRANT ALL PRIVILEGES ON DATABASE seat_db TO seat_user;
-- GRANT ALL PRIVILEGES ON DATABASE reservation_db TO reservation_user;
-- GRANT ALL PRIVILEGES ON DATABASE payment_db TO payment_user;
-- GRANT ALL PRIVILEGES ON DATABASE ticket_db TO ticket_user;
-- GRANT ALL PRIVILEGES ON DATABASE notification_db TO notification_user;

-- ============================================
-- Connect to each database and enable UUID extension
-- ============================================

\c auth_db
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\c event_db
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\c seat_db
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\c reservation_db
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\c payment_db
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\c ticket_db
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\c notification_db
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Database Setup Complete
-- ============================================
-- All databases are ready for TypeORM migrations
-- Each service will create its own tables via migrations
-- ============================================

