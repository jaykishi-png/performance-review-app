-- Migration: Add scheduled meeting time to reviews
-- Run this in the Supabase SQL Editor.
--
-- meeting_confirmed_at records that a review meeting HAPPENED.
-- meeting_scheduled_at records when it is BOOKED FOR — the state the app
-- previously had no way to express.

alter table reviews
  add column if not exists meeting_scheduled_at timestamptz,
  add column if not exists meeting_location text;
