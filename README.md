# LunchMeet 🍽️

A social platform for organizing lunch meetups where users can host or join lunch meetings at restaurants.

## Features

- 🔍 Google Places integration for restaurant search
- 📅 Schedule lunch meets with date, time, and guest count
- 👤 User profiles with photos, bio, and interests
- 💬 Real-time group chat for lunch attendees
- ✅ Request/approval system for joining lunches
- ⭐ User ratings (1-5 stars) after lunch meets
- 🔒 Lunch visibility filtering (gender, looking for)
- 👥 Co-host feature for lunch management
- ✉️ Direct private invites by email
- 🔐 Sign in with Google or Apple (in addition to email magic link)
- 🛡️ Safety tips and first-launch warning

## Get started

### Prerequisites

- Node.js installed
- A Google Places API key
- A Supabase account with project set up

### Installation

1. Clone the repository

   ```bash
   git clone https://github.com/codingcrazy89/LunchMeet.git
   cd LunchMeet
   ```

2. Install dependencies

   ```bash
   npm install
   ```

3. Set up environment variables

   Create a `.env` file in the root directory:

   ```env
   GOOGLE_PLACES_API_KEY=your_google_places_api_key
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Configure Google and Apple OAuth (optional, for social sign-in)

   To enable "Sign in with Google" and "Sign in with Apple":

   - Go to [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Authentication** → **Providers**
   - **Google**: Enable the Google provider and add your OAuth client ID and secret from [Google Cloud Console](https://console.cloud.google.com/)
   - **Apple**: Enable the Apple provider and add your Apple OAuth credentials (required for iOS App Store; only shown on native, not web)
   - Add your **Redirect URLs** in Supabase → Authentication → URL Configuration:
     - For web: your app origin (e.g. `http://localhost:8081` for local dev, or your production URL)
     - For native: your Expo deep link scheme (e.g. `exp://...` or your custom scheme)

5. Start the proxy server (for Google Places API)

   ```bash
   npm run proxy
   ```

6. Start the app

   ```bash
   npm run web
   ```

## Database Setup

Run the SQL migrations in the `migrations/` directory in your Supabase SQL Editor (in order):

1. `create_chat_system.sql` - Creates chat rooms and messages tables
2. `add_looking_for_column.sql` - Adds looking_for column to profiles
3. `add_status_to_lunch_attendees.sql` - Adds status to lunch_attendees
4. `fix_lunch_attendees_rls_v2.sql` - Sets up RLS policies for lunch_attendees
5. `alternative_rls_fix.sql` - Creates RPC functions for accepting/denying requests
6. `enable_realtime_messages.sql` - Enables real-time for messages
7. `create_user_ratings.sql` - User 1-5 star ratings after lunch meets
8. `add_lunch_visibility.sql` - Visibility filtering (gender, looking for)
9. `add_co_host_to_lunches.sql` - Co-host support
10. `create_lunch_invites.sql` - Direct private invites
11. `add_social_media_url.sql` - Social media link badge on profiles
12. `create_notifications.sql` - In-app notifications (invites, join requests, co-host, chat, request accepted)
13. `add_lunch_is_public.sql` - Public/private lunch visibility (private = invite-only)

## Tech Stack

- **Frontend**: React Native with Expo
- **Backend**: Supabase (PostgreSQL + Authentication + Realtime)
- **Maps**: Google Places API
- **Routing**: Expo Router

## Learn more

To learn more about developing with Expo, check out:
- [Expo documentation](https://docs.expo.dev/)
- [Expo Router documentation](https://docs.expo.dev/router/introduction/)
