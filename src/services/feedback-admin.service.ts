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

export interface FeedbackPayload {
  interview_id: string;
  satisfaction: number | null;
  feedback: string | null;
  email: string | null;
}

// Insert feedback using the service role, so the feedback table can keep
// row-level security enabled without a public insert/select policy.
export async function createFeedbackAdmin(payload: FeedbackPayload) {
  const { data, error } = await supabaseAdmin
    .from("feedback")
    .insert({
      interview_id: payload.interview_id,
      satisfaction: payload.satisfaction,
      feedback: payload.feedback,
      email: payload.email,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[createFeedbackAdmin] Supabase error:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    throw error;
  }

  return data;
}
