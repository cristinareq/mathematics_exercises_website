-- Complete database setup for production deployment
-- Run this in your Supabase SQL Editor

-- 1. Create users table
CREATE TABLE IF NOT EXISTS public.users (
  username text PRIMARY KEY,
  password text NOT NULL,
  is_teacher boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 2. Create classes table
CREATE TABLE IF NOT EXISTS public.classes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  created_by text NOT NULL REFERENCES public.users(username),
  created_at timestamptz DEFAULT now(),
  UNIQUE(name, created_by)
);

-- 3. Create class_members table
CREATE TABLE IF NOT EXISTS public.class_members (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  class_id bigint NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  username text NOT NULL REFERENCES public.users(username),
  created_at timestamptz DEFAULT now(),
  UNIQUE(class_id, username)
);

-- 4. Create homeworks table
CREATE TABLE IF NOT EXISTS public.homeworks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  operation text NOT NULL,
  number_type text DEFAULT 'Entiers positifs',
  number_type_a text DEFAULT 'Entiers positifs',
  number_type_b text DEFAULT 'Entiers positifs',
  range_min integer DEFAULT 1,
  range_max integer DEFAULT 10,
  range_min_b integer DEFAULT 1,
  range_max_b integer DEFAULT 10,
  comparison_type text DEFAULT 'any',
  duration integer NOT NULL,
  created_by text NOT NULL REFERENCES public.users(username),
  created_at timestamptz DEFAULT now()
);

-- 5. Create homework_assignments table
CREATE TABLE IF NOT EXISTS public.homework_assignments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  homework_id bigint NOT NULL REFERENCES public.homeworks(id) ON DELETE CASCADE,
  class_id bigint REFERENCES public.classes(id),
  username text REFERENCES public.users(username),
  created_by text NOT NULL REFERENCES public.users(username),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT homework_assignments_one_target CHECK (
    (class_id IS NOT NULL AND username IS NULL)
    OR (class_id IS NULL AND username IS NOT NULL)
  )
);

-- 6. Create homework_submissions table
CREATE TABLE IF NOT EXISTS public.homework_submissions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  homework_id bigint NOT NULL REFERENCES public.homeworks(id) ON DELETE CASCADE,
  username text NOT NULL REFERENCES public.users(username),
  timestamp timestamptz DEFAULT now(),
  readable_date text,
  correct integer NOT NULL,
  total integer NOT NULL,
  duration integer NOT NULL
);

-- 7. Create scores table
CREATE TABLE IF NOT EXISTS public.scores (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username text NOT NULL REFERENCES public.users(username),
  timestamp timestamptz DEFAULT now(),
  readable_date text,
  correct integer NOT NULL,
  total integer NOT NULL,
  duration integer NOT NULL,
  tables text,
  quiz_mode text DEFAULT 'training'
);

-- 8. Create errors table
CREATE TABLE IF NOT EXISTS public.errors (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username text NOT NULL REFERENCES public.users(username),
  timestamp timestamptz DEFAULT now(),
  readable_date text,
  question text,
  correct_answer integer,
  user_answer integer,
  correct_answer_text text,
  user_answer_text text,
  table_value integer,
  question_key text,
  number_type_a text,
  number_type_b text,
  comparison_type text,
  corrected boolean DEFAULT false,
  corrected_at timestamptz,
  correction_source text
);

-- 9. Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homeworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.errors ENABLE ROW LEVEL SECURITY;

-- 10. Create RLS policies
-- Users: everyone can read, no inserts (manual creation)
DROP POLICY IF EXISTS "users_select_all" ON public.users;
CREATE POLICY "users_select_all" ON public.users FOR SELECT USING (true);

-- Classes: teachers can manage their own classes
DROP POLICY IF EXISTS "classes_select_all" ON public.classes;
CREATE POLICY "classes_select_all" ON public.classes FOR SELECT USING (true);

DROP POLICY IF EXISTS "classes_insert_by_teachers" ON public.classes;
CREATE POLICY "classes_insert_by_teachers" ON public.classes
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.username = created_by AND u.is_teacher = true)
);

-- Class members: everyone can read, teachers can manage
DROP POLICY IF EXISTS "class_members_select_all" ON public.class_members;
CREATE POLICY "class_members_select_all" ON public.class_members FOR SELECT USING (true);

DROP POLICY IF EXISTS "class_members_insert_by_teachers" ON public.class_members;
CREATE POLICY "class_members_insert_by_teachers" ON public.class_members
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.classes c 
    JOIN public.users u ON u.username = c.created_by 
    WHERE c.id = class_id AND u.is_teacher = true
  )
);

-- Homeworks: everyone can read, teachers can create
DROP POLICY IF EXISTS "homeworks_select_all" ON public.homeworks;
CREATE POLICY "homeworks_select_all" ON public.homeworks FOR SELECT USING (true);

DROP POLICY IF EXISTS "homeworks_insert_by_teachers" ON public.homeworks;
CREATE POLICY "homeworks_insert_by_teachers" ON public.homeworks
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.username = created_by AND u.is_teacher = true)
);

-- Homework assignments: everyone can read, teachers can create
DROP POLICY IF EXISTS "homework_assignments_select_all" ON public.homework_assignments;
CREATE POLICY "homework_assignments_select_all" ON public.homework_assignments FOR SELECT USING (true);

DROP POLICY IF EXISTS "homework_assignments_insert_by_teachers" ON public.homework_assignments;
CREATE POLICY "homework_assignments_insert_by_teachers" ON public.homework_assignments
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.username = created_by AND u.is_teacher = true)
);

-- Homework submissions: everyone can read, users can insert their own
DROP POLICY IF EXISTS "homework_submissions_select_all" ON public.homework_submissions;
CREATE POLICY "homework_submissions_select_all" ON public.homework_submissions FOR SELECT USING (true);

DROP POLICY IF EXISTS "homework_submissions_insert_by_user" ON public.homework_submissions;
CREATE POLICY "homework_submissions_insert_by_user" ON public.homework_submissions
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.username = username)
);

-- Scores: everyone can read, users can insert their own
DROP POLICY IF EXISTS "scores_select_all" ON public.scores;
CREATE POLICY "scores_select_all" ON public.scores FOR SELECT USING (true);

DROP POLICY IF EXISTS "scores_insert_by_user" ON public.scores;
CREATE POLICY "scores_insert_by_user" ON public.scores
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.username = username)
);

-- Errors: everyone can read, users can insert/update their own
DROP POLICY IF EXISTS "errors_select_all" ON public.errors;
CREATE POLICY "errors_select_all" ON public.errors FOR SELECT USING (true);

DROP POLICY IF EXISTS "errors_insert_by_user" ON public.errors;
CREATE POLICY "errors_insert_by_user" ON public.errors
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.username = username)
);

DROP POLICY IF EXISTS "errors_update_by_user" ON public.errors;
CREATE POLICY "errors_update_by_user" ON public.errors
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.username = username)
);

-- 11. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_class_members_class_id ON public.class_members(class_id);
CREATE INDEX IF NOT EXISTS idx_class_members_username ON public.class_members(username);
CREATE INDEX IF NOT EXISTS idx_homework_assignments_homework_id ON public.homework_assignments(homework_id);
CREATE INDEX IF NOT EXISTS idx_homework_assignments_class_id ON public.homework_assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_homework_assignments_username ON public.homework_assignments(username);
CREATE INDEX IF NOT EXISTS idx_homework_submissions_homework_id ON public.homework_submissions(homework_id);
CREATE INDEX IF NOT EXISTS idx_homework_submissions_username ON public.homework_submissions(username);
CREATE INDEX IF NOT EXISTS idx_scores_username ON public.scores(username);
CREATE INDEX IF NOT EXISTS idx_scores_quiz_mode ON public.scores(quiz_mode);
CREATE INDEX IF NOT EXISTS idx_errors_username ON public.errors(username);
CREATE INDEX IF NOT EXISTS idx_errors_corrected ON public.errors(corrected);
CREATE INDEX IF NOT EXISTS idx_errors_question_key ON public.errors(question_key);
