-- Migration: PIP / Coaching Plans
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/vlyevvangoeoxblnetvh/sql

CREATE TABLE IF NOT EXISTS pip_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES profiles(id),
  employee_id uuid NOT NULL REFERENCES profiles(id),
  title text NOT NULL,
  reason text,
  start_date date NOT NULL,
  target_date date NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'escalated', 'withdrawn')),
  outcome text,
  milestones jsonb DEFAULT '[]',
  check_in_notes jsonb DEFAULT '[]',
  employee_acknowledged boolean DEFAULT false,
  employee_acknowledged_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pip_manager ON pip_plans(manager_id);
CREATE INDEX IF NOT EXISTS idx_pip_employee ON pip_plans(employee_id);
CREATE INDEX IF NOT EXISTS idx_pip_status ON pip_plans(status);
