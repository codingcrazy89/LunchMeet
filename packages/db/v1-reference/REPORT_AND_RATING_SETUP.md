# Report & Rating Features Setup

## 1. Run Migrations

Run these SQL migrations in your Supabase SQL Editor (in order):

1. **add_rating_comment.sql** - Adds `comment` column to `user_ratings` for low-star ratings
2. **create_user_reports.sql** - Creates `user_reports` table and admin notification trigger

## 2. Set Admin User ID (for Report Notifications)

After running `create_user_reports.sql`, set your user ID as the admin so you receive report notifications:

```sql
INSERT INTO app_config (key, value) VALUES ('admin_user_id', 'YOUR_USER_UUID_HERE')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

To find your user UUID: In Supabase Dashboard → Authentication → Users, copy your user ID.

## Features

### Rating Comment (Feature 1)
- When a user rates another user with **less than 3 stars**, they must provide a comment explaining why
- Applies to: Rate Attendees screen, Rate modal (from Lunches and My Lunches)

### Report User (Feature 2)
- **Report** button appears on each user's profile (below "Add Contact")
- Users must write **at least 50 words** explaining why they are reporting
- On submit, the admin receives an in-app notification
- Reports are stored in `user_reports` (viewable in Supabase Dashboard with service role)
