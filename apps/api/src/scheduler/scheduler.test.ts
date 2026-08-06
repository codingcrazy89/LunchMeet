import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { lunches, notifications } from "@lunchmeet/db";
import { db } from "../db.js";
import { seedFixtures, type Fixtures } from "../test/fixtures.js";
import { sendRatingPrompts } from "./index.js";

/**
 * The reason this job moved out of pg_cron: it can now be called directly.
 *
 * In v1 the same logic lived in a SECURITY DEFINER function invoked by a
 * database cron entry, where it could not be tested, could not be traced, and
 * required a superuser to install.
 */

let fx: Fixtures;

beforeEach(async () => {
  fx = await seedFixtures();
});

describe("sendRatingPrompts", () => {
  it("prompts participants of a lunch that has ended", async () => {
    const sent = await sendRatingPrompts();
    expect(sent).toBe(1);

    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.type, "rate_attendees"));

    // The past lunch has a host and one accepted attendee.
    const recipients = rows.map((r) => r.userId).sort();
    expect(recipients).toEqual([fx.users.host, fx.users.stranger].sort());
  });

  it("marks the lunch so a second pass does nothing", async () => {
    await sendRatingPrompts();
    const second = await sendRatingPrompts();

    expect(second).toBe(0);

    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.type, "rate_attendees"));
    expect(rows).toHaveLength(2);
  });

  it("records when the prompt was sent", async () => {
    await sendRatingPrompts();

    const [past] = await db
      .select({ sentAt: lunches.ratingPromptSentAt })
      .from(lunches)
      .where(eq(lunches.id, fx.lunches.past));

    expect(past?.sentAt).toBeInstanceOf(Date);
  });

  it("leaves future lunches alone", async () => {
    await sendRatingPrompts();

    const [upcoming] = await db
      .select({ sentAt: lunches.ratingPromptSentAt })
      .from(lunches)
      .where(eq(lunches.id, fx.lunches.publicOpen));

    expect(upcoming?.sentAt).toBeNull();
  });

  it("does not prompt before the delay has elapsed", async () => {
    // Evaluate as though it were an hour after the past lunch, which is inside
    // the two-hour window.
    const justAfter = new Date(Date.now() - 4 * 3600_000);
    const sent = await sendRatingPrompts(justAfter);

    expect(sent).toBe(0);
  });
});
