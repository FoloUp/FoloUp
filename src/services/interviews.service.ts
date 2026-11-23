import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

const supabase = createClientComponentClient();

const normalizeInterviewPayload = (payload: any) => {
  const id = payload?.interviewer_id;
  if (id === undefined || id === null) {
    return payload;
  }
  if (String(id) === "0") {
    return { ...payload, interviewer_id: null };
  }

  return payload;
};


const getAllInterviews = async (
  userId: string,
  organizationId: string
) => {
  try {
    const response = await fetch("/api/interviews", {
      method: "GET",
      cache: "no-store",
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result?.error || "Failed to fetch interviews"
      );
    }

    console.log("[getAllInterviews] API result:", {
      count: result.interviews?.length ?? 0,
      interviews: result.interviews,
    });

    return result.interviews || [];
  } catch (error) {
    console.error("[getAllInterviews] Failed:", error);
    throw error;
  }
};



const getInterviewById = async (id: string) => {
  try {
    const response = await fetch(
      `/api/interviews/${encodeURIComponent(id)}`,
      {
        method: "GET",
        cache: "no-store",
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result?.error || "Failed to fetch interview"
      );
    }

    return result.interview;
  } catch (error) {
    console.error("[getInterviewById] Failed:", error);
    throw error;
  }
};

const updateInterview = async (payload: any, id: string) => {
  const normalizedPayload = normalizeInterviewPayload(payload);
  const { error, data } = await supabase
    .from("interview")
    .update({ ...normalizedPayload })
    .eq("id", id);
  if (error) {
    console.log(error);

    return [];
  }

  return data;
};

const deleteInterview = async (id: string) => {
  const { error, data } = await supabase.from("interview").delete().eq("id", id);
  if (error) {
    console.log(error);

    return [];
  }

  return data;
};

const getAllRespondents = async (interviewId: string) => {
  try {
    const { data, error } = await supabase
      .from("interview")
      .select("respondents")
      .eq("interview_id", interviewId);

    return data || [];
  } catch (error) {
    console.log(error);

    return [];
  }
};

const createInterview = async (payload: any) => {
  const normalizedPayload = normalizeInterviewPayload(payload);
  const { error, data } = await supabase.from("interview").insert({ ...normalizedPayload });
  if (error) {
    console.log(error);

    return [];
  }

  return data;
};

const deactivateInterviewsByOrgId = async (organizationId: string) => {
  try {
    const { error } = await supabase
      .from("interview")
      .update({ is_active: false })
      .eq("organization_id", organizationId)
      .eq("is_active", true); // Optional: only update if currently active

    if (error) {
      console.error("Failed to deactivate interviews:", error);
    }
  } catch (error) {
    console.error("Unexpected error disabling interviews:", error);
  }
};

export const InterviewService = {
  getAllInterviews,
  getInterviewById,
  updateInterview,
  deleteInterview,
  getAllRespondents,
  createInterview,
  deactivateInterviewsByOrgId,
};
