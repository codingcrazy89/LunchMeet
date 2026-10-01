# Setup Checklist

Use this checklist to verify your local development environment is properly configured.

## Prerequisites

- [ ] Node.js v18+ installed (`node --version`)
- [ ] npm installed (`npm --version`)
- [ ] Git installed (`git --version`)

## Repository Setup

- [ ] Repository cloned
- [ ] Navigated to project directory (`cd LunchMeet`)
- [ ] Dependencies installed (`npm install`)

## Environment Configuration

- [ ] `.env` file created (copy from `.env.example`)
- [ ] `GOOGLE_PLACES_API_KEY` set in `.env`
- [ ] `EXPO_PUBLIC_SUPABASE_URL` set in `.env`
- [ ] `EXPO_PUBLIC_SUPABASE_ANON_KEY` set in `.env`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set in `.env` (optional, for migrations)

## Supabase Setup

- [ ] Supabase account created
- [ ] Supabase project created
- [ ] Base tables created (`profiles`, `lunches`, `lunch_attendees`)
  - See [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) for SQL
- [ ] Migration `create_chat_system.sql` run
- [ ] Migration `add_looking_for_column.sql` run
- [ ] Migration `add_status_to_lunch_attendees.sql` run
- [ ] Migration `fix_lunch_attendees_rls_v2.sql` run
- [ ] Migration `alternative_rls_fix.sql` run
- [ ] Migration `enable_realtime_messages.sql` run
- [ ] RLS policies verified (check Supabase dashboard)

## Google Places API Setup

- [ ] Google Cloud account created
- [ ] Google Cloud project created
- [ ] Places API enabled
- [ ] API key created
- [ ] API key added to `.env` as `GOOGLE_PLACES_API_KEY`
- [ ] API key restrictions configured (recommended)

## Application Startup

- [ ] Proxy server starts successfully (`npm run proxy`)
  - Should see: "🚀 Places proxy running on http://localhost:8787"
- [ ] Expo app starts successfully (`npm run web`)
  - Should open in browser or show QR code
- [ ] No console errors in browser/terminal
- [ ] Supabase connection works (check browser console for errors)

## Functionality Tests

- [ ] Can view login/signup screen
- [ ] Can authenticate with Supabase
- [ ] Can view profile
- [ ] Can view lunches list
- [ ] Can search for restaurants (Google Places integration)
- [ ] Can create a lunch (if authenticated)
- [ ] Can view lunch details
- [ ] Can request to join a lunch
- [ ] Chat functionality works (if applicable)

## Troubleshooting

If any item above is unchecked, refer to:

- [DEVELOPMENT.md](./DEVELOPMENT.md) - Detailed setup instructions
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) - Database schema reference
- [README.md](./README.md) - Quick start guide

## Common Issues

- **"Missing Supabase configuration"** → Check `.env` file has correct variable names
- **"Missing GOOGLE_PLACES_API_KEY"** → Verify proxy server is running and `.env` has the key
- **Database errors** → Verify all migrations have been run
- **Port conflicts** → Check if ports 8787, 8081, or 19000-19001 are in use

## Next Steps

Once all items are checked:

1. ✅ You're ready to start developing!
2. Read [DEVELOPMENT.md](./DEVELOPMENT.md) for collaboration guidelines
3. Check the project structure to understand the codebase
4. Start making changes and test them locally

Happy coding! 🚀
