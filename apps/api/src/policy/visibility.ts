import { sql, type SQL } from "drizzle-orm";
import { lunches } from "@lunchmeet/db";

/**
 * Which lunches a given viewer is allowed to see.
 *
 * This is the single most important function in the rebuild. v1 selected every
 * lunch and then filtered in client JavaScript:
 *
 *     // src/LunchContext.tsx, v1
 *     filtered = normalized.filter((lunch) => {
 *       if (lunch.is_public === false) { ...check attendance... }
 *       return true; // Show all public initially; visibility filter applied in background
 *     });
 *
 * The private rows had already crossed the network by then, and the promised
 * background visibility filter was never written, so `visibility_gender` and
 * `visibility_looking_for` were stored and never read by anything.
 *
 * Here it is a WHERE clause. Rows a viewer may not see are never selected, so
 * they cannot leak regardless of what the client does.
 */
export function visibleToViewer(viewerId: string): SQL {
  return sql`(
    ${lunches.hostId} = ${viewerId}
    or ${lunches.coHostId} = ${viewerId}
    or exists (
      select 1 from lunchmeet.lunch_attendees a
      where a.lunch_id = ${lunches.id} and a.user_id = ${viewerId}
    )
    or exists (
      select 1 from lunchmeet.lunch_invites i
      where i.lunch_id = ${lunches.id} and i.invitee_id = ${viewerId}
    )
    or (
      ${lunches.isPublic}
      and (
        ${lunches.visibilityGender} is null
        or coalesce((select p.gender from lunchmeet.profiles p where p.user_id = ${viewerId}), '')
             = any(${lunches.visibilityGender})
      )
      and (
        ${lunches.visibilityLookingFor} is null
        or coalesce((select p.looking_for from lunchmeet.profiles p where p.user_id = ${viewerId}), '{}')
             && ${lunches.visibilityLookingFor}
      )
    )
  )`;
}

/**
 * Lunches visible to a signed-out caller: public, unfiltered, nothing else.
 *
 * A lunch carrying visibility restrictions is hidden entirely rather than shown
 * to anonymous callers, since there is no profile to match against.
 */
export function visibleToAnonymous(): SQL {
  return sql`(
    ${lunches.isPublic}
    and ${lunches.visibilityGender} is null
    and ${lunches.visibilityLookingFor} is null
  )`;
}

/** Restricts a nearby search to a radius, using the earthdistance GiST index. */
export function withinRadius(latitude: number, longitude: number, metres: number): SQL {
  return sql`earth_box(ll_to_earth(${latitude}, ${longitude}), ${metres})
             @> ll_to_earth(${lunches.latitude}, ${lunches.longitude})`;
}

/** Great-circle distance in miles, for ordering and display. */
export function distanceMiles(latitude: number, longitude: number): SQL<number> {
  return sql<number>`(point(${lunches.longitude}, ${lunches.latitude})
                      <@> point(${longitude}, ${latitude}))`;
}
