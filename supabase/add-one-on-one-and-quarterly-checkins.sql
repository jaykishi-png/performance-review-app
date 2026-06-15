-- Migration: Add one_on_one_notes and quarterly_checkins tables
-- Run this in the Supabase SQL Editor: https://supabase.com/dashboard/project/vlyevvangoeoxblnetvh/sql

CREATE TABLE IF NOT EXISTS one_on_one_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  meeting_date date NOT NULL,
  note text NOT NULL DEFAULT '',
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_oon_manager ON one_on_one_notes(manager_id);
CREATE INDEX IF NOT EXISTS idx_oon_employee ON one_on_one_notes(employee_id);

CREATE TABLE IF NOT EXISTS quarterly_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  manager_id uuid NOT NULL,
  year integer NOT NULL,
  quarter integer NOT NULL CHECK (quarter BETWEEN 1 AND 3),
  manager_pulse_rating integer CHECK (manager_pulse_rating BETWEEN 1 AND 5),
  manager_goal_progress jsonb DEFAULT '[]',
  manager_written_update text DEFAULT '',
  manager_submitted_at timestamptz,
  employee_pulse_rating integer CHECK (employee_pulse_rating BETWEEN 1 AND 5),
  employee_goal_progress jsonb DEFAULT '[]',
  employee_written_update text DEFAULT '',
  employee_submitted_at timestamptz,
  status text DEFAULT 'draft',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(employee_id, year, quarter)
);
CREATE INDEX IF NOT EXISTS idx_qc_employee ON quarterly_checkins(employee_id);
CREATE INDEX IF NOT EXISTS idx_qc_manager ON quarterly_checkins(manager_id);
