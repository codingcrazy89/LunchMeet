/**
 * One-off migration from the v1 Supabase database into the v2 schema.
 *
 * Runs read-only against Supabase and writes into the v2 database. Defaults to
 * --dry-run: it reports exactly what it would write and changes nothing until
 * invoked with --apply.
 *
 * Usage:
 *   SUPABASE_DB_URL=postgresql://... npx tsx src/scripts/migrate-from-supabase.ts
 *   SUPABASE_DB_URL=postgresql://... npx tsx src/scripts/migrate-from-supabase.ts --apply
 *
 * The v1 analysis is the authority on the source shapes; see LunchMeet.arch.md.
 */
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import {
  chatRooms,
  lunchAttendees,
  lunchInvites,
  lunches,
  messages,
  notifications,
  profiles,
  user,
  userContacts,
  userRatings,
  userReports,
} from "@lunchmeet/db";
import { db, sql as targetSql } from "../db.js";
import { env } from "../env.js";
import { extensionFor, profilePhotoKey, storage } from "../storage/index.js";

const APPLY = process.argv.includes("--apply");
const SOURCE_URL = env.SUPABASE_DB_URL;

interface Counts {
  users: number;
  profiles: number;
  photos: number;
  lunches: number;
  attendees: number;
  invites: number;
  chatRooms: number;
  messages: number;
  ratings: number;
  contacts: number;
  reports: number;
  notifications: number;
  skipped: string[];
}

const counts: Counts = {
  users: 0,
  profiles: 0,
  photos: 0,
  lunches: 0,
  attendees: 0,
  invites: 0,
  chatRooms: 0,
  messages: 0,
  ratings: 0,
  contacts: 0,
  reports: 0,
  notifications: 0,
  skipped: [],
};

/**
 * Decodes a v1 base64 data URI and uploads it to object storage.
 *
 * v1 stored photos as `data:image/jpeg;base64,...` directly in profiles.photos.
 * Anything that is already a URL is skipped: those came from the abandoned
 * Storage path and would need re-hosting separately.
 */
async function migratePhoto(userId: string, value: string): Promise<string | null> {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(value);
  if (!match) {
    counts.skipped.push(`photo for ${userId}: not a base64 data URI`);
    return null;
  }

  const contentType = match[1] as "image/jpeg" | "image/png" | "image/webp";
  const bytes = Buffer.from(match[2]!, "base64");
  const key = profilePhotoKey(userId, randomUUID(), extensionFor(contentType));

  if (!APPLY) {
    counts.photos += 1;
    return key;
  }

  const upload = await storage().presignUpload(key, contentType);
  const response = await fetch(upload.url, {
    method: "POST",
    headers: upload.headers,
    body: new Uint8Array(bytes),
  });
  if (!response.ok) {
    counts.skipped.push(`photo for ${userId}: upload failed HTTP ${response.status}`);
    return null;
  }

  counts.photos += 1;
  return key;
}

async function main(): Promise<void> {
  if (!SOURCE_URL) {
    console.error("SUPABASE_DB_URL is required (read-only connection to the v1 database).");
    process.exit(1);
  }

  const source = postgres(SOURCE_URL, { max: 2, onnotice: () => {} });

  console.log("");
  console.log(APPLY ? "  MODE: APPLY (writes)" : "  MODE: DRY RUN (no writes)");
  console.log(`  Target: ${env.DATABASE_URL.replace(/:[^:@]+@/, ":***@")}`);
  console.log("");

  try {
    if (APPLY) {
      const existing = await db.$count(user);
      if (existing > 0) {
        console.error(
          `  Target already has ${existing} users. Refusing to run to avoid a double import.`
        );
        console.error("  Reset the target database first if this is intentional.");
        process.exit(1);
      }
    }

    // ---- users and profiles -------------------------------------------------
    const sourceUsers = await source<
      { id: string; email: string; created_at: Date }[]
    >`select id, email, created_at from auth.users order by created_at`;

    const sourceProfiles = await source<
      {
        id: string;
        name: string | null;
        age: number | null;
        gender: string | null;
        bio: string | null;
        photos: unknown;
        looking_for: string[] | null;
        social_media_url: string | null;
        suspended: boolean | null;
      }[]
    >`select id, name, age, gender, bio, photos, looking_for, social_media_url, suspended
      from profiles`;

    const profileById = new Map(sourceProfiles.map((p) => [p.id, p]));

    for (const sourceUser of sourceUsers) {
      const profile = profileById.get(sourceUser.id);
      const name = profile?.name ?? sourceUser.email.split("@")[0] ?? "LunchMeet user";

      if (APPLY) {
        await db
          .insert(user)
          .values({
            id: sourceUser.id,
            email: sourceUser.email,
            name,
            // v1 used magic links and OAuth, both of which prove the address.
            emailVerified: true,
            createdAt: sourceUser.created_at,
          })
          .onConflictDoNothing();
      }
      counts.users += 1;

      const rawPhotos = Array.isArray(profile?.photos) ? (profile.photos as string[]) : [];
      const photoKeys: string[] = [];
      for (const raw of rawPhotos) {
        const key = await migratePhoto(sourceUser.id, raw);
        if (key) photoKeys.push(key);
      }

      if (APPLY) {
        await db
          .insert(profiles)
          .values({
            userId: sourceUser.id,
            name,
            age: profile?.age ?? null,
            gender: profile?.gender ?? null,
            bio: profile?.bio ?? null,
            socialMediaUrl: profile?.social_media_url ?? null,
            lookingFor: profile?.looking_for ?? [],
            photoKeys,
            suspended: profile?.suspended ?? false,
          })
          .onConflictDoNothing();
      }
      counts.profiles += 1;
    }

    // ---- lunches ------------------------------------------------------------
    const sourceLunches = await source<Record<string, never>[]>`select * from lunches`;

    for (const row of sourceLunches as unknown as Record<string, unknown>[]) {
      const restaurantName =
        (row.restaurant_name as string | null) ?? (row.restaurant as string | null);
      if (!restaurantName) {
        counts.skipped.push(`lunch ${String(row.id)}: no restaurant name`);
        continue;
      }

      if (APPLY) {
        await db
          .insert(lunches)
          .values({
            id: row.id as string,
            hostId: row.host_id as string,
            coHostId: (row.co_host_id as string | null) ?? null,
            placeId: (row.place_id as string | null) ?? null,
            restaurantName,
            restaurantAddress: (row.restaurant_address as string | null) ?? null,
            latitude: (row.latitude as number | null) ?? null,
            longitude: (row.longitude as number | null) ?? null,
            dateTime: row.date_time as Date,
            seats: (row.seats as number | null) ?? 1,
            description: (row.description as string | null) ?? null,
            isPublic: (row.is_public as boolean | null) ?? true,
            visibilityGender: (row.visibility_gender as string[] | null) ?? null,
            visibilityLookingFor: (row.visibility_looking_for as string[] | null) ?? null,
            ratingPromptSentAt: (row.rating_prompt_sent_at as Date | null) ?? null,
            createdAt: (row.created_at as Date | null) ?? new Date(),
          })
          .onConflictDoNothing();
      }
      counts.lunches += 1;
    }

    // ---- attendance and invitations ----------------------------------------
    const sourceAttendees = await source<
      { id: string; lunch_id: string; user_id: string; status: string | null }[]
    >`select id, lunch_id, user_id, status from lunch_attendees`;

    for (const row of sourceAttendees) {
      // v1 backfilled legacy rows with a null status meaning accepted.
      const status = (row.status ?? "accepted") as "pending" | "accepted" | "denied";
      if (APPLY) {
        await db
          .insert(lunchAttendees)
          .values({ id: row.id, lunchId: row.lunch_id, userId: row.user_id, status })
          .onConflictDoNothing();
      }
      counts.attendees += 1;
    }

    const sourceInvites = await source<
      { id: string; lunch_id: string; inviter_id: string; invitee_id: string; status: string }[]
    >`select id, lunch_id, inviter_id, invitee_id, status from lunch_invites`;

    for (const row of sourceInvites) {
      if (APPLY) {
        await db
          .insert(lunchInvites)
          .values({
            id: row.id,
            lunchId: row.lunch_id,
            inviterId: row.inviter_id,
            inviteeId: row.invitee_id,
            status: row.status as "pending" | "accepted" | "declined",
          })
          .onConflictDoNothing();
      }
      counts.invites += 1;
    }

    // ---- chat ---------------------------------------------------------------
    const sourceRooms = await source<
      { id: string; lunch_id: string; created_at: Date }[]
    >`select id, lunch_id, created_at from chat_rooms`;

    for (const room of sourceRooms) {
      if (APPLY) {
        await db
          .insert(chatRooms)
          .values({ id: room.id, lunchId: room.lunch_id, createdAt: room.created_at })
          .onConflictDoNothing();
      }
      counts.chatRooms += 1;
    }

    const sourceMessages = await source<
      { id: string; chat_room_id: string; sender_id: string; message: string; created_at: Date }[]
    >`select id, chat_room_id, sender_id, message, created_at from messages`;

    for (const row of sourceMessages) {
      if (APPLY) {
        await db
          .insert(messages)
          .values({
            id: row.id,
            chatRoomId: row.chat_room_id,
            senderId: row.sender_id,
            body: row.message,
            createdAt: row.created_at,
          })
          .onConflictDoNothing();
      }
      counts.messages += 1;
    }

    // ---- social -------------------------------------------------------------
    const sourceRatings = await source<
      {
        id: string;
        lunch_id: string;
        rater_id: string;
        rated_id: string;
        rating: number;
        comment: string | null;
        created_at: Date;
      }[]
    >`select id, lunch_id, rater_id, rated_id, rating, comment, created_at from user_ratings`;

    for (const row of sourceRatings) {
      if (row.rater_id === row.rated_id) {
        // v2 forbids self-rating with a check constraint; v1 did not.
        counts.skipped.push(`rating ${row.id}: self-rating`);
        continue;
      }
      if (APPLY) {
        await db
          .insert(userRatings)
          .values({
            id: row.id,
            lunchId: row.lunch_id,
            raterId: row.rater_id,
            ratedId: row.rated_id,
            rating: row.rating,
            comment: row.comment,
            createdAt: row.created_at,
          })
          .onConflictDoNothing();
      }
      counts.ratings += 1;
    }

    const sourceContacts = await source<
      { id: string; user_id: string; contact_id: string; created_at: Date }[]
    >`select id, user_id, contact_id, created_at from user_contacts`;

    for (const row of sourceContacts) {
      if (APPLY) {
        await db
          .insert(userContacts)
          .values({
            id: row.id,
            userId: row.user_id,
            contactId: row.contact_id,
            createdAt: row.created_at,
          })
          .onConflictDoNothing();
      }
      counts.contacts += 1;
    }

    const sourceReports = await source<
      { id: string; reporter_id: string; reported_id: string; comment: string; created_at: Date }[]
    >`select id, reporter_id, reported_id, comment, created_at from user_reports`;

    for (const row of sourceReports) {
      if (APPLY) {
        await db
          .insert(userReports)
          .values({
            id: row.id,
            reporterId: row.reporter_id,
            reportedId: row.reported_id,
            comment: row.comment,
            createdAt: row.created_at,
          })
          .onConflictDoNothing();
      }
      counts.reports += 1;
    }

    const sourceNotifications = await source<
      {
        id: string;
        user_id: string;
        type: string;
        title: string;
        body: string | null;
        data: Record<string, unknown> | null;
        read_at: Date | null;
        created_at: Date;
      }[]
    >`select id, user_id, type, title, body, data, read_at, created_at
      from notifications where created_at > now() - interval '30 days'`;

    for (const row of sourceNotifications) {
      if (APPLY) {
        await db
          .insert(notifications)
          .values({
            id: row.id,
            userId: row.user_id,
            type: row.type as never,
            title: row.title,
            body: row.body,
            data: row.data ?? {},
            readAt: row.read_at,
            createdAt: row.created_at,
          })
          .onConflictDoNothing();
      }
      counts.notifications += 1;
    }

    // ---- report -------------------------------------------------------------
    console.log("  Migrated:");
    for (const [key, value] of Object.entries(counts)) {
      if (key === "skipped") continue;
      console.log(`    ${key.padEnd(15)} ${String(value)}`);
    }

    if (counts.skipped.length > 0) {
      console.log("");
      console.log(`  Skipped ${counts.skipped.length} row(s):`);
      for (const reason of counts.skipped.slice(0, 25)) {
        console.log(`    - ${reason}`);
      }
      if (counts.skipped.length > 25) {
        console.log(`    ... and ${counts.skipped.length - 25} more`);
      }
    }

    if (APPLY) {
      console.log("");
      console.log("  Post-migration verification:");
      const verify = await targetSql<{ table_name: string; n: string }[]>`
        select 'user' as table_name, count(*)::text as n from "user"
        union all select 'profiles', count(*)::text from profiles
        union all select 'lunches', count(*)::text from lunches
        union all select 'lunch_attendees', count(*)::text from lunch_attendees
        union all select 'messages', count(*)::text from messages
        order by table_name
      `;
      for (const row of verify) {
        console.log(`    ${row.table_name.padEnd(16)} ${row.n}`);
      }
    } else {
      console.log("");
      console.log("  Dry run complete. Nothing was written.");
      console.log("  Re-run with --apply to perform the migration.");
    }
    console.log("");
  } finally {
    await source.end({ timeout: 5 });
    await targetSql.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
