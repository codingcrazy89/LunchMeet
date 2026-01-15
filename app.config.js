require("dotenv").config();

module.exports = {
  expo: {
    name: "LunchMeet",
    slug: "lunchmeet",
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "automatic",
    extra: {
      googleMapsApiKey: process.env.GOOGLE_PLACES_API_KEY,
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    },
    web: {
      bundler: "metro",
    },
  },
};
