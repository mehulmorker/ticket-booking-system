-- ⚠️ DEPRECATED: This SQL script is deprecated and will be removed in a future version.
-- Use TypeORM migrations instead: cd backend/services/payment-service && npm run migration:run
--
-- Migration: Create Saga Pattern Tables
-- Date: December 3, 2025
-- Description: Creates tables for saga execution and step tracking
--
-- Legacy script - kept for backward compatibility only.
-- New developers should use TypeORM migrations.

BEGIN;

-- Create saga_executions table
CREATE TABLE IF NOT EXISTS saga_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  saga_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'COMPENSATING', 'COMPENSATED', 'FAILED')),
  payload JSONB NOT NULL,
  result JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  compensated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for saga_executions
CREATE INDEX IF NOT EXISTS idx_saga_executions_type_status ON saga_executions(saga_type, status);
CREATE INDEX IF NOT EXISTS idx_saga_executions_status_created ON saga_executions(status, created_at);
CREATE INDEX IF NOT EXISTS idx_saga_executions_started_at ON saga_executions(started_at);

-- Create saga_steps table
CREATE TABLE IF NOT EXISTS saga_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  saga_execution_id UUID NOT NULL REFERENCES saga_executions(id) ON DELETE CASCADE,
  step_name VARCHAR(100) NOT NULL,
  step_order INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'EXECUTING', 'COMPLETED', 'FAILED', 'COMPENSATING', 'COMPENSATED')),
  request_payload JSONB,
  response_payload JSONB,
  error_message TEXT,
  compensation_payload JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  compensated_at TIMESTAMPTZ,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(saga_execution_id, step_order)
);

-- Create indexes for saga_steps
CREATE INDEX IF NOT EXISTS idx_saga_steps_execution_order ON saga_steps(saga_execution_id, step_order);
CREATE INDEX IF NOT EXISTS idx_saga_steps_status ON saga_steps(status);
CREATE INDEX IF NOT EXISTS idx_saga_steps_created_at ON saga_steps(created_at);

COMMIT;

