-- Migration: Update suspension logic to require 3 distinct lunch meets (not just 3 ratings)
-- If average rating < 3 after user has been rated in 3+ different lunches, suspend and flag

CREATE OR REPLACE FUNCTION check_single_user(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_avg NUMERIC;
  v_lunch_count BIGINT;
BEGIN
  -- Count distinct lunches where this user was rated, and their average rating
  SELECT COUNT(DISTINCT lunch_id), ROUND(AVG(rating)::numeric, 2)
  INTO v_lunch_count, v_avg
  FROM user_ratings
  WHERE rated_id = p_user_id;

  -- Suspend if: 3+ lunch meets completed (rated in) AND average <= 3
  IF v_lunch_count >= 3 AND v_avg <= 3 THEN
    UPDATE profiles
    SET
      suspended = TRUE,
      flagged_for_investigation = TRUE,
      suspended_at = NOW(),
      suspended_reason = 'Average rating ' || v_avg || ' after ' || v_lunch_count || ' lunch meets (threshold: 3 or below after 3+ lunches)'
    WHERE id = p_user_id;
  END IF;
END;
$$;
