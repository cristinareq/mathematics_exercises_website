-- Create demo users and data for testing
-- Run this after the main setup

-- Create demo teacher
INSERT INTO public.users (username, password, is_teacher) VALUES
('teacher1', 'demo123', true)
ON CONFLICT (username) DO NOTHING;

-- Create demo students
INSERT INTO public.users (username, password, is_teacher) VALUES
('alice', 'demo123', false),
('bob', 'demo123', false),
('charlie', 'demo123', false),
('diana', 'demo123', false),
('eric', 'demo123', false),
('franck', 'demo123', false)
ON CONFLICT (username) DO NOTHING;

-- Create demo classes
INSERT INTO public.classes (name, created_by) VALUES
('CM1 A', 'teacher1'),
('CM1 B', 'teacher1')
ON CONFLICT (name, created_by) DO NOTHING;

-- Add students to classes
INSERT INTO public.class_members (class_id, username)
SELECT c.id, u.username
FROM public.classes c
JOIN (VALUES ('alice'), ('bob'), ('charlie')) AS u(username) ON TRUE
WHERE c.name = 'CM1 A' AND c.created_by = 'teacher1'
ON CONFLICT (class_id, username) DO NOTHING;

INSERT INTO public.class_members (class_id, username)
SELECT c.id, u.username
FROM public.classes c
JOIN (VALUES ('diana'), ('eric'), ('franck')) AS u(username) ON TRUE
WHERE c.name = 'CM1 B' AND c.created_by = 'teacher1'
ON CONFLICT (class_id, username) DO NOTHING;

-- Verify setup
SELECT 'Demo users created:' as info;
SELECT username, is_teacher FROM public.users WHERE username IN ('teacher1', 'alice', 'bob', 'charlie', 'diana', 'eric', 'franck');

SELECT 'Demo classes created:' as info;
SELECT c.name, c.created_by, COUNT(cm.username) as student_count
FROM public.classes c
LEFT JOIN public.class_members cm ON c.id = cm.class_id
WHERE c.created_by = 'teacher1'
GROUP BY c.id, c.name, c.created_by;
