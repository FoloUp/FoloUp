
import "server-only";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase server environment variables");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Ensure the Clerk organization exists in Supabase
export async function ensureOrganizationAdmin(
  organizationId: string,
  organizationName?: string | null,
) {
  const organizationPayload = {
    id: organizationId,
    ...(organizationName ? { name: organizationName } : {}),
  };

  const { data, error } = await supabaseAdmin
    .from("organization")
    .upsert(organizationPayload, { onConflict: "id" })
    .select("*")
    .single();

  if (error) {
    console.error("[ensureOrganizationAdmin] Supabase error:", error);
    throw error;
  }

  return data;
}

// Ensure the Clerk user exists in Supabase
export async function ensureUserAdmin(
  userId: string,
  email?: string | null,
  organizationId?: string | null,
) {
  const userPayload = {
    id: userId,
    ...(email ? { email } : {}),
    ...(organizationId ? { organization_id: organizationId } : {}),
  };

  const { data, error } = await supabaseAdmin
    .from("user")
    .upsert(userPayload, { onConflict: "id" })
    .select("*")
    .single();

  if (error) {
    console.error("[ensureUserAdmin] Supabase error:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    throw error;
  }

  return data;
}

// Create interview
export async function createInterviewAdmin(payload: any) {
  const interviewerId = payload?.interviewer_id;

  const normalizedPayload = {
    ...payload,
    ...(interviewerId !== undefined &&
    interviewerId !== null &&
    String(interviewerId) === "0"
      ? { interviewer_id: null }
      : {}),
  };

  const { data, error } = await supabaseAdmin
    .from("interview")
    .insert(normalizedPayload)
    .select("*")
    .single();

  if (error) {
    console.error("[createInterviewAdmin] Supabase error:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    throw error;
  }

  return data;
}

// Get interviews securely using Supabase Service Role
export async function getAllInterviewsAdmin(
  userId: string,
  organizationId?: string | null,
) {
  let query = supabaseAdmin
    .from("interview")
    .select("*")
    .order("created_at", { ascending: false });

  if (organizationId) {
    query = query.or(
      `organization_id.eq.${organizationId},user_id.eq.${userId}`
    );
  } else {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[getAllInterviewsAdmin] Supabase error:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    throw error;
  }

  return data || [];
}

// Get one interview securely using Supabase Service Role
// Supports both the actual interview ID and readable slug.
export async function getInterviewByIdAdmin(
  interviewId: string,
  userId: string,
  organizationId?: string | null,
) {
  const applyAccessFilter = (query: any) => {
    if (organizationId) {
      return query.or(
        `organization_id.eq.${organizationId},user_id.eq.${userId}`
      );
    }

    return query.eq("user_id", userId);
  };

  // First, search by the actual interview ID.
  let query = supabaseAdmin
    .from("interview")
    .select("*")
    .eq("id", interviewId);

  query = applyAccessFilter(query);

  const { data: interviewById, error: idError } =
    await query.maybeSingle();

  if (idError) {
    console.error("[getInterviewByIdAdmin] ID lookup error:", idError);
    throw idError;
  }

  if (interviewById) {
    return interviewById;
  }

  // If not found, search by readable_slug.
  let slugQuery = supabaseAdmin
    .from("interview")
    .select("*")
    .eq("readable_slug", interviewId);

  slugQuery = applyAccessFilter(slugQuery);

  const { data: interviewBySlug, error: slugError } =
    await slugQuery.maybeSingle();

  if (slugError) {
    console.error("[getInterviewByIdAdmin] Slug lookup error:", slugError);
    throw slugError;
  }

  return interviewBySlug;
}

// Trusted server-side lookup by the real interview id (no user filter).
// Only use where the id comes from our own DB rows (e.g. a response's interview_id).
export async function getInterviewByIdUnscopedAdmin(interviewId: string) {
  const { data, error } = await supabaseAdmin
    .from("interview")
    .select("*")
    .eq("id", interviewId)
    .maybeSingle();

  if (error) {
    console.error("[getInterviewByIdUnscopedAdmin] error:", error);
    throw error;
  }

  return data;
}

export async function updateInterviewInsightsAdmin(interviewId: string, insights: any) {
  const { error } = await supabaseAdmin
    .from("interview")
    .update({ insights })
    .eq("id", interviewId);

  if (error) {
    console.error("[updateInterviewInsightsAdmin] error:", error);
    throw error;
  }
}
