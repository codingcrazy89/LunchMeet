import { and, eq, isNull, lte } from "drizzle-orm";
import { RATING_PROMPT_DELAY_HOURS } from "@lunchmeet/shared";
import { lunchAttendees, lunches } from "@lunchmeet/db";
import { db } from "../db.js";
import { notify } from "../lib/notify.js";

/**
 * In-process scheduler, replacing v1's pg_cron job.
 *
 * The work is identical; where it runs is the point. A database cron job is
 * invisible to tests, to Sentry, and to local development, and it required a
 * superuser to install. This runs in the API process, so it is ordinary code
 * that can be called directly from a test.
 */

const INTERVAL_MS = 5 * 60 * 1000;

let timer: NodeJS.Timeout | undefined;
let running = false;

/**
 * Notifies participants of lunches that ended long enough ago to rate.
 *
 * Exported so tests can invoke a single pass deterministically instead of
 * waiting for a timer.
 */
export async function sendRatingPrompts(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - RATING_PROMPT_DELAY_HOURS * 60 * 60 * 1000);

  const due = await db
    .select({
      id: lunches.id,
      restaurantName: lunches.restaurantName,
      hostId: lunches.hostId,
      coHostId: lunches.coHostId,
    })
    .from(lunches)
    .where(and(lte(lunches.dateTime, cutoff), isNull(lunches.ratingPromptSentAt)))
    .limit(100);

  let sent = 0;

  for (const lunch of due) {
    const attendees = await db
      .select({ userId: lunchAttendees.userId })
      .from(lunchAttendees)
      .where(and(eq(lunchAttendees.lunchId, lunch.id), eq(lunchAttendees.status, "accepted")));

    const recipients = [
      lunch.hostId,
      ...(lunch.coHostId ? [lunch.coHostId] : []),
      ...attendees.map((a) => a.userId),
    ];

    // Claim the lunch before notifying. If two instances run concurrently, the
    // conditional update means only one wins and nobody is prompted twice.
    const claimed = await db
      .update(lunches)
      .set({ ratingPromptSentAt: now })
      .where(and(eq(lunches.id, lunch.id), isNull(lunches.ratingPromptSentAt)))
      .returning({ id: lunches.id });

    if (claimed.length === 0) continue;

    // A lunch with only a host has nobody to rate.
    if (recipients.length > 1) {
      await notify({
        recipients,
        type: "rate_attendees",
        title: "How was lunch?",
        body: `Rate the people you met at ${lunch.restaurantName}.`,
        data: { lunchId: lunch.id },
      });
      sent += 1;
    }
  }

  return sent;
}

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const sent = await sendRatingPrompts();
    if (sent > 0) console.log(`Scheduler: sent rating prompts for ${sent} lunch(es).`);
  } catch (error) {
    console.error("Scheduler pass failed:", error);
  } finally {
    running = false;
  }
}

export function startScheduler(): void {
  if (timer) return;
  timer = setInterval(() => void tick(), INTERVAL_MS);
  // Do not hold the process open purely for the scheduler.
  timer.unref();
  void tick();
}

export function stopScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = undefined;
  }
}

/** Kept for the health endpoint, so a stalled scheduler is observable. */
export function schedulerStatus(): { running: boolean; enabled: boolean } {
  return { running, enabled: timer !== undefined };
}
