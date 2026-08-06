import { createContext, useContext, useEffect, useState } from "react";
import { Alert } from "react-native";
import { useAuth } from "./AuthContext";
import { supabase } from "./lib/supabase";

export type Profile = {
  id: string;
  name: string;
  age: number | null;
};

export type Attendee = {
  id: string;
  profile: Profile | null;
  status?: "pending" | "accepted" | "denied";
  user_id?: string;
};

export type LunchMeet = {
  id: string;
  restaurant: string;
  date_time: string;
  seats: number;
  description: string;
  host_id: string;
  host_profile: Profile | null;
  co_host_profile?: Profile | null;
  lunch_attendees: Attendee[];
  place_id?: string;
  restaurant_address?: string;
  latitude?: number;
  longitude?: number;
  visibility_gender?: string[] | null;
  visibility_looking_for?: string[] | null;
  co_host_id?: string | null;
  is_public?: boolean | null;
};

type LunchContextType = {
  lunches: LunchMeet[];
  loading: boolean;
  fetchError: string | null;
  addLunch: (lunch: {
    restaurant: string;
    date_time: string;
    seats: number;
    description: string;
  }) => Promise<void>;
  joinLunch: (lunch: LunchMeet) => Promise<boolean>;
  acceptRequest: (lunchId: string, attendeeId: string) => Promise<void>;
  denyRequest: (lunchId: string, attendeeId: string) => Promise<void>;
  leaveLunch: (lunchId: string) => Promise<void>;
  closeLunch: (lunch: LunchMeet) => Promise<void>;
  submitRating: (ratedId: string, lunchId: string, rating: number, comment?: string) => Promise<boolean>;
  invites: Array<{ id: string; lunch_id: string; lunch: LunchMeet; inviter_profile: Profile | null }>;
  acceptInvite: (inviteId: string) => Promise<void>;
  declineInvite: (inviteId: string) => Promise<void>;
  fetchLunches: () => Promise<void>;
  fetchInvites: () => Promise<void>;
  version: number;
};

const LunchContext = createContext<LunchContextType | undefined>(undefined);

export function LunchProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [lunches, setLunches] = useState<LunchMeet[]>([]);
  const [invites, setInvites] = useState<Array<{ id: string; lunch_id: string; lunch: LunchMeet; inviter_profile: Profile | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const fetchLunches = async (retryCount = 0) => {
    console.log("[Lunch] fetchLunches started, retryCount:", retryCount);
    if (retryCount === 0) setFetchError(null);
    const maxRetries = 3;
    try {
    const { data, error } = await supabase
      .from("lunches")
      .select(`
        id,
        restaurant,
        date_time,
        seats,
        description,
        host_id,
        place_id,
        restaurant_address,
        latitude,
        longitude,
        visibility_gender,
        visibility_looking_for,
        co_host_id,
        is_public,
        lunch_attendees (
          id,
          user_id,
          status,
          profiles (
            id,
            name,
            age
          )
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("fetchLunches error", error);
      setLunches([]);
      setLoading(false);
      return;
    }

    // Use nested profiles only for attendees (no extra fetch). Host profiles: 1 query.
    const hostIds = [...new Set((data ?? []).flatMap((lunch: any) => [lunch.host_id, lunch.co_host_id].filter(Boolean)))];
    const hostProfileMap = new Map<string, Profile>();
    if (hostIds.length > 0) {
      const { data: hostProfiles } = await supabase.from("profiles").select("id, name, age").in("id", hostIds);
      (hostProfiles ?? []).forEach((p: any) => hostProfileMap.set(p.id, p));
    }

    const normalized: LunchMeet[] = (data ?? []).map((lunch: any) => ({
      ...lunch,
      host_profile: hostProfileMap.get(lunch.host_id) || null,
      co_host_profile: lunch.co_host_id ? hostProfileMap.get(lunch.co_host_id) || null : null,
      lunch_attendees: (lunch.lunch_attendees ?? []).map((a: any) => {
        const profileFromRelation = a.profiles?.[0] || (Array.isArray(a.profiles) ? a.profiles[0] : a.profiles);
        return {
          id: a.id,
          user_id: a.user_id,
          status: a.status || "accepted",
          profile: profileFromRelation || null,
        };
      }),
    }));

    // Phase 1 filter: skip myProfile fetch (defer visibility to background) - completes faster
    let filtered = normalized;
    if (!user) {
      filtered = normalized.filter((lunch: any) => lunch.is_public !== false);
    } else {
      filtered = normalized.filter((lunch: any) => {
        if (lunch.host_id === user.id || lunch.co_host_id === user.id) return true;
        if (lunch.is_public === false) {
          return (lunch.lunch_attendees || []).some(
            (a: any) => a.user_id === user.id && (a.status === "accepted" || !a.status)
          );
        }
        return true; // Show all public initially; visibility filter applied in background
      });
    }

    const newLunches = filtered.map((lunch: any) => ({
      ...lunch,
      lunch_attendees: (lunch.lunch_attendees || []).map((a: any) => ({ ...a }))
    }));
    setLunches(newLunches);
    setLoading(false);
    setVersion((v) => v + 1);

    // Defer fetchInvites to background (does not block initial display)
    if (user) setTimeout(() => fetchInvites(), 100);
    } catch (err) {
      console.warn("fetchLunches network error:", err);
      setLunches([]);
      setLoading(false);
      const msg = err instanceof Error ? err.message : String(err);
      const isTimeout = /timeout|abort|timed out/i.test(msg);
      setFetchError(isTimeout
        ? "Connection timed out. Try a different WiFi or tap Retry."
        : "Could not load lunches. Tap Retry to try again.");
      if (retryCount < maxRetries) {
        const delay = [2000, 5000, 10000][retryCount];
        setTimeout(() => fetchLunches(retryCount + 1), delay);
      }
    }
  };

  const fetchInvites = async () => {
    if (!user) {
      setInvites([]);
      return;
    }
    try {
    const { data: inviteData, error } = await supabase
      .from("lunch_invites")
      .select("id, lunch_id")
      .eq("invitee_id", user.id)
      .eq("status", "pending");

    if (error || !inviteData?.length) {
      setInvites([]);
      return;
    }

    const lunchIds = inviteData.map((i: any) => i.lunch_id);
    const { data: lunchesData } = await supabase
      .from("lunches")
      .select(`
        id, restaurant, date_time, seats, description, host_id, place_id,
        restaurant_address, latitude, longitude, visibility_gender, visibility_looking_for, co_host_id, is_public,
        lunch_attendees (id, user_id, status, profiles (id, name, age))
      `)
      .in("id", lunchIds);

    const hostIds = [...new Set((lunchesData ?? []).flatMap((l: any) => [l.host_id, l.co_host_id].filter(Boolean)))];
    const { data: hostProfiles } = await supabase
      .from("profiles")
      .select("id, name, age")
      .in("id", hostIds);
    const hostMap = new Map((hostProfiles ?? []).map((p: any) => [p.id, p]));

    const { data: inviteRows } = await supabase
      .from("lunch_invites")
      .select("id, lunch_id, inviter_id")
      .in("id", inviteData.map((i: any) => i.id));
    const inviterIds = [...new Set((inviteRows ?? []).map((i: any) => i.inviter_id))];
    const { data: inviterProfiles } = await supabase
      .from("profiles")
      .select("id, name, age")
      .in("id", inviterIds);
    const inviterMap = new Map((inviterProfiles ?? []).map((p: any) => [p.id, p]));

    const lunchMap = new Map(
      (lunchesData ?? []).map((l: any) => [
        l.id,
        {
          ...l,
          host_profile: hostMap.get(l.host_id) || null,
          co_host_profile: l.co_host_id ? hostMap.get(l.co_host_id) || null : null,
          lunch_attendees: (l.lunch_attendees ?? []).map((a: any) => ({
            id: a.id,
            user_id: a.user_id,
            status: a.status || "accepted",
            profile: a.profiles?.[0] || a.profiles,
          })),
        },
      ])
    );

    const result = (inviteRows ?? []).map((inv: any) => ({
      id: inv.id,
      lunch_id: inv.lunch_id,
      lunch: lunchMap.get(inv.lunch_id),
      inviter_profile: inviterMap.get(inv.inviter_id) || null,
    })).filter((x) => x.lunch);

    setInvites(result);
    } catch (err) {
      console.warn("fetchInvites network error:", err);
      setInvites([]);
    }
  };

  // Wait for auth to resolve, then only fetch when logged in — avoids timeout on login screen
  useEffect(() => {
    console.log("[Lunch] authLoading:", authLoading, "user:", !!user);
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      setLunches([]);
      return;
    }
    console.log("[Lunch] authLoading is false, user logged in, firing fetchLunches");
    fetchLunches();
  }, [authLoading, user]);

  useEffect(() => {
    if (authLoading) return;
    if (user) fetchInvites();
    else setInvites([]);
  }, [user, authLoading]);

  const addLunch = async (lunch: {
    restaurant: string;
    date_time: string;
    seats: number;
    description: string;
  }) => {
    if (!user) return;

    await supabase.from("lunches").insert({
      ...lunch,
      host_id: user.id,
    });

    fetchLunches();
  };

  const joinLunch = async (lunch: LunchMeet): Promise<boolean> => {
    if (!user) return false;
    if (lunch.host_id === user.id) return false;
    if (lunch.seats <= 0) return false;

    // Check if user already has a pending or accepted request
    const { data: existing } = await supabase
      .from("lunch_attendees")
      .select("id, status")
      .eq("lunch_id", lunch.id)
      .eq("user_id", user.id)
      .single();

    if (existing) {
      // Already requested or joined
      return false;
    }

    // Create pending request
    const { error } = await supabase.from("lunch_attendees").insert({
      lunch_id: lunch.id,
      user_id: user.id,
      status: "pending",
    });

    if (error) {
      console.error("Error creating join request:", error);
      return false;
    }

    fetchLunches();
    return true;
  };

  const acceptRequest = async (lunchId: string, attendeeId: string) => {
    console.log("=== ACCEPT REQUEST START ===");
    console.log("Parameters:", { lunchId, attendeeId, userId: user?.id });

    if (!user) {
      console.error("Cannot accept request: user not logged in");
      if (typeof window !== "undefined") {
        alert("You must be logged in to accept requests.");
      }
      return;
    }

    try {
      // Verify user is the host or co-host by querying the database
      console.log("Step 1: Verifying host or co-host...");
      const { data: lunchData, error: lunchFetchError } = await supabase
        .from("lunches")
        .select("host_id, co_host_id, seats")
        .eq("id", lunchId)
        .single();

      console.log("Lunch data:", lunchData, "Error:", lunchFetchError);

      if (lunchFetchError || !lunchData) {
        console.error("Error fetching lunch:", lunchFetchError);
        if (typeof window !== "undefined") {
          alert("Failed to verify lunch: " + (lunchFetchError?.message || "Unknown error"));
        }
        return;
      }

      const isHostOrCoHost = lunchData.host_id === user.id || lunchData.co_host_id === user.id;
      if (!isHostOrCoHost) {
        console.error("Cannot accept request: user is not the host", {
          lunchHostId: lunchData.host_id,
          currentUserId: user.id
        });
        if (typeof window !== "undefined") {
          alert("Only the host can accept requests.");
        }
        return;
      }

      console.log("Step 2: Host verified. Current seats:", lunchData.seats);

      // Update status to accepted
      console.log("Step 3: Finding attendee record to update...");
      // Try to find the attendee record - first by ID, then by user_id + lunch_id if needed
      let existingAttendee: any = null;
      let actualAttendeeId = attendeeId;

      // First try by ID
      const { data: attendeeById, error: checkByIdError } = await supabase
        .from("lunch_attendees")
        .select("*")
        .eq("id", attendeeId)
        .single();

      console.log("Attendee by ID (full record):", { attendeeById, checkByIdError });

      if (attendeeById) {
        existingAttendee = attendeeById;
      } else {
        // If not found by ID, try to find pending requests for this lunch
        console.log("Not found by ID, searching for pending requests for this lunch...");
        const { data: pendingAttendees, error: checkPendingError } = await supabase
          .from("lunch_attendees")
          .select("id, user_id, status, lunch_id")
          .eq("lunch_id", lunchId)
          .eq("status", "pending");

        console.log("Pending attendees for lunch:", { pendingAttendees, checkPendingError });

        if (pendingAttendees && pendingAttendees.length > 0) {
          // Use the first pending attendee (or match by some other criteria)
          // For now, let's use the one that matches the attendeeId if it's actually a user_id
          const matched = pendingAttendees.find((a: any) => a.id === attendeeId || a.user_id === attendeeId);
          if (matched) {
            existingAttendee = matched;
            actualAttendeeId = matched.id;
            console.log("Found attendee by alternative method:", existingAttendee);
          } else if (pendingAttendees.length === 1) {
            // If there's only one pending, use it
            existingAttendee = pendingAttendees[0];
            actualAttendeeId = pendingAttendees[0].id;
            console.log("Using only pending attendee:", existingAttendee);
          }
        }
      }

      if (!existingAttendee) {
        console.error("Attendee record not found with ID:", attendeeId);
        if (typeof window !== "undefined") {
          alert("Request not found. Please refresh the page and try again.");
        }
        await fetchLunches(); // Refresh to get latest data
        return;
      }

      if (existingAttendee.lunch_id !== lunchId) {
        console.error("Attendee lunch_id mismatch:", {
          expected: lunchId,
          actual: existingAttendee.lunch_id
        });
        if (typeof window !== "undefined") {
          alert("Request does not match this lunch.");
        }
        return;
      }

      if (existingAttendee.status === "accepted") {
        console.log("Request already accepted");
        if (typeof window !== "undefined") {
          alert("This request has already been accepted.");
        }
        await fetchLunches();
        return;
      }

      console.log("Step 4: Updating attendee status to accepted...", { 
        actualAttendeeId, 
        currentStatus: existingAttendee.status,
        lunchId: existingAttendee.lunch_id 
      });
      
      // Try using RPC function first (bypasses RLS), fallback to direct update
      let updateError: any = null;
      let updateWorked = false;
      
      try {
        const { error: rpcError } = await supabase.rpc("accept_attendee_request", {
          p_attendee_id: actualAttendeeId,
          p_lunch_id: lunchId
        });
        
        if (!rpcError) {
          console.log("Update succeeded via RPC function");
          updateWorked = true;
        } else {
          console.log("RPC function not available, trying direct update:", rpcError);
          updateError = rpcError;
        }
      } catch (rpcErr) {
        console.log("RPC function doesn't exist, using direct update");
      }
      
      // Fallback to direct update if RPC doesn't exist
      if (!updateWorked) {
        const { error: directUpdateError, count } = await supabase
          .from("lunch_attendees")
          .update({ status: "accepted" })
          .eq("id", actualAttendeeId)
          .eq("lunch_id", lunchId);
        
        updateError = directUpdateError;
        console.log("Direct update result:", { directUpdateError, count });
      }

      if (updateError && !updateWorked) {
        console.error("Error accepting request:", updateError);
        if (typeof window !== "undefined") {
          alert("Failed to accept request: " + updateError.message);
        }
        return;
      }

      // If RPC worked, skip verification and go straight to seat update
      if (updateWorked) {
        console.log("Step 5: Update succeeded via RPC. Updating seats...");
        // Seats are already decremented by the RPC function, so just refresh
        await fetchLunches();
        console.log("=== ACCEPT REQUEST COMPLETE ===");
        return;
      }
      
      // Verify the update worked by checking the record
      console.log("Verifying update worked...");
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay for DB consistency
      
      const { data: verifyUpdate, error: verifyError } = await supabase
        .from("lunch_attendees")
        .select("id, status, lunch_id")
        .eq("id", actualAttendeeId)
        .single();
      
      console.log("Verification after update:", { verifyUpdate, verifyError });
      
      if (verifyError || !verifyUpdate) {
        console.error("Could not verify update:", verifyError);
        if (typeof window !== "undefined") {
          alert("Update may have failed. Please refresh and try again.");
        }
        await fetchLunches();
        return;
      }

      if (verifyUpdate.status !== "accepted") {
        console.error("Update did not work - record still has status:", verifyUpdate.status);
        if (typeof window !== "undefined") {
          alert("Update failed. The request status is still: " + verifyUpdate.status + ". This might be a permissions issue. Please check your database Row Level Security policies.");
        }
        await fetchLunches();
        return;
      }

      console.log("Update verified successfully! Status is now:", verifyUpdate.status);

      console.log("Step 5: Creating chat room for lunch...");
      // Create or get chat room for this lunch
      try {
        const { data: chatRoomData, error: chatRoomError } = await supabase.rpc(
          "get_or_create_chat_room",
          { p_lunch_id: lunchId }
        );
        
        if (chatRoomError) {
          console.warn("Could not create chat room:", chatRoomError);
          // Don't fail the accept if chat creation fails
        } else {
          console.log("Chat room created/retrieved:", chatRoomData);
        }
      } catch (chatErr) {
        console.warn("Chat room function not available:", chatErr);
        // Try direct insert as fallback
        const { data: existingRoom } = await supabase
          .from("chat_rooms")
          .select("id")
          .eq("lunch_id", lunchId)
          .single();
        
        if (!existingRoom) {
          const { error: insertError } = await supabase
            .from("chat_rooms")
            .insert({ lunch_id: lunchId });
          
          if (insertError) {
            console.warn("Could not create chat room directly:", insertError);
          }
        }
      }

      console.log("Step 6: Request accepted successfully. Updating seats...");

      // Decrement seats - try direct update first (more reliable)
      const newSeats = Math.max(0, lunchData.seats - 1);
      console.log("Updating seats from", lunchData.seats, "to", newSeats);
      
      const { error: updateSeatsError, data: seatsUpdateData } = await supabase
        .from("lunches")
        .update({ seats: newSeats })
        .eq("id", lunchId)
        .select();

      console.log("Seats update result:", { seatsUpdateData, updateSeatsError });

      if (updateSeatsError) {
        console.error("Error updating seats:", updateSeatsError);
        // Don't return - still refresh the list even if seats update fails
      }

      // Refresh the lunches list
      console.log("Step 7: Refreshing lunches list...");
      await fetchLunches();
      console.log("=== ACCEPT REQUEST COMPLETE ===");
    } catch (err: any) {
      console.error("Unexpected error in acceptRequest:", err);
      if (typeof window !== "undefined") {
        alert("An unexpected error occurred: " + (err.message || String(err)));
      }
    }
  };

  const denyRequest = async (lunchId: string, attendeeId: string) => {
    if (!user) {
      console.error("Cannot deny request: user not logged in");
      if (typeof window !== "undefined") {
        alert("You must be logged in to deny requests.");
      }
      return;
    }

    // Verify user is the host or co-host by querying the database
    const { data: lunchData, error: lunchFetchError } = await supabase
      .from("lunches")
      .select("host_id, co_host_id")
      .eq("id", lunchId)
      .single();

    if (lunchFetchError || !lunchData) {
      console.error("Error fetching lunch:", lunchFetchError);
      if (typeof window !== "undefined") {
        alert("Failed to verify lunch. Please try again.");
      }
      return;
    }

    const isHostOrCoHost = lunchData.host_id === user.id || lunchData.co_host_id === user.id;
    if (!isHostOrCoHost) {
      console.error("Cannot deny request: user is not the host or co-host");
      if (typeof window !== "undefined") {
        alert("Only the host or co-host can deny requests.");
      }
      return;
    }

    console.log("Denying request:", { lunchId, attendeeId });

    // Try using RPC function first (bypasses RLS), fallback to direct delete
    let deleteError: any = null;
    let deleteWorked = false;
    
    try {
      const { error: rpcError } = await supabase.rpc("deny_attendee_request", {
        p_attendee_id: attendeeId,
        p_lunch_id: lunchId
      });
      
      if (!rpcError) {
        console.log("Delete succeeded via RPC function");
        deleteWorked = true;
      } else {
        console.log("RPC function not available, trying direct delete:", rpcError);
        deleteError = rpcError;
      }
    } catch (rpcErr) {
      console.log("RPC function doesn't exist, using direct delete");
    }
    
    // Fallback to direct delete if RPC doesn't exist
    if (!deleteWorked) {
      const { error, data } = await supabase
        .from("lunch_attendees")
        .delete()
        .eq("id", attendeeId)
        .eq("lunch_id", lunchId)
        .select();

      deleteError = error;
      console.log("Direct delete result:", { data, error });
    }

    if (deleteError && !deleteWorked) {
      console.error("Error denying request:", deleteError);
      if (typeof window !== "undefined") {
        alert("Failed to deny request: " + deleteError.message);
      }
      return;
    }

    console.log("Request denied successfully");

    // Refresh the lunches list
    await fetchLunches();
    console.log("Lunches refreshed after denying request");
  };

  const leaveLunch = async (lunchId: string) => {
    if (!user) {
      if (typeof window !== "undefined") {
        alert("You must be logged in to leave a lunch.");
      }
      return;
    }

    try {
      // Prefer RPC so delete + seats update happen in one transaction and persist
      let serverSuccess = false;

      const { error: rpcError } = await supabase.rpc("leave_lunch", {
        p_lunch_id: lunchId,
      });

      if (!rpcError) {
        serverSuccess = true;
      } else {
        console.log("leave_lunch RPC not available or failed, using direct delete/update:", rpcError);
      }

      if (!serverSuccess) {
        // Fallback: find attendee, delete row, update seats (requires RLS policy "Users can delete their own attendee record")
        const { data: attendeeRecord, error: findError } = await supabase
          .from("lunch_attendees")
          .select("id, lunch_id")
          .eq("lunch_id", lunchId)
          .eq("user_id", user.id)
          .or("status.eq.accepted,status.is.null")
          .maybeSingle();

        if (findError || !attendeeRecord) {
          console.error("Error finding attendee record:", findError);
          if (typeof window !== "undefined") {
            alert("Could not find your attendance record. You may have already left.");
          }
          await fetchLunches();
          return;
        }

        const { data: lunchData, error: lunchError } = await supabase
          .from("lunches")
          .select("seats")
          .eq("id", lunchId)
          .single();

        if (lunchError || !lunchData) {
          console.error("Error fetching lunch:", lunchError);
          if (typeof window !== "undefined") {
            alert("Failed to update lunch. Please try again.");
          }
          return;
        }

        const { error: deleteError } = await supabase
          .from("lunch_attendees")
          .delete()
          .eq("id", attendeeRecord.id);

        if (deleteError) {
          console.error("Error leaving lunch:", deleteError);
          if (typeof window !== "undefined") {
            alert("Failed to leave lunch. Please try again.");
          }
          return;
        }

        const { error: updateError } = await supabase
          .from("lunches")
          .update({ seats: lunchData.seats + 1 })
          .eq("id", lunchId);

        if (updateError) {
          console.error("Error updating seats:", updateError);
        }
        serverSuccess = true; // Delete succeeded; seats update is best-effort
      }

      if (!serverSuccess) return;

      // Update local state so the UI reflects the change immediately
      setLunches((prev) =>
        prev.map((lunch) =>
          lunch.id === lunchId
            ? {
                ...lunch,
                seats: lunch.seats + 1,
                lunch_attendees: lunch.lunch_attendees.filter(
                  (a) => a.user_id !== user.id
                ),
              }
            : lunch
        )
      );
      setVersion((v) => v + 1);

      try {
        Alert.alert("Success", "You have left the lunch meet.");
      } catch {
        if (typeof window !== "undefined") {
          alert("You have left the lunch meet.");
        }
      }
    } catch (err: any) {
      console.error("Unexpected error leaving lunch:", err);
      if (typeof window !== "undefined") {
        alert("An unexpected error occurred: " + (err.message || String(err)));
      }
    }
  };

  const closeLunch = async (lunch: LunchMeet) => {
    if (!user) return;
    const isHostOrCoHost = lunch.host_id === user.id || lunch.co_host_id === user.id;
    if (!isHostOrCoHost) return;

    await supabase.from("lunches").delete().eq("id", lunch.id);
    fetchLunches();
  };

  const submitRating = async (ratedId: string, lunchId: string, rating: number, comment?: string): Promise<boolean> => {
    if (!user) return false;
    if (rating < 1 || rating > 5) return false;

    const payload: Record<string, unknown> = {
      rater_id: user.id,
      rated_id: ratedId,
      lunch_id: lunchId,
      rating,
    };
    if (comment != null && comment.trim()) {
      payload.comment = comment.trim();
    }

    const { error } = await supabase.from("user_ratings").upsert(
      payload,
      {
        onConflict: "rater_id,rated_id,lunch_id",
      }
    );

    if (error) {
      console.error("Error submitting rating:", error);
      return false;
    }
    return true;
  };

  const acceptInvite = async (inviteId: string) => {
    if (!user) return;
    const invite = invites.find((i) => i.id === inviteId);
    if (!invite?.lunch) return;
    const lunch = invite.lunch;
    if (lunch.seats <= 0) {
      if (typeof window !== "undefined") {
        alert("This lunch is full.");
      }
      await declineInvite(inviteId);
      return;
    }
    const { error: insertError } = await supabase.from("lunch_attendees").insert({
      lunch_id: lunch.id,
      user_id: user.id,
      status: "accepted",
    });
    if (insertError) {
      if (typeof window !== "undefined") {
        alert("Could not join: " + insertError.message);
      }
      return;
    }
    await supabase.from("lunch_invites").update({ status: "accepted" }).eq("id", inviteId);
    await supabase.from("lunches").update({ seats: lunch.seats - 1 }).eq("id", lunch.id);
    await fetchInvites();
    await fetchLunches();
  };

  const declineInvite = async (inviteId: string) => {
    await supabase.from("lunch_invites").update({ status: "declined" }).eq("id", inviteId);
    await fetchInvites();
  };

  return (
    <LunchContext.Provider
      value={{ lunches, loading, fetchError, addLunch, joinLunch, acceptRequest, denyRequest, leaveLunch, closeLunch, submitRating, invites, acceptInvite, declineInvite, fetchLunches, fetchInvites, version }}
    >
      {children}
    </LunchContext.Provider>
  );
}

export function useLunches() {
  const context = useContext(LunchContext);
  if (!context) {
    throw new Error("useLunches must be used within LunchProvider");
  }
  return context;
}







