import { and, eq } from "drizzle-orm";
import type { LunchRole } from "@lunchmeet/shared";
import { lunchAttendees, lunchInvites, lunches } from "@lunchmeet/db";
import { db } from "../db.js";
import { forbidden, notFound } from "../lib/errors.js";
import { visibleToViewer } from "./visibility.js";

/**
 * Resolves what a caller is allowed to do with a given lunch.
 *
 * Every route that touches a lunch goes through here first. In v1 these checks
 * lived in the client (`LunchContext` decided who could accept a request) and
 * in a scattering of Postgres RLS policies and SECURITY DEFINER functions,
 * with several operations covered by neither.
 */

export interface LunchContext {
  lunch: typeof lunches.$inferSelect;
  role: LunchRole;
  /** Attendee status, when the caller has an attendee row. */
  attendeeStatus: "pending" | "accepted" | "denied" | null;
}

export async function resolveLunchContext(
  lunchId: string,
  viewerId: string
): Promise<LunchContext> {
  // Selecting with the visibility predicate means a lunch the caller may not
  // see returns "not found", rather than confirming it exists.
  const [lunch] = await db
    .select()
    .from(lunches)
    .where(and(eq(lunches.id, lunchId), visibleToViewer(viewerId)))
    .limit(1);

  if (!lunch) {
    throw notFound("Lunch not found.");
  }

  if (lunch.hostId === viewerId) {
    return { lunch, role: "host", attendeeStatus: null };
  }
  if (lunch.coHostId === viewerId) {
    return { lunch, role: "co_host", attendeeStatus: null };
  }

  const [attendee] = await db
    .select({ status: lunchAttendees.status })
    .from(lunchAttendees)
    .where(and(eq(lunchAttendees.lunchId, lunchId), eq(lunchAttendees.userId, viewerId)))
    .limit(1);

  if (attendee) {
    return { lunch, role: "attendee", attendeeStatus: attendee.status };
  }

  const [invite] = await db
    .select({ id: lunchInvites.id })
    .from(lunchInvites)
    .where(and(eq(lunchInvites.lunchId, lunchId), eq(lunchInvites.inviteeId, viewerId)))
    .limit(1);

  if (invite) {
    return { lunch, role: "invitee", attendeeStatus: null };
  }

  return { lunch, role: "none", attendeeStatus: null };
}

/** Host and co-host share every management capability. */
export function isOrganiser(context: LunchContext): boolean {
  return context.role === "host" || context.role === "co_host";
}

export function requireOrganiser(context: LunchContext): void {
  if (!isOrganiser(context)) {
    throw forbidden("Only the host or co-host can do that.");
  }
}

/** Deleting a lunch is host-only; a co-host can manage but not destroy. */
export function requireHost(context: LunchContext): void {
  if (context.role !== "host") {
    throw forbidden("Only the host can do that.");
  }
}

/**
 * Chat is limited to organisers and accepted attendees.
 *
 * A pending request must not see the conversation: that would let anyone read
 * a lunch's chat simply by asking to join.
 */
export function canAccessChat(context: LunchContext): boolean {
  return isOrganiser(context) || context.attendeeStatus === "accepted";
}

export function requireChatAccess(context: LunchContext): void {
  if (!canAccessChat(context)) {
    throw forbidden("Only confirmed attendees can use this chat.");
  }
}

/** Participants of a finished lunch, who may rate one another. */
export function isConfirmedParticipant(context: LunchContext): boolean {
  return isOrganiser(context) || context.attendeeStatus === "accepted";
}
