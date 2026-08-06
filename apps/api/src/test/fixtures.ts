import { randomUUID } from "node:crypto";
import {
  lunchAttendees,
  lunchInvites,
  lunches,
  profiles,
  user,
} from "@lunchmeet/db";
import { db, sql } from "../db.js";

/**
 * A deliberately awkward world for exercising the visibility rules.
 *
 * Mirrors the cases v1 got wrong: a private lunch, one restricted by gender and
 * interest, and viewers who match on one axis but not the other.
 */

export interface Fixtures {
  users: {
    host: string;
    coHost: string;
    invitee: string;
    stranger: string;
    matching: string;
  };
  lunches: {
    publicOpen: string;
    privateInviteOnly: string;
    genderRestricted: string;
    past: string;
  };
}

export async function resetDatabase(): Promise<void> {
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
}

export async function seedFixtures(): Promise<Fixtures> {
  await resetDatabase();

  // Ids are generated, matching production, where Better Auth issues a UUID.
  const people = [
    { key: "host", name: "Host", email: "host@test.local", gender: "female", lookingFor: ["mentoring"] },
    { key: "coHost", name: "CoHost", email: "cohost@test.local", gender: "male", lookingFor: [] },
    { key: "invitee", name: "Invitee", email: "invitee@test.local", gender: "male", lookingFor: [] },
    { key: "stranger", name: "Stranger", email: "stranger@test.local", gender: "male", lookingFor: ["networking"] },
    // Female and interested in mentoring: matches the restricted lunch.
    { key: "matching", name: "Matching", email: "matching@test.local", gender: "female", lookingFor: ["mentoring"] },
  ].map((person) => ({ ...person, id: randomUUID() }));

  const userId = Object.fromEntries(people.map((p) => [p.key, p.id])) as Record<string, string>;

  await db.insert(user).values(
    people.map((p) => ({ id: p.id, name: p.name, email: p.email, emailVerified: true }))
  );
  await db.insert(profiles).values(
    people.map((p) => ({
      userId: p.id,
      name: p.name,
      gender: p.gender,
      lookingFor: p.lookingFor,
    }))
  );

  const ids = {
    publicOpen: randomUUID(),
    privateInviteOnly: randomUUID(),
    genderRestricted: randomUUID(),
    past: randomUUID(),
  };

  const inHours = (h: number) => new Date(Date.now() + h * 3600_000);

  await db.insert(lunches).values([
    {
      id: ids.publicOpen,
      hostId: userId.host!,
      coHostId: userId.coHost!,
      restaurantName: "Public Open",
      dateTime: inHours(24),
      seats: 2,
      isPublic: true,
      latitude: 37.7749,
      longitude: -122.4194,
    },
    {
      id: ids.privateInviteOnly,
      hostId: userId.host!,
      restaurantName: "Private",
      dateTime: inHours(24),
      seats: 4,
      isPublic: false,
    },
    {
      id: ids.genderRestricted,
      hostId: userId.host!,
      restaurantName: "Restricted",
      dateTime: inHours(24),
      seats: 4,
      isPublic: true,
      visibilityGender: ["female"],
      visibilityLookingFor: ["mentoring"],
    },
    {
      id: ids.past,
      hostId: userId.host!,
      restaurantName: "Past",
      dateTime: inHours(-5),
      seats: 4,
      isPublic: true,
    },
  ]);

  await db.insert(lunchInvites).values({
    lunchId: ids.privateInviteOnly,
    inviterId: userId.host!,
    inviteeId: userId.invitee!,
  });

  await db.insert(lunchAttendees).values([
    { lunchId: ids.past, userId: userId.stranger!, status: "accepted" },
  ]);

  return {
    users: {
      host: userId.host!,
      coHost: userId.coHost!,
      invitee: userId.invitee!,
      stranger: userId.stranger!,
      matching: userId.matching!,
    },
    lunches: ids,
  };
}
