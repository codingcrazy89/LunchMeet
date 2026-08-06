import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { lunches, profiles } from "@lunchmeet/db";
import { db } from "../db.js";
import { seedFixtures, type Fixtures } from "../test/fixtures.js";
import { visibleToAnonymous, visibleToViewer } from "./visibility.js";

/**
 * The regression suite for v1's central defect.
 *
 * v1 sent every lunch to every client and filtered in JavaScript, and its
 * gender/interest filter was written to the database but never read by
 * anything. These tests assert the filtering happens in SQL, because a test
 * that passes for the wrong reason here means private data leaves the server.
 */

let fx: Fixtures;

async function visibleTo(viewerId: string): Promise<string[]> {
  const rows = await db
    .select({ name: lunches.restaurantName })
    .from(lunches)
    .where(visibleToViewer(viewerId));
  return rows.map((r) => r.name).sort();
}

beforeAll(async () => {
  fx = await seedFixtures();
});

describe("visibleToViewer", () => {
  it("shows a host their own private lunch", async () => {
    const visible = await visibleTo(fx.users.host);
    expect(visible).toContain("Private");
  });

  it("shows a co-host the lunch they co-host", async () => {
    const visible = await visibleTo(fx.users.coHost);
    expect(visible).toContain("Public Open");
  });

  it("hides a private lunch from someone who was not invited", async () => {
    const visible = await visibleTo(fx.users.stranger);
    expect(visible).not.toContain("Private");
  });

  it("shows a private lunch to an invitee", async () => {
    const visible = await visibleTo(fx.users.invitee);
    expect(visible).toContain("Private");
  });

  it("hides a gender-restricted lunch from a non-matching viewer", async () => {
    // Male, so excluded by visibility_gender.
    const visible = await visibleTo(fx.users.stranger);
    expect(visible).not.toContain("Restricted");
  });

  it("shows a restricted lunch only when gender AND interest both match", async () => {
    const matching = await visibleTo(fx.users.matching);
    expect(matching).toContain("Restricted");
  });

  it("hides a restricted lunch when gender matches but interest does not", async () => {
    // A female viewer whose interests lack "mentoring" must still be excluded.
    // Both axes have to match, which is the case v1 never implemented at all.
    await db
      .update(profiles)
      .set({ lookingFor: ["networking"] })
      .where(eq(profiles.userId, fx.users.matching));

    const visible = await visibleTo(fx.users.matching);
    expect(visible).not.toContain("Restricted");

    await db
      .update(profiles)
      .set({ lookingFor: ["mentoring"] })
      .where(eq(profiles.userId, fx.users.matching));
  });

  it("shows an unrestricted public lunch to everyone", async () => {
    for (const viewer of Object.values(fx.users)) {
      const visible = await visibleTo(viewer);
      expect(visible).toContain("Public Open");
    }
  });

  it("shows a lunch to an attendee even when they match nothing else", async () => {
    const visible = await visibleTo(fx.users.stranger);
    expect(visible).toContain("Past");
  });
});

describe("visibleToAnonymous", () => {
  it("shows only unrestricted public lunches", async () => {
    const rows = await db
      .select({ name: lunches.restaurantName })
      .from(lunches)
      .where(visibleToAnonymous());
    const names = rows.map((r) => r.name).sort();

    expect(names).toContain("Public Open");
    expect(names).not.toContain("Private");
    expect(names).not.toContain("Restricted");
  });
});

describe("scoping a single lookup", () => {
  it("returns nothing when the id exists but the viewer may not see it", async () => {
    const rows = await db
      .select({ id: lunches.id })
      .from(lunches)
      .where(
        and(eq(lunches.id, fx.lunches.privateInviteOnly), visibleToViewer(fx.users.stranger))
      );

    // The route turns this into a 404, so the API never confirms the lunch exists.
    expect(rows).toHaveLength(0);
  });
});
