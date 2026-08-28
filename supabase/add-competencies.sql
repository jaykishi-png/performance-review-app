-- Admin-managed competencies, used by the employee self-assessment and the
-- manager performance review dropdowns.
--
-- Seeded with the 39 competencies that were previously hardcoded in both
-- portals. Reviews store the competency name as text, so editing or removing a
-- row here changes what is selectable going forward and never alters a review
-- that has already been written.

CREATE TABLE IF NOT EXISTS competencies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  definition  text NOT NULL DEFAULT '',
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_competencies_active_sort
  ON competencies (is_active, sort_order, name);

-- Seed. ON CONFLICT DO NOTHING keeps this re-runnable and never overwrites an
-- edit an admin has already made to a seeded row.
INSERT INTO competencies (sort_order, name, definition) VALUES
  (10, 'Accountability and Dependability', 'Takes personal responsibility for the quality and timeliness of work; achieves qualitative results with little oversight.'),
  (20, 'Adaptability and Flexibility', 'Adapts to changing business needs, conditions, and work responsibilities; works with a variety of situations, individuals, groups, and varying types of work.'),
  (30, 'Analysis/Reasoning', 'Examines data to comprehend and grasp issues, draw conclusions, and solve problems.'),
  (40, 'Attention to Detail', 'Diligently attends to details and pursues quality in accomplishing tasks.'),
  (50, 'Business Alignment', 'Work performed and produced aligns with the direction, products, services, and performance of the business with the rest of the organizational objectives.'),
  (60, 'Coaching and Mentoring', 'Enables colleagues to grow and succeed through feedback, instruction, and encouragement.'),
  (70, 'Communication', 'Listens to others and communicates in an effective manner.'),
  (80, 'Confidence', 'Matured and justified self-belief in one''s ability to do the job in a successful and productive manner.'),
  (90, 'Creative and Innovative Thinking', 'Develops fresh ideas that provide solutions to all types of workplace challenges.'),
  (100, 'Customer Focused', 'Builds and maintains customer satisfaction with the products offered by the organization and provides excellent customer service to internal and external customers.'),
  (110, 'Decision Making and Judgement', 'Makes timely, informed decisions that take into account the facts, goals, constraints, and risks.'),
  (120, 'Developing Others', 'Willingness to delegate responsibility when applicable, work with others, and coach to develop others'' capabilities.'),
  (130, 'Development and Continuous Learning', 'Displays an ongoing commitment to learning and self-improvement; has the desire and makes the effort to acquire new knowledge or skills for work.'),
  (140, 'Empowering Others', 'Conveying confidence in employees'' ability to be successful and autonomous, especially with new and challenging tasks; allowing employees the freedom to do their job independently.'),
  (150, 'Ethics and Integrity', 'Earns others'' trust and respect through consistent honesty and professionalism in all interactions.'),
  (160, 'Flexibility', 'Adapting to and working with a variety of situations, individuals, and groups. Openness to different and new ways of doing things; willingness to modify one''s preferred way of doing things.'),
  (170, 'Group Facilitation', 'Enables and encourages cooperative and productive group interactions.'),
  (180, 'Influencing Others', 'Influences others to be excited and committed to furthering the organization objectives; ability to gain others'' support for ideas, proposals, and solutions.'),
  (190, 'Initiative', 'Recognizes situations that warrant initiative and moves forward without hesitation; reasonably resolves issues, problems, or situations.'),
  (200, 'Interpersonal Skills', 'Gets along and interacts positively with colleagues and others; understands and relates to others.'),
  (210, 'Leadership', 'Promotes organizational mission and goals, and shows ways to achieve them.'),
  (220, 'Listening', 'Comprehends, understands, and learns from what others say.'),
  (230, 'Planning and Organizing', 'Defining tasks and milestones to achieve objectives while ensuring the optimal use of resources to achieve those objectives.'),
  (240, 'Policy, Rules, and Regulation Enforcement', 'Enforces policies, rules, and regulations consistently and in a way that is and is perceived as fair, objective, and reasonable.'),
  (250, 'Problem-Solving', 'Resolves difficult or complicated challenges.'),
  (260, 'Project Management', 'Structures and directs others'' work on projects or programs; ensures timeliness of project completion and meets project objectives and deadlines.'),
  (270, 'Reading Comprehension', 'Grasps the meaning of written information and applies it to work situations.'),
  (280, 'Relationship Building', 'Builds constructive working relationships characterized by a high level of acceptance, cooperation, and mutual respect.'),
  (290, 'Researching Information', 'Identifies, collects, and organizes data for analyzing and decision-making.'),
  (300, 'Results Focused', 'Focuses on results and desired outcomes and how best to achieve them in order to get the job done.'),
  (310, 'Risk Management', 'Identifying, assessing, and managing risk while striving to attain objectives.'),
  (320, 'Speaking', 'Conveys ideas and facts orally pertinent and relevant to the audience and in a way the audience can understand.'),
  (330, 'Staff Management', 'Manages staff in ways that improve their ability to succeed on the job in an autonomous manner.'),
  (340, 'Strategic Vision', 'Sees the big, long-range picture.'),
  (350, 'Stress Tolerance', 'Maintains composure in highly stressful or adverse situations.'),
  (360, 'Tact', 'Diplomatically handles challenges or tense interpersonal situations.'),
  (370, 'Teamwork', 'Promotes cooperation and commitment within a team to achieve goals and deliverables.'),
  (380, 'Training and Presenting Information', 'Formally, effectively, and thoughtfully delivers information to a group.'),
  (390, 'Writing', 'Conveys ideas and facts in writing using language the reader and audience will best understand.')
ON CONFLICT (name) DO NOTHING;
