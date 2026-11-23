// Browser-side wrapper. All response data goes through the /api/responses route
// (service role on the server) because the `response` table is protected by
// row-level security. The exported API is unchanged, so callers don't need to change.

const call = async (body: Record<string, unknown>) => {
  const response = await fetch("/api/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(result?.error ?? `Request failed (${response.status})`);
  }

  return result?.data;
};

const createResponse = async (payload: any) => {
  try {
    return await call({ action: "create", payload });
  } catch (error) {
    console.error("[ResponseService] createResponse failed:", error);

    return [];
  }
};

const saveResponse = async (payload: any, call_id: string) => {
  try {
    return await call({ action: "save", payload, call_id });
  } catch (error) {
    console.error("[ResponseService] saveResponse failed:", error);

    return [];
  }
};

const updateResponse = async (payload: any, call_id: string) => {
  try {
    return await call({ action: "update", payload, call_id });
  } catch (error) {
    console.error("[ResponseService] updateResponse failed:", error);

    return [];
  }
};

const getAllResponses = async (interviewId: string): Promise<any[]> => {
  try {
    return (await call({ action: "getAll", interview_id: interviewId })) || [];
  } catch (error) {
    console.error("[ResponseService] getAllResponses failed:", error);

    return [];
  }
};

const getResponseCountByOrganizationId = async (organizationId: string): Promise<number> => {
  try {
    return (await call({ action: "countByOrg", organization_id: organizationId })) ?? 0;
  } catch (error) {
    console.error("[ResponseService] getResponseCountByOrganizationId failed:", error);

    return 0;
  }
};

const getAllEmailAddressesForInterview = async (interviewId: string): Promise<any[]> => {
  try {
    return (await call({ action: "getEmails", interview_id: interviewId })) || [];
  } catch (error) {
    console.error("[ResponseService] getAllEmails failed:", error);

    return [];
  }
};

const getResponseByCallId = async (id: string): Promise<any> => {
  try {
    return await call({ action: "getByCallId", call_id: id });
  } catch (error) {
    console.error("[ResponseService] getResponseByCallId failed:", error);

    return null;
  }
};

const deleteResponse = async (id: string) => {
  try {
    return await call({ action: "delete", call_id: id });
  } catch (error) {
    console.error("[ResponseService] deleteResponse failed:", error);

    return [];
  }
};

export const ResponseService = {
  createResponse,
  saveResponse,
  updateResponse,
  getAllResponses,
  getResponseByCallId,
  deleteResponse,
  getResponseCountByOrganizationId,
  getAllEmails: getAllEmailAddressesForInterview,
};
