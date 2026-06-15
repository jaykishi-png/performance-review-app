-- Migration: Meeting Recordings + Transcription
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/vlyevvangoeoxblnetvh/sql

CREATE TABLE IF NOT EXISTS meeting_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  meeting_date date NOT NULL,
  year integer NOT NULL,
  quarter integer,
  -- Consent tracking
  consent_manager boolean DEFAULT false,
  consent_employee boolean DEFAULT false,
  consent_manager_at timestamptz,
  consent_employee_at timestamptz,
  consent_manager_token uuid DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  consent_employee_token uuid DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  consent_declined boolean DEFAULT false,
  declined_by text,
  -- Recording
  recording_url text,
  recording_filename text,
  duration_seconds integer,
  -- Transcription
  transcript text,
  transcript_status text DEFAULT 'pending' CHECK (transcript_status IN ('pending','processing','complete','failed')),
  -- AI Summary
  summary text,
  key_topics jsonb DEFAULT '[]',
  action_items jsonb DEFAULT '[]',
  sentiment text,
  -- Status
  status text DEFAULT 'pending_consent' CHECK (status IN ('pending_consent','consented','recorded','processing','complete','declined')),
  note_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mr_manager ON meeting_recordings(manager_id);
CREATE INDEX IF NOT EXISTS idx_mr_employee ON meeting_recordings(employee_id);
CREATE INDEX IF NOT EXISTS idx_mr_mgr_token ON meeting_recordings(consent_manager_token);
CREATE INDEX IF NOT EXISTS idx_mr_emp_token ON meeting_recordings(consent_employee_token);
