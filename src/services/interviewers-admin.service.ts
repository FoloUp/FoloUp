
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

// Get all interviewers
export async function getAllInterviewersAdmin() {
  const { data, error } = await supabaseAdmin
    .from("interviewer")
    .select("*")
    .order("id", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

// Create a new interviewer
export async function createInterviewerAdmin(payload: any) {
  const { data, error } = await supabaseAdmin
    .from("interviewer")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

// Create or reuse an interviewer using Retell agent ID
export async function ensureInterviewerAdmin(payload: any) {
  const { data: existing, error: findError } = await supabaseAdmin
    .from("interviewer")
    .select("*")
    .eq("agent_id", payload.agent_id)
    .maybeSingle();

  if (findError) {
    throw findError;
  }

  if (existing) {
    return existing;
  }

  return await createInterviewerAdmin(payload);
}
