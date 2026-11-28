
import { auth } from "@clerk/nextjs/server";
import { INTERVIEWERS, RETELL_AGENT_GENERAL_PROMPT } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { ensureInterviewerAdmin } from "@/services/interviewers-admin.service";
import { type NextRequest, NextResponse } from "next/server";
import Retell from "retell-sdk";

const LISA_AGENT_ID = "agent_8f60e1e1c60ac07e29231b7b78";

export async function GET(_req: NextRequest) {
  logger.info("create-interviewer request received");

  let stage = "initialization";

  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    if (!process.env.RETELL_API_KEY) {
      throw new Error("RETELL_API_KEY is missing");
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing");
    }

    const retellClient = new Retell({
      apiKey: process.env.RETELL_API_KEY,
    });

    // Retrieve existing Lisa
    stage = "Retrieving existing Lisa agent";

    const lisaAgent = await retellClient.agent.retrieve(LISA_AGENT_ID);

    // Save or reuse Lisa
    stage = "Saving Lisa to Supabase";

    const newInterviewer = await ensureInterviewerAdmin({
      agent_id: lisaAgent.agent_id,
      ...INTERVIEWERS.LISA,
    });

    // Search for existing Bob


    stage = "Searching for existing Bob agent";

    const agentsResponse = await fetch(
      "https://api.retellai.com/v2/list-agents",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filter_criteria: {
            query: "Bob",
          },
        }),
      },
    );

    const agentsPayload = await agentsResponse.json();

    if (!agentsResponse.ok) {
      throw new Error(
        `Retell list agents failed: ${JSON.stringify(agentsPayload)}`,
      );
    }

    const agents = agentsPayload.items ?? [];

    let bobAgent = agents.find(
      (agent: { agent_name?: string | null }) =>
        agent.agent_name?.trim().toLowerCase() === "bob",
    );

    // Create Bob only if he does not exist
    if (!bobAgent) {
      stage = "Creating Bob Retell agent";

      const responseEngine = lisaAgent.response_engine;

      if (responseEngine.type !== "retell-llm") {
        throw new Error("Lisa does not use a Retell LLM response engine");
      }

      bobAgent = await retellClient.agent.create({
        response_engine: {
          type: "retell-llm",
          llm_id: responseEngine.llm_id,
        },
        voice_id: "11labs-Brian",
        agent_name: "Bob",
      });
    }

    // Save or reuse Bob
    stage = "Saving Bob to Supabase";

    const newSecondInterviewer = await ensureInterviewerAdmin({
      agent_id: bobAgent.agent_id,
      ...INTERVIEWERS.BOB,
    });

    logger.info("Default interviewers created or reused successfully");

    return NextResponse.json({
      success: true,
      newInterviewer,
      newSecondInterviewer,
    });

  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    logger.error(`Create interviewer failed at stage: ${stage}. ${message}`);

    return NextResponse.json(
      {
        success: false,
        stage,
        details: message,
      },
      { status: 500 },
    );
  }
}
