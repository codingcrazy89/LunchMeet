import { createContext, useContext, useEffect, useState } from "react";
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
  lunch_attendees: Attendee[];
  place_id?: string;
  restaurant_address?: string;
};

type LunchContextType = {
  lunches: LunchMeet[];
  loading: boolean;
  addLunch: (lunch: {
    restaurant: string;
    date_time: string;
    seats: number;
    description: string;
  }) => Promise<void>;
  joinLunch: (lunch: LunchMeet) => Promise<boolean>;
  acceptRequest: (lunchId: string, attendeeId: string) => Promise<void>;
  denyRequest: (lunchId: string, attendeeId: string) => Promise<void>;
  closeLunch: (lunch: LunchMeet) => Promise<void>;
  fetchLunches: () => Promise<void>;
};

const LunchContext = createContext<LunchContextType | undefined>(undefined);

export function LunchProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [lunches, setLunches] = useState<LunchMeet[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLunches = async () => {
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

    // Fetch host profiles separately
    const hostIds = [...new Set((data ?? []).map((lunch: any) => lunch.host_id))]
    const { data: hostProfiles } = await supabase
      .from("profiles")
      .select("id, name, age")
      .in("id", hostIds)
    
    const hostProfileMap = new Map(
      (hostProfiles ?? []).map((profile: any) => [profile.id, profile])
    )

    // Fetch attendee profiles separately
    const allAttendees = (data ?? []).flatMap((lunch: any) => 
      (lunch.lunch_attendees ?? []).map((a: any) => a.user_id)
    )
    const attendeeIds = [...new Set(allAttendees.filter(Boolean))]
    
    let attendeeProfileMap = new Map()
    if (attendeeIds.length > 0) {
      const { data: attendeeProfiles } = await supabase
        .from("profiles")
        .select("id, name, age")
        .in("id", attendeeIds)
      
      attendeeProfileMap = new Map(
        (attendeeProfiles ?? []).map((profile: any) => [profile.id, profile])
      )
    }

    // Normalize Supabase response
    const normalized: LunchMeet[] = (data ?? []).map((lunch: any) => ({
      ...lunch,
      host_profile: hostProfileMap.get(lunch.host_id) || null,
      lunch_attendees: (lunch.lunch_attendees ?? []).map((a: any) => {
        // Try to get profile from the relationship first, then fall back to separate fetch
        const profileFromRelation = a.profiles?.[0] || (Array.isArray(a.profiles) ? a.profiles[0] : a.profiles)
        const profileFromMap = a.user_id ? attendeeProfileMap.get(a.user_id) : null
        
        return {
          id: a.id,
          user_id: a.user_id,
          status: a.status || "accepted", // Default to accepted for backward compatibility
          profile: profileFromRelation || profileFromMap || null,
        }
      }),
    }));

    setLunches(normalized);
    setLoading(false);
  };

  useEffect(() => {
    fetchLunches();
  }, []);

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
      if (typeof window !== "undefined" && window.alert) {
        alert("You must be logged in to accept requests.");
      }
      return;
    }

    try {
      // Verify user is the host by querying the database
      console.log("Step 1: Verifying host...");
      const { data: lunchData, error: lunchFetchError } = await supabase
        .from("lunches")
        .select("host_id, seats")
        .eq("id", lunchId)
        .single();

      console.log("Lunch data:", lunchData, "Error:", lunchFetchError);

      if (lunchFetchError || !lunchData) {
        console.error("Error fetching lunch:", lunchFetchError);
        if (typeof window !== "undefined" && window.alert) {
          alert("Failed to verify lunch: " + (lunchFetchError?.message || "Unknown error"));
        }
        return;
      }

      if (lunchData.host_id !== user.id) {
        console.error("Cannot accept request: user is not the host", {
          lunchHostId: lunchData.host_id,
          currentUserId: user.id
        });
        if (typeof window !== "undefined" && window.alert) {
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
        if (typeof window !== "undefined" && window.alert) {
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
        if (typeof window !== "undefined" && window.alert) {
          alert("Request does not match this lunch.");
        }
        return;
      }

      if (existingAttendee.status === "accepted") {
        console.log("Request already accepted");
        if (typeof window !== "undefined" && window.alert) {
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
        if (typeof window !== "undefined" && window.alert) {
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
        if (typeof window !== "undefined" && window.alert) {
          alert("Update may have failed. Please refresh and try again.");
        }
        await fetchLunches();
        return;
      }

      if (verifyUpdate.status !== "accepted") {
        console.error("Update did not work - record still has status:", verifyUpdate.status);
        if (typeof window !== "undefined" && window.alert) {
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
      if (typeof window !== "undefined" && window.alert) {
        alert("An unexpected error occurred: " + (err.message || String(err)));
      }
    }
  };

  const denyRequest = async (lunchId: string, attendeeId: string) => {
    if (!user) {
      console.error("Cannot deny request: user not logged in");
      if (typeof window !== "undefined" && window.alert) {
        alert("You must be logged in to deny requests.");
      }
      return;
    }

    // Verify user is the host by querying the database
    const { data: lunchData, error: lunchFetchError } = await supabase
      .from("lunches")
      .select("host_id")
      .eq("id", lunchId)
      .single();

    if (lunchFetchError || !lunchData) {
      console.error("Error fetching lunch:", lunchFetchError);
      if (typeof window !== "undefined" && window.alert) {
        alert("Failed to verify lunch. Please try again.");
      }
      return;
    }

    if (lunchData.host_id !== user.id) {
      console.error("Cannot deny request: user is not the host");
      if (typeof window !== "undefined" && window.alert) {
        alert("Only the host can deny requests.");
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
      if (typeof window !== "undefined" && window.alert) {
        alert("Failed to deny request: " + deleteError.message);
      }
      return;
    }

    console.log("Request denied successfully");

    // Refresh the lunches list
    await fetchLunches();
    console.log("Lunches refreshed after denying request");
  };

  const closeLunch = async (lunch: LunchMeet) => {
    if (!user) return;
    if (lunch.host_id !== user.id) return;

    await supabase.from("lunches").delete().eq("id", lunch.id);
    fetchLunches();
  };

  return (
    <LunchContext.Provider
      value={{ lunches, loading, addLunch, joinLunch, acceptRequest, denyRequest, closeLunch, fetchLunches }}
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







