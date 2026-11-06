-- OPTIONAL: run after creating your first teacher and student accounts.
-- Replace the email addresses and names before running.
update public.profiles
set role='teacher', full_name='Teacher Administrator'
where id=(select id from auth.users where email='teacher@example.com');

-- Link student sign-in to the corresponding student record:
update public.students
set profile_id=(select id from auth.users where email='student@example.com')
where student_no='STUDENT-001';
