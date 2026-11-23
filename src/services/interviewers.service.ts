import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

const supabase = createClientComponentClient();

const getAllInterviewers = async (clientId = "") => {
  try {
    const { data: clientData, error: clientError } = await supabase.from("interviewer").select("*");

    if (clientError) {
      console.error(`Error fetching interviewers for clientId ${clientId}:`, clientError);

      return [];
    }

    return clientData || [];
  } catch (error) {
    console.log(error);

    return [];
  }
};

const createInterviewer = async (payload: any) => {
  // Check for existing interviewer with the same name
  const { data: existingInterviewer, error: checkError } = await supabase
    .from("interviewer")
    .select("*")
    .eq("name", payload.name)
    .filter("agent_id", "eq", payload.agent_id)
    .single();

  if (checkError && checkError.code !== "PGRST116") {
    console.error("Error checking existing interviewer:", checkError);

    return null;
  }

  if (existingInterviewer) {
    console.error("An interviewer with this name already exists");

    return null;
  }

  const { error, data } = await supabase.from("interviewer").insert({ ...payload });

  if (error) {
    console.error("Error creating interviewer:", error);

    return null;
  }

  return data;
};


const getInterviewer = async (
  interviewerId: bigint | number | string | null | undefined
) => {
  if (
    interviewerId === null ||
    interviewerId === undefined ||
    String(interviewerId) === "0"
  ) {
    return null;
  }

  const { data: interviewerData, error: interviewerError } = await supabase
    .from("interviewer")
    .select("*")
    .eq("id", String(interviewerId))
    .maybeSingle();

  if (interviewerError) {
    console.error("[getInterviewer] Supabase error:", {
      message: interviewerError.message,
      details: interviewerError.details,
      hint: interviewerError.hint,
      code: interviewerError.code,
      interviewerId: String(interviewerId),
    });

    return null;
  }

  return interviewerData;
};

export const InterviewerService = {
  getAllInterviewers,
  createInterviewer,
  getInterviewer,
};
