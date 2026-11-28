import { logger } from "@/lib/logger";
import { getAllInterviewersAdmin } from "@/services/interviewers-admin.service";
import { NextResponse } from "next/server";
import Retell from "retell-sdk";

const retellClient = new Retell({
  apiKey: process.env.RETELL_API_KEY || "",
});

export async function POST(req: Request) {
  logger.info("register-call request received");

  try {
    const body = await req.json();
    const interviewerId = body.interviewer_id;

    const interviewers = await getAllInterviewersAdmin();

    const hasInterviewerId =
      interviewerId !== null && interviewerId !== undefined && String(interviewerId) !== "0";

    // Use the interview's interviewer; if it has none (interviewer_id is null),
    // fall back to the first available interviewer instead of failing.
    const interviewer =
      (hasInterviewerId
        ? interviewers.find((item: any) => String(item.id) === String(interviewerId))
        : undefined) ?? interviewers[0];

    if (!interviewer?.agent_id) {
      logger.error("No interviewer with a Retell agent_id is available");

      return NextResponse.json(
        {
          error:
            "No interviewer is configured. Open Dashboard > Interviewers and create the default interviewers first.",
        },
        { status: 400 },
      );
    }

    const registerCallResponse = await retellClient.call.createWebCall({
      agent_id: interviewer.agent_id,
      retell_llm_dynamic_variables: body.dynamic_data,
    });

    logger.info("Call registered successfully");

    return NextResponse.json({ registerCallResponse }, { status: 200 });
  } catch (error) {
    logger.error("Failed to register call");
    console.error("[register-call] error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to register call" },
      { status: 500 },
    );
  }
}
