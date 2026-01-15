# LunchMeet 🍽️

A social platform for organizing lunch meetups where users can host or join lunch meetings at restaurants.

## Features

- 🔍 Google Places integration for restaurant search
- 📅 Schedule lunch meets with date, time, and guest count
- 👤 User profiles with photos, bio, and interests
- 💬 Real-time group chat for lunch attendees
- ✅ Request/approval system for joining lunches

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

4. Start the proxy server (for Google Places API)

   ```bash
   npm run proxy
   ```

5. Start the app

   ```bash
   npm run web
   ```

## Database Setup

Run the SQL migrations in the `migrations/` directory in your Supabase SQL Editor:

1. `create_chat_system.sql` - Creates chat rooms and messages tables
2. `add_looking_for_column.sql` - Adds looking_for column to profiles
3. `add_status_to_lunch_attendees.sql` - Adds status to lunch_attendees
4. `fix_lunch_attendees_rls_v2.sql` - Sets up RLS policies for lunch_attendees
5. `alternative_rls_fix.sql` - Creates RPC functions for accepting/denying requests
6. `enable_realtime_messages.sql` - Enables real-time for messages

## Tech Stack

- **Frontend**: React Native with Expo
- **Backend**: Supabase (PostgreSQL + Authentication + Realtime)
- **Maps**: Google Places API
- **Routing**: Expo Router

## Learn more

To learn more about developing with Expo, check out:
- [Expo documentation](https://docs.expo.dev/)
- [Expo Router documentation](https://docs.expo.dev/router/introduction/)
