-- Student Performance Dashboard System database schema
-- Run this entire file in Supabase SQL Editor as project owner.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'student' check (role in ('teacher','student')),
  created_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  full_name text not null,
  email text,
  student_no text,
  grade_section text,
  created_at timestamptz not null default now()
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text not null,
  quarter integer not null default 1 check (quarter between 1 and 4),
  total_items integer not null default 20 check (total_items > 0),
  passing_percentage numeric(5,2) not null default 75 check (passing_percentage between 0 and 100),
  description text default '',
  created_at timestamptz not null default now()
);

create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  score numeric(8,2) not null check (score >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(student_id, activity_id)
);

create or replace function public.current_user_role()
returns text language sql stable security definer set search_path=public
as $$ select role from public.profiles where id=auth.uid() $$;

create or replace function public.is_teacher()
returns boolean language sql stable security definer set search_path=public
as $$ select coalesce(public.current_user_role()='teacher',false) $$;

-- Create a profile whenever an authenticated account is created.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  insert into public.profiles(id,full_name,role)
  values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''), 'student')
  on conflict(id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.activities enable row level security;
alter table public.scores enable row level security;

drop policy if exists "profiles read own or teacher" on public.profiles;
create policy "profiles read own or teacher" on public.profiles for select to authenticated
using (id=auth.uid() or public.is_teacher());
drop policy if exists "teacher update profiles" on public.profiles;
create policy "teacher update profiles" on public.profiles for update to authenticated
using (public.is_teacher()) with check (public.is_teacher());

drop policy if exists "students teacher all" on public.students;
create policy "students teacher all" on public.students for all to authenticated
using (public.is_teacher()) with check (public.is_teacher());
drop policy if exists "student read own student record" on public.students;
create policy "student read own student record" on public.students for select to authenticated
using (profile_id=auth.uid());

drop policy if exists "activities teacher all" on public.activities;
create policy "activities teacher all" on public.activities for all to authenticated
using (public.is_teacher()) with check (public.is_teacher());
drop policy if exists "students read activities" on public.activities;
create policy "students read activities" on public.activities for select to authenticated
using (public.current_user_role()='student');

drop policy if exists "scores teacher all" on public.scores;
create policy "scores teacher all" on public.scores for all to authenticated
using (public.is_teacher()) with check (public.is_teacher());
drop policy if exists "students read own scores" on public.scores;
create policy "students read own scores" on public.scores for select to authenticated
using (exists(select 1 from public.students s where s.id=scores.student_id and s.profile_id=auth.uid()));

-- Export all teacher-accessible data as one JSON object.
create or replace function public.export_las_backup()
returns jsonb language plpgsql security invoker set search_path=public
as $$
begin
  if not public.is_teacher() then raise exception 'Teacher access required'; end if;
  return jsonb_build_object(
    'exported_at',now(),
    'students',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.students x),
    'activities',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.activities x),
    'scores',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.scores x)
  );
end;
$$;
grant execute on function public.export_las_backup() to authenticated;

-- IMPORTANT: After your first teacher account signs up, promote it manually:
-- update public.profiles set role='teacher', full_name='Teacher Name'
-- where id=(select id from auth.users where email='teacher@example.com');
--
-- To link a student's login to a student record:
-- update public.students set profile_id=(select id from auth.users where email='student@example.com')
-- where student_no='STUDENT-NUMBER';

-- Multi-section and multi-subject support:
-- Student grade_section and activity subject are intentionally retained as
-- editable labels for easy class setup. These indexes make filtering/reporting
-- across multiple sections and subjects efficient as records grow.
create index if not exists students_grade_section_idx on public.students(grade_section);
create index if not exists activities_subject_quarter_idx on public.activities(subject, quarter);
create index if not exists scores_student_idx on public.scores(student_id);
create index if not exists scores_activity_idx on public.scores(activity_id);
