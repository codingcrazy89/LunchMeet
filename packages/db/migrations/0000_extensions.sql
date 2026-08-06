-- Extensions the schema depends on.
--
-- These were created by hand on the development database to unblock work, but
-- they are declared here so a fresh database reproduces that state. v1's
-- original sin was schema objects that existed in one database and in no
-- migration file; this is the first migration precisely so that cannot recur.
--
-- Production note: a non-superuser role cannot run CREATE EXTENSION. An
-- administrator must pre-create these, or this migration fails on first deploy.
-- ops/CATALOG.md records them as required infrastructure.

-- Case-insensitive text, so email uniqueness is not case-sensitive.
CREATE EXTENSION IF NOT EXISTS citext;

-- Trigram matching for fuzzy name and restaurant search.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- cube is a prerequisite of earthdistance; together they provide indexed
-- great-circle distance for nearby-lunch search, replacing PostGIS.
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

-- Available for hashing needs. Primary keys use the built-in gen_random_uuid().
CREATE EXTENSION IF NOT EXISTS pgcrypto;
