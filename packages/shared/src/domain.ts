/**
 * Domain vocabulary shared by the API and the mobile client.
 *
 * These are the values that v1 stored as bare strings and validated nowhere,
 * which is how `visibility_gender` ended up written but never read.
 */

export const ATTENDEE_STATUSES = ["pending", "accepted", "denied"] as const;
export type AttendeeStatus = (typeof ATTENDEE_STATUSES)[number];

export const INVITE_STATUSES = ["pending", "accepted", "declined"] as const;
export type InviteStatus = (typeof INVITE_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  "invite",
  "join_request",
  "cohost_added",
  "new_message",
  "request_accepted",
  "rate_attendees",
  "user_report",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** A caller's relationship to a lunch. Every authorization decision resolves to one of these. */
export const LUNCH_ROLES = ["host", "co_host", "attendee", "invitee", "none"] as const;
export type LunchRole = (typeof LUNCH_ROLES)[number];

export const RATING_MIN = 1;
export const RATING_MAX = 5;

/** Ratings below this require a written comment. */
export const RATING_COMMENT_REQUIRED_BELOW = 3;

/** Reports must be at least this many words, mirroring v1's client-side rule. */
export const REPORT_MIN_WORDS = 50;

/** Hours after a lunch ends before attendees are prompted to rate each other. */
export const RATING_PROMPT_DELAY_HOURS = 2;

/** Distinct lunches a user must be rated across before suspension is evaluated. */
export const SUSPENSION_MIN_LUNCHES = 3;

/** Average rating at or below which a user is suspended. */
export const SUSPENSION_RATING_THRESHOLD = 3;
