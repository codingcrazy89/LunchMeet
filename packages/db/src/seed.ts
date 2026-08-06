import { randomUUID } from "node:crypto";
import { loadServerEnv } from "@lunchmeet/config";
import { createDatabase } from "./client.js";
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
} from "./schema/index.js";

/**
 * Development seed data.
 *
 * Deliberately covers the states that are easy to get wrong: a private lunch,
 * a lunch with gender/interest visibility filters, pending and accepted
 * attendees, a co-hosted lunch, and a past lunch awaiting ratings. These are
 * the cases where v1's client-side filtering leaked data.
 *
 * Destructive: truncates every table. Refuses to run outside development.
 */

const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 60 * 60 * 1000);

async function main(): Promise<void> {
  const env = loadServerEnv();

  if (env.NODE_ENV === "production") {
    console.error("Refusing to seed a production database.");
    process.exit(1);
  }

  const { db, sql, close } = createDatabase({ url: env.DATABASE_URL, max: 1 });

  try {
    console.log("Truncating existing data...");
    await sql`
      truncate table
        lunchmeet."user", lunchmeet.profiles, lunchmeet.lunches,
        lunchmeet.lunch_attendees, lunchmeet.lunch_invites,
        lunchmeet.chat_rooms, lunchmeet.messages, lunchmeet.user_ratings,
        lunchmeet.user_contacts, lunchmeet.user_reports,
        lunchmeet.notifications, lunchmeet.push_tokens,
        lunchmeet.session, lunchmeet.account, lunchmeet.verification
      restart identity cascade
    `;

    /**
     * Identifiers are generated, never derived from names.
     *
     * An earlier version of this seed used readable ids like id.ada!, which
     * gave the false impression that real user ids came from names. They do
     * not: Better Auth issues a UUID per user. Seed data that misrepresents
     * production is worse than no seed data.
     */
    const people = [
      { key: "ada", name: "Ada Lovelace", email: "ada@example.com", age: 36, gender: "female", lookingFor: ["networking", "tech talk"] },
      { key: "alan", name: "Alan Turing", email: "alan@example.com", age: 41, gender: "male", lookingFor: ["networking", "chess"] },
      { key: "grace", name: "Grace Hopper", email: "grace@example.com", age: 45, gender: "female", lookingFor: ["mentoring"] },
      { key: "linus", name: "Linus Pauling", email: "linus@example.com", age: 52, gender: "male", lookingFor: ["quiet lunch"] },
      { key: "katherine", name: "Katherine Johnson", email: "katherine@example.com", age: 38, gender: "female", lookingFor: ["networking"] },
    ].map((person) => ({ ...person, id: randomUUID() }));

    /** Lets the fixtures below refer to people by name without hardcoding ids. */
    const id = Object.fromEntries(people.map((p) => [p.key, p.id])) as Record<string, string>;

    console.log(`Inserting ${people.length} users and profiles...`);
    await db.insert(user).values(
      people.map((p) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        emailVerified: true,
      }))
    );

    await db.insert(profiles).values(
      people.map((p) => ({
        userId: p.id,
        name: p.name,
        age: p.age,
        gender: p.gender,
        bio: `Seed profile for ${p.name}.`,
        lookingFor: p.lookingFor,
        photoKeys: [],
      }))
    );

    const publicLunchId = randomUUID();
    const privateLunchId = randomUUID();
    const filteredLunchId = randomUUID();
    const pastLunchId = randomUUID();

    console.log("Inserting lunches...");
    await db.insert(lunches).values([
      {
        id: publicLunchId,
        hostId: id.ada!,
        coHostId: id.grace!,
        placeId: "seed_place_tartine",
        restaurantName: "Tartine Bakery",
        restaurantAddress: "600 Guerrero St, San Francisco, CA",
        latitude: 37.7614,
        longitude: -122.4241,
        dateTime: hoursFromNow(26),
        seats: 4,
        description: "Open lunch, all welcome. Co-hosted with Grace.",
        isPublic: true,
      },
      {
        id: privateLunchId,
        hostId: id.alan!,
        placeId: "seed_place_zuni",
        restaurantName: "Zuni Cafe",
        restaurantAddress: "1658 Market St, San Francisco, CA",
        latitude: 37.7736,
        longitude: -122.4222,
        dateTime: hoursFromNow(50),
        seats: 2,
        description: "Invite only. Should never appear to uninvited users.",
        isPublic: false,
      },
      {
        id: filteredLunchId,
        hostId: id.grace!,
        placeId: "seed_place_nopa",
        restaurantName: "Nopa",
        restaurantAddress: "560 Divisadero St, San Francisco, CA",
        latitude: 37.7748,
        longitude: -122.4374,
        dateTime: hoursFromNow(74),
        seats: 6,
        description: "Visibility restricted to women interested in mentoring.",
        isPublic: true,
        visibilityGender: ["female"],
        visibilityLookingFor: ["mentoring"],
      },
      {
        id: pastLunchId,
        hostId: id.katherine!,
        placeId: "seed_place_swan",
        restaurantName: "Swan Oyster Depot",
        restaurantAddress: "1517 Polk St, San Francisco, CA",
        latitude: 37.7902,
        longitude: -122.4204,
        // Far enough in the past that the rating prompt is due.
        dateTime: hoursFromNow(-5),
        seats: 3,
        description: "Already happened. Ratings are due for this one.",
        isPublic: true,
      },
    ]);

    console.log("Inserting attendees, invites, chat, ratings, notifications...");
    await db.insert(lunchAttendees).values([
      { lunchId: publicLunchId, userId: id.alan!, status: "accepted" },
      { lunchId: publicLunchId, userId: id.linus!, status: "pending" },
      { lunchId: privateLunchId, userId: id.ada!, status: "accepted" },
      { lunchId: pastLunchId, userId: id.ada!, status: "accepted" },
      { lunchId: pastLunchId, userId: id.grace!, status: "accepted" },
    ]);

    await db.insert(lunchInvites).values([
      { lunchId: privateLunchId, inviterId: id.alan!, inviteeId: id.ada!, status: "accepted" },
      { lunchId: privateLunchId, inviterId: id.alan!, inviteeId: id.katherine!, status: "pending" },
    ]);

    const roomId = randomUUID();
    await db.insert(chatRooms).values({ id: roomId, lunchId: publicLunchId });
    await db.insert(messages).values([
      { chatRoomId: roomId, senderId: id.ada!, body: "Table booked for 12:30." },
      { chatRoomId: roomId, senderId: id.alan!, body: "See you there." },
    ]);

    await db.insert(userRatings).values([
      { lunchId: pastLunchId, raterId: id.katherine!, ratedId: id.ada!, rating: 5 },
      {
        lunchId: pastLunchId,
        raterId: id.katherine!,
        ratedId: id.grace!,
        rating: 2,
        comment: "Arrived very late and left early without saying anything.",
      },
    ]);

    await db.insert(userContacts).values([
      { userId: id.ada!, contactId: id.alan! },
      { userId: id.alan!, contactId: id.ada! },
    ]);

    await db.insert(notifications).values([
      {
        userId: id.ada!,
        type: "join_request",
        title: "Linus Pauling asked to join",
        body: "Tartine Bakery",
        data: { lunchId: publicLunchId },
      },
      {
        userId: id.katherine!,
        type: "invite",
        title: "Alan Turing invited you",
        body: "Zuni Cafe",
        data: { lunchId: privateLunchId },
      },
    ]);

    const rows = await sql<{ count: string }[]>`select count(*)::text from profiles`;
    console.log("");
    console.log(`Seed complete. ${rows[0]?.count ?? "0"} profiles, 4 lunches.`);
    console.log("  public lunch  :", publicLunchId);
    console.log("  sample user   :", id.ada, "(Ada Lovelace)");
    console.log("  private lunch :", privateLunchId);
    console.log("  filtered lunch:", filteredLunchId);
    console.log("  past lunch    :", pastLunchId);
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
