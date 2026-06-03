-- Employee Goals Tracker
CREATE TABLE IF NOT EXISTS employee_goals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  status text DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'complete')),
  target_date text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE employee_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employees_manage_own_goals" ON employee_goals
  FOR ALL USING (auth.uid() = employee_id);

-- Admins can read all goals
CREATE POLICY "admins_read_goals" ON employee_goals
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dev_admin'))
  );
