-- Migration: Create user_ratings table for 1-5 star ratings after lunch meets
-- Run this SQL in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS user_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rater_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rated_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lunch_id UUID NOT NULL REFERENCES lunches(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(rater_id, rated_id, lunch_id)
);

CREATE INDEX IF NOT EXISTS idx_user_ratings_rated_id ON user_ratings(rated_id);
CREATE INDEX IF NOT EXISTS idx_user_ratings_lunch_id ON user_ratings(lunch_id);

ALTER TABLE user_ratings ENABLE ROW LEVEL SECURITY;

-- Users can insert/update only their own ratings (rater_id = auth.uid())
CREATE POLICY "Users can insert their own ratings"
ON user_ratings FOR INSERT
WITH CHECK (rater_id = auth.uid());

CREATE POLICY "Users can update their own ratings"
ON user_ratings FOR UPDATE
USING (rater_id = auth.uid())
WITH CHECK (rater_id = auth.uid());

-- Users can read ratings they gave or received
CREATE POLICY "Users can read ratings they gave or received"
ON user_ratings FOR SELECT
USING (rater_id = auth.uid() OR rated_id = auth.uid());

-- RPC to get average rating for a user (anyone can call - returns public aggregate only)
CREATE OR REPLACE FUNCTION get_user_average_rating(p_user_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_avg NUMERIC;
BEGIN
  SELECT ROUND(AVG(rating)::numeric, 1) INTO v_avg
  FROM user_ratings
  WHERE rated_id = p_user_id;
  RETURN COALESCE(v_avg, 0);
END;
$$;
GRANT EXECUTE ON FUNCTION get_user_average_rating(UUID) TO authenticated;
