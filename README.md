# LAS Monitoring System

A responsive, cloud-connected Learning Activity Sheets monitoring application built with React, Vite, and Supabase.

## Features

- Teacher and individual student sign-in
- Teacher-managed student and LAS activity records (create, edit, delete)
- Configurable item count and passing percentage per activity
- Score entry with automatic percentage and PASS/FAIL calculation
- Teacher dashboard with enrollment, activity, score, and performance summaries
- Multiple sections and subjects under one teacher administrator
- Section filtering for student lists and score reports
- Subject filtering for activity lists and score reports
- Section enrollment and subject activity summaries
- Student dashboard with personal results
- CSV export, browser printing, and JSON backup
- Responsive layout for desktop, tablet, and mobile
- Cloud database and authentication; data is not stored only in the browser

## Technology

- Frontend: React + Vite
- Authentication/database: Supabase Auth + PostgreSQL
- Security: PostgreSQL Row Level Security (RLS)

## Setup

### 1. Create a Supabase project
Create a project at https://supabase.com. Keep the project URL and anon/public key available.

### 2. Create the database
In Supabase, open **SQL Editor**, paste all contents of `supabase/schema.sql`, and run it.

### 3. Create the teacher account
In Supabase **Authentication → Users**, create a teacher account (or use the app sign-up flow only if you add one). The current app intentionally has no public sign-up screen.

Then in SQL Editor, promote the teacher account. Replace the email and name:

```sql
update public.profiles
set role='teacher', full_name='Teacher Name'
where id=(select id from auth.users where email='teacher@example.com');
```

### 4. Configure the application
Copy `.env.example` to `.env` and fill in:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Use the project URL and anon/public key from **Project Settings → API**. Never put the `service_role` key in frontend code.

### 5. Run locally

```bash
npm install
npm run dev
```

Vite prints a local URL. This is for development/testing, not public multi-device access.

### 6. Publish online
Deploy the project to a static hosting provider such as Vercel or Netlify:
- Import the project repository.
- Build command: `npm run build`
- Output directory: `dist`
- Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as deployment environment variables.
- Deploy and open the hosted URL on any device.

The Supabase database remains online independently of the device or browser.

## Student account provisioning

For privacy and security, student accounts should be created by the teacher/administrator, not through unrestricted public registration.

Current starter workflow:
1. Create a student login in Supabase Authentication → Users.
2. Add the student's record in the teacher dashboard.
3. In Supabase SQL Editor, link the login to the student record:

```sql
update public.students
set profile_id=(select id from auth.users where email='student@example.com')
where student_no='STUDENT-001';
```

Provide each student with their own email/login and temporary password. Ask them to change the password after first login. A production deployment should add an administrator-only Edge Function for creating student accounts and a password-reset flow.

## Important notes before real classroom use

- The first teacher must be promoted manually using the SQL above.
- Student accounts must be linked to their student records for the student dashboard and own-score visibility.
- The starter application does not include a public self-registration page, bulk student import, or an admin account-creation interface.
- JSON backup downloads a snapshot; the live database itself remains in Supabase.
- Configure Supabase Auth password policies, email confirmation, backups, and access controls before storing real learner data.
- Test with dummy student accounts before entering actual student information.


## Multiple sections and subjects

One teacher administrator can create records across as many sections and subjects as needed. Enter each student's section in the **Grade & section** field (for example, Grade 7 – Sampaguita, Grade 7 – Rosal, Grade 8 – Narra). Enter each LAS subject in the **Subject** field (for example, English, Mathematics, Science, Filipino). The dashboard summarizes enrollment per section and LAS activities per subject. Student records, activities, and score reports can be filtered by section or subject. No separate teacher account is required for each class or subject.


### Class and subject performance comparison
The Scores & Reports page includes a class-and-subject comparison report. It groups recorded score entries by section and subject (for example, English, Mathematics, and Science) and displays the average score percentage, number of learners with scores, activities assessed, score entries, and pass rate. The report follows the active section and subject filters and can be exported as a separate CSV file. Averages are calculated from recorded score percentages, so activities with different item counts are normalized before comparison. Only submitted scores are included; unrecorded work is not treated as zero.

## Class and subject comparison report

The Scores & Reports screen includes a section comparison matrix: each section is a row and each subject with recorded results is a column. It shows subject averages, an overall average weighted by recorded score submissions, learners assessed, and score entries. A detailed table also shows activities assessed and pass rate for each section-subject pair. Both the comparison matrix and detailed report can be exported separately as CSV files. Report averages use each recorded score converted to a percentage, so activities with different item counts can be compared. Unrecorded activities are excluded; this is not a measure of completion for the whole class.
