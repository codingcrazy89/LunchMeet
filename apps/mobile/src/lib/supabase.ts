import { createClient } from "@supabase/supabase-js"
import Constants from "expo-constants"

// Try to get from environment variables first, then from Constants.extra
const supabaseUrl = 
  process.env.EXPO_PUBLIC_SUPABASE_URL || 
  Constants.expoConfig?.extra?.supabaseUrl ||
  ""

const supabaseAnonKey = 
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 
  Constants.expoConfig?.extra?.supabaseAnonKey ||
  ""

export const hasSupabaseConfig = !!(supabaseUrl && supabaseAnonKey)
if (!hasSupabaseConfig) {
  console.error("Missing Supabase configuration. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (e.g. in EAS secrets or .env).")
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

