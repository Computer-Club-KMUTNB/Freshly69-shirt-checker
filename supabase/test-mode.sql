-- Test mode (/test page) — run once in Supabase → SQL Editor. Safe to re-run.
-- Completely separate from the real data: the app's test APIs only touch these two tables,
-- never students / distributions / logs. Clear them any time from the /test page.

create table if not exists test_cases (
  id              bigint generated always as identity primary key,
  student_id      text        not null unique,   -- e.g. a staff member's own (year 3) card
  title           text,
  full_name       text        not null,
  faculty         text        not null,           -- faculty this test student belongs to
  size            text        not null,
  year            int         not null default 1 check (year between 1 and 8),  -- only year 1 may receive
  problem         text        not null default 'none'
                  check (problem in ('none', 'dup_same', 'dup_size', 'dup_person', 'received')),
  second_name     text,                           -- dup_person: the other person on the same id
  second_size     text,                           -- dup_size / dup_person: size in the 2nd response
  second_faculty  text,                           -- dup_same / dup_person: faculty form of the 2nd response
  auto            boolean     not null default false,  -- created by "สร้างอัตโนมัติ"
  created_at      timestamptz not null default now()
);

create table if not exists test_distributions (
  id           bigint generated always as identity primary key,
  student_id   text        not null,
  row_key      int         not null default 1,     -- 1 = main response, 2 = second response
  size         text        not null,
  faculty      text        not null,
  device_id    text,
  device_name  text,
  created_at   timestamptz not null default now(),
  voided_at    timestamptz
);
create unique index if not exists test_distributions_one_active
  on test_distributions (student_id) where voided_at is null;

alter table test_cases         enable row level security;
alter table test_distributions enable row level security;

-- service_role needs explicit grants on newer Supabase projects (see schema.sql)
grant select, insert, update, delete on test_cases, test_distributions to service_role;
grant usage, select on all sequences in schema public to service_role;
