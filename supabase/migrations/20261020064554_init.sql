-- Phase 1a: the first migration, empty on purpose. It proves the pipeline
-- (local, staging, prod) runs migrations from git. Tables start in Phase 1d.
-- Every database change from here on is a new file in this folder; nobody
-- changes tables from the Supabase dashboard.
select 1;
