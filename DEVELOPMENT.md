# Development Setup Guide

This guide will help you set up the LunchMeet project for local development and collaboration.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher recommended)
  - Check version: `node --version`
  - Download: https://nodejs.org/
- **npm** (comes with Node.js)
  - Check version: `npm --version`
- **Git** (for version control)
  - Check version: `git --version`
- **Expo CLI** (optional, but recommended)
  - Install: `npm install -g expo-cli`

## Initial Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd LunchMeet
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required packages including:
- Expo SDK (~54.0.29)
- React Native dependencies
- Supabase client
- Google Maps integration
- And other project dependencies

### 3. Environment Variables Setup

Create a `.env` file in the root directory by copying the example:

```bash
cp .env.example .env
```

Then edit `.env` and fill in your actual values:

```env
GOOGLE_PLACES_API_KEY=your_google_places_api_key_here
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here  # Optional
```

**Important Notes:**
- The `.env` file is gitignored and should never be committed
- `EXPO_PUBLIC_` prefix is required for Expo to expose these variables to the client
- Never share your API keys or service role keys publicly

## External Services Setup

### Supabase Setup

1. **Create a Supabase Account** (if you don't have one)
   - Go to https://supabase.com
   - Sign up for a free account

2. **Create a New Project**
   - Click "New Project"
   - Choose a name and database password
   - Select a region close to you
   - Wait for the project to be provisioned (2-3 minutes)

3. **Get Your Supabase Credentials**
   - Go to **Settings** → **API**
   - Copy the following:
     - **Project URL** → `EXPO_PUBLIC_SUPABASE_URL`
     - **anon/public key** → `EXPO_PUBLIC_SUPABASE_ANON_KEY`
     - **service_role key** (optional, for migrations) → `SUPABASE_SERVICE_ROLE_KEY`

4. **Run Database Migrations**

   The project requires several database tables and policies. Run these migrations in order:

   **Option A: Via Supabase Dashboard (Recommended for first-time setup)**
   
   1. Go to **SQL Editor** in your Supabase dashboard
   2. Run each migration file in the `migrations/` directory in this order:
      - `create_chat_system.sql` - Creates chat rooms and messages tables
      - `add_looking_for_column.sql` - Adds looking_for column to profiles
      - `add_status_to_lunch_attendees.sql` - Adds status to lunch_attendees
      - `fix_lunch_attendees_rls_v2.sql` - Sets up RLS policies for lunch_attendees
      - `alternative_rls_fix.sql` - Creates RPC functions for accepting/denying requests
      - `enable_realtime_messages.sql` - Enables real-time for messages

   **Option B: Via Migration Scripts**
   
   If you have the `SUPABASE_SERVICE_ROLE_KEY` in your `.env`:
   ```bash
   node scripts/execute-migration.js
   ```

   **Note:** The migrations assume you already have base tables like `profiles`, `lunches`, and `lunch_attendees`. If these don't exist, see [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) for the complete schema including base table definitions.

### Google Places API Setup

1. **Create a Google Cloud Project**
   - Go to https://console.cloud.google.com/
   - Create a new project or select an existing one

2. **Enable Places API**
   - Navigate to **APIs & Services** → **Library**
   - Search for "Places API"
   - Click **Enable**

3. **Create an API Key**
   - Go to **APIs & Services** → **Credentials**
   - Click **Create Credentials** → **API Key**
   - Copy the API key
   - (Recommended) Restrict the API key to only "Places API" for security

4. **Add to `.env`**
   ```env
   GOOGLE_PLACES_API_KEY=your_api_key_here
   ```

## Running the Application

### Start the Places Proxy Server

The app uses a proxy server to protect your Google Places API key. Start it in a separate terminal:

```bash
npm run proxy
```

This will start the proxy server on `http://localhost:8787`

**Keep this terminal running** while developing.

### Start the Expo Development Server

In a new terminal, start the Expo app:

```bash
# For web development (recommended for quick iteration)
npm run web

# For iOS simulator (macOS only)
npm run ios

# For Android emulator
npm run android

# Or use the general start command and choose platform
npm start
```

The app will open in your browser (for web) or simulator/emulator.

## Development Workflow

### Project Structure

```
LunchMeet/
├── app/                    # Expo Router pages (file-based routing)
│   ├── (tabs)/            # Tab navigation screens
│   └── screens/           # Additional screen components
├── components/            # Reusable UI components
├── src/
│   ├── lib/              # Utilities (Supabase client, etc.)
│   ├── components/       # Shared components
│   ├── AuthContext.tsx   # Authentication context
│   └── LunchContext.tsx  # Lunch data context
├── migrations/           # Database migration SQL files
├── server/              # Backend proxy server
└── scripts/             # Utility scripts
```

### Common Commands

```bash
# Start development server
npm run web

# Run linter
npm lint

# Start proxy server
npm run proxy

# Reset project (if needed)
npm run reset-project
```

### Hot Reloading

Expo supports hot reloading by default. Changes to your code will automatically refresh in the browser/simulator.

## Troubleshooting

### Issue: "Missing Supabase configuration"

**Solution:** 
- Check that your `.env` file exists and has the correct variable names
- Ensure variables start with `EXPO_PUBLIC_` for client-side access
- Restart the Expo dev server after changing `.env`

### Issue: "Missing GOOGLE_PLACES_API_KEY"

**Solution:**
- Verify your `.env` file has `GOOGLE_PLACES_API_KEY` set
- Make sure the proxy server is running (`npm run proxy`)
- Check that the API key is valid in Google Cloud Console

### Issue: Database errors or missing tables

**Solution:**
- Verify all migrations have been run in Supabase
- Check the Supabase SQL Editor for any error messages
- Ensure RLS (Row Level Security) policies are set up correctly
- Review migration files in `migrations/` directory

### Issue: Port already in use

**Solution:**
- The proxy server uses port 8787
- Expo uses port 8081 (Metro bundler) and 19000-19001 (Expo dev server)
- Kill processes using these ports or change the ports in the configuration

### Issue: Module not found errors

**Solution:**
```bash
# Clear cache and reinstall
rm -rf node_modules
npm install
# Clear Expo cache
npx expo start -c
```

## Collaboration Guidelines

### Before Starting Work

1. **Pull latest changes**
   ```bash
   git pull origin main
   ```

2. **Check for new dependencies**
   ```bash
   npm install
   ```

3. **Check for new migrations**
   - Review `migrations/` directory
   - Run any new migrations in Supabase SQL Editor

4. **Verify environment variables**
   - Ensure your `.env` file is up to date
   - Coordinate with team if new environment variables are needed

### Before Committing

1. **Run linter**
   ```bash
   npm run lint
   ```

2. **Test your changes**
   - Test on web: `npm run web`
   - Test on mobile if applicable: `npm run ios` or `npm run android`

3. **Check for sensitive data**
   - Never commit `.env` file
   - Never commit API keys or secrets
   - Review `.gitignore` if adding new files

### Database Changes

If you need to make database changes:

1. Create a new migration file in `migrations/` directory
2. Name it descriptively: `your_migration_name.sql`
3. Test the migration in your local Supabase project
4. Document the migration in a PR or team communication
5. Coordinate with team before running on production

## Additional Resources

- [Expo Documentation](https://docs.expo.dev/)
- [Expo Router Documentation](https://docs.expo.dev/router/introduction/)
- [Supabase Documentation](https://supabase.com/docs)
- [Google Places API Documentation](https://developers.google.com/maps/documentation/places/web-service)

## Getting Help

If you encounter issues not covered here:

1. Check the [README.md](./README.md) for project overview
2. Review migration files in `migrations/` for database schema
3. Check existing issues or create a new one in the repository
4. Reach out to the team for assistance

## Quick Start Checklist

- [ ] Node.js installed
- [ ] Repository cloned
- [ ] Dependencies installed (`npm install`)
- [ ] `.env` file created with all required variables
- [ ] Supabase project created and credentials added
- [ ] Database migrations run
- [ ] Google Places API key obtained and added
- [ ] Proxy server running (`npm run proxy`)
- [ ] App running (`npm run web`)

Happy coding! 🚀
