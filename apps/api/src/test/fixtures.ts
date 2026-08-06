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
      "user", profiles, lunches, lunch_attendees, lunch_invites,
      chat_rooms, messages, user_ratings, user_contacts, user_reports,
      notifications, push_tokens, session, account, verification
    restart identity cascade
  `;
}

export async function seedFixtures(): Promise<Fixtures> {
  await resetDatabase();

  const people = [
    { id: "u_host", name: "Host", email: "host@test.local", gender: "female", lookingFor: ["mentoring"] },
    { id: "u_cohost", name: "CoHost", email: "cohost@test.local", gender: "male", lookingFor: [] },
    { id: "u_invitee", name: "Invitee", email: "invitee@test.local", gender: "male", lookingFor: [] },
    { id: "u_stranger", name: "Stranger", email: "stranger@test.local", gender: "male", lookingFor: ["networking"] },
    // Female and interested in mentoring: matches the restricted lunch.
    { id: "u_matching", name: "Matching", email: "matching@test.local", gender: "female", lookingFor: ["mentoring"] },
  ];

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
      hostId: "u_host",
      coHostId: "u_cohost",
      restaurantName: "Public Open",
      dateTime: inHours(24),
      seats: 2,
      isPublic: true,
      latitude: 37.7749,
      longitude: -122.4194,
    },
    {
      id: ids.privateInviteOnly,
      hostId: "u_host",
      restaurantName: "Private",
      dateTime: inHours(24),
      seats: 4,
      isPublic: false,
    },
    {
      id: ids.genderRestricted,
      hostId: "u_host",
      restaurantName: "Restricted",
      dateTime: inHours(24),
      seats: 4,
      isPublic: true,
      visibilityGender: ["female"],
      visibilityLookingFor: ["mentoring"],
    },
    {
      id: ids.past,
      hostId: "u_host",
      restaurantName: "Past",
      dateTime: inHours(-5),
      seats: 4,
      isPublic: true,
    },
  ]);

  await db.insert(lunchInvites).values({
    lunchId: ids.privateInviteOnly,
    inviterId: "u_host",
    inviteeId: "u_invitee",
  });

  await db.insert(lunchAttendees).values([
    { lunchId: ids.past, userId: "u_stranger", status: "accepted" },
  ]);

  return {
    users: {
      host: "u_host",
      coHost: "u_cohost",
      invitee: "u_invitee",
      stranger: "u_stranger",
      matching: "u_matching",
    },
    lunches: ids,
  };
}
