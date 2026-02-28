# How to Revert to Configuration 1

When you want to restore the project to the Configuration 1 state (the snapshot taken before building new features), follow these steps.

---

## Step 1: Create the tag (do this once, now)

First, commit your current work and create the tag. Run these commands in your project root:

```powershell
cd c:\Users\jpmit\Code\LunchMeet

# Stage all files
git add -A

# Commit the current state as Configuration 1
git commit -m "Configuration 1: Full feature set snapshot (ratings, invites, co-host, visibility, safety, social auth)"

# Create the tag
git tag -a configuration-1 -m "Configuration 1 backup - revert point before new features"

# Push tag to remote (if you use GitHub/remote)
git push origin configuration-1
```

---

## Step 2: Revert later (when you want to start over)

When you want to go back to Configuration 1:

### Option A: Reset current branch to Configuration 1

```powershell
git checkout configuration-1
# This puts you in "detached HEAD" state. To make it a branch:
git checkout -b restored-config-1
```

### Option B: Create a fresh branch from Configuration 1

```powershell
git checkout -b fresh-start configuration-1
```

### Option C: Hard reset (destructive — loses uncommitted work)

```powershell
git reset --hard configuration-1
```

---

## After reverting

1. Run `npm install` to ensure dependencies match.
2. If you changed the database, you may need to re-run migrations or restore a Supabase backup.
3. Restore your `.env` file with the correct values (it is gitignored and won't be in the snapshot).

---

## Files in this backup

- `CONFIGURATION_1_SNAPSHOT.md` — Full description of features, structure, and config
- `RESTORE_INSTRUCTIONS.md` — This file
