-- Migration: Make user ratings internal-only (developer only)
-- 1. Revoke get_user_average_rating from authenticated users (internal/developer use only)
-- 2. Add suspended and flagged_for_investigation to profiles
-- 3. Trigger: when a user has 3+ ratings and avg <= 3, flag and suspend

-- Revoke RPC from regular users - developer uses service role to query
-- (Only runs if create_user_ratings.sql has been applied first)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'get_user_average_rating'
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION get_user_average_rating(UUID) FROM authenticated';
  END IF;
END $$;

-- Add suspension/flag columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS suspended BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS flagged_for_investigation BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT;

COMMENT ON COLUMN profiles.suspended IS 'Account suspended - user cannot use the app';
COMMENT ON COLUMN profiles.flagged_for_investigation IS 'Flagged due to low ratings (avg <= 3 after 3+ lunches)';

-- Helper: check if user meets suspension threshold (3+ ratings, avg <= 3)
CREATE OR REPLACE FUNCTION check_single_user(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_avg NUMERIC;
  v_count BIGINT;
BEGIN
  SELECT COUNT(*), ROUND(AVG(rating)::numeric, 2)
  INTO v_count, v_avg
  FROM user_ratings
  WHERE rated_id = p_user_id;

  IF v_count >= 3 AND v_avg <= 3 THEN
    UPDATE profiles
    SET
      suspended = TRUE,
      flagged_for_investigation = TRUE,
      suspended_at = NOW(),
      suspended_reason = 'Average rating ' || v_avg || ' after ' || v_count || ' lunch ratings (threshold: 3 or below after 3+ lunches)'
    WHERE id = p_user_id;
  END IF;
END;
$$;

-- Simpler trigger: on each insert/update, check the rated_id
CREATE OR REPLACE FUNCTION trg_check_user_rating_threshold()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM check_single_user(NEW.rated_id);
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM check_single_user(NEW.rated_id);
    IF OLD.rated_id IS DISTINCT FROM NEW.rated_id THEN
      PERFORM check_single_user(OLD.rated_id);
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_user_ratings_check_threshold ON user_ratings;
CREATE TRIGGER trg_user_ratings_check_threshold
  AFTER INSERT OR UPDATE ON user_ratings
  FOR EACH ROW
  EXECUTE FUNCTION trg_check_user_rating_threshold();
