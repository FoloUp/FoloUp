
import { logger } from "@/lib/logger";
import {
  SYSTEM_PROMPT,
  createUserPrompt,
} from "@/lib/prompts/generate-insights";
import { getInterviewByIdAdmin, updateInterviewInsightsAdmin } from "@/services/interviews-admin.service";
import { ResponseAdminService } from "@/services/responses-admin.service";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { OpenAI } from "openai";

export async function POST(req: Request) {
  logger.info("generate-insights request received");

  try {
    const { userId, orgId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    if (!process.env.GROQ_API_KEY) {
      logger.error("GROQ_API_KEY is missing");
      return NextResponse.json(
        { error: "AI service is not configured" },
        { status: 500 },
      );
    }

    const interview = await getInterviewByIdAdmin(body.interviewId, userId, orgId ?? null);

    const responses = await ResponseAdminService.getAllResponses(body.interviewId);

    if (!interview) {
      return NextResponse.json(
        { error: "Interview not found" },
        { status: 404 },
      );
    }

    let callSummaries = "";

    if (responses) {
      for (const response of responses) {
        callSummaries +=
          response.details?.call_analysis?.call_summary || "";
      }
    }

    // Groq client using OpenAI-compatible API
    const groq = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
      maxRetries: 5,
    });

    const prompt = createUserPrompt(
      callSummaries,
      interview.name,
      interview.objective,
      interview.description,
    );

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;

    if (!content) {
      throw new Error("Groq returned an empty response");
    }

    const insightsResponse = JSON.parse(content);

    await updateInterviewInsightsAdmin(body.interviewId, insightsResponse.insights);

    logger.info("Insights generated successfully using Groq");

    return NextResponse.json(
      {
        response: content,
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error(
                  "Error generating insights",
                  error instanceof Error ? error : String(error),
                );
    return NextResponse.json(
      { error: "internal server error" },
      { status: 500 },
    );
  }
}
