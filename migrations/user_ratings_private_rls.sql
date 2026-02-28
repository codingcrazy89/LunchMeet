-- Migration: Make user ratings private - only the rater can read their own ratings
-- Ratings are never visible to the public or to the person being rated

-- Drop existing read policy
DROP POLICY IF EXISTS "Users can read ratings they gave or received" ON user_ratings;

-- New policy: users can only read ratings they gave (not ratings they received)
CREATE POLICY "Users can read only ratings they gave"
ON user_ratings FOR SELECT
USING (rater_id = auth.uid());
