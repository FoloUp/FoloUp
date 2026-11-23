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

// All response reads/writes run here with the service role, so the `response`
// table can keep row-level security enabled. Errors are logged (not swallowed
// silently) and re-thrown so the API layer can return a proper status code.

const createResponse = async (payload: any) => {
  const { error, data } = await supabaseAdmin.from("response").insert({ ...payload }).select("id");

  if (error) {
    console.error("[responses-admin] createResponse error:", error);
    throw error;
  }

  return data?.[0]?.id ?? null;
};

const saveResponse = async (payload: any, call_id: string) => {
  const { error } = await supabaseAdmin
    .from("response")
    .update({ ...payload })
    .eq("call_id", call_id);

  if (error) {
    console.error("[responses-admin] saveResponse error:", error);
    throw error;
  }

  return true;
};

const getAllResponses = async (interviewId: string) => {
  const { data, error } = await supabaseAdmin
    .from("response")
    .select("*")
    .eq("interview_id", interviewId)
    .or("details.is.null,details->call_analysis.not.is.null")
    .eq("is_ended", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[responses-admin] getAllResponses error:", error);
    throw error;
  }

  return data || [];
};

// Counts the responses that belong to the organization's interviews.
// (The previous version counted interview rows, not responses.)
const getResponseCountByOrganizationId = async (organizationId: string): Promise<number> => {
  const { count, error } = await supabaseAdmin
    .from("response")
    .select("id, interview!inner(organization_id)", { count: "exact", head: true })
    .eq("interview.organization_id", organizationId);

  if (error) {
    console.error("[responses-admin] getResponseCountByOrganizationId error:", error);
    throw error;
  }

  return count ?? 0;
};

const getAllEmailAddressesForInterview = async (interviewId: string) => {
  const { data, error } = await supabaseAdmin
    .from("response")
    .select("email")
    .eq("interview_id", interviewId);

  if (error) {
    console.error("[responses-admin] getAllEmails error:", error);
    throw error;
  }

  return data || [];
};

const getResponseByCallId = async (callId: string) => {
  const { data, error } = await supabaseAdmin
    .from("response")
    .select("*")
    .eq("call_id", callId)
    .maybeSingle();

  if (error) {
    console.error("[responses-admin] getResponseByCallId error:", error);
    throw error;
  }

  return data;
};

const deleteResponse = async (callId: string) => {
  const { error } = await supabaseAdmin.from("response").delete().eq("call_id", callId);

  if (error) {
    console.error("[responses-admin] deleteResponse error:", error);
    throw error;
  }

  return true;
};

export const ResponseAdminService = {
  createResponse,
  saveResponse,
  updateResponse: saveResponse,
  getAllResponses,
  getResponseByCallId,
  deleteResponse,
  getResponseCountByOrganizationId,
  getAllEmails: getAllEmailAddressesForInterview,
};
