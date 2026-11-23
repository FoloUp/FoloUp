
import { logger } from "@/lib/logger";
import {
  SYSTEM_PROMPT,
  getCommunicationAnalysisPrompt,
} from "@/lib/prompts/communication-analysis";
import { NextResponse } from "next/server";
import { OpenAI } from "openai";

export async function POST(req: Request) {
  logger.info("analyze-communication request received");

  try {
    const body = await req.json();
    const { transcript } = body;

    if (!transcript) {
      return NextResponse.json(
        { error: "Transcript is required" },
        { status: 400 },
      );
    }

    const client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
      maxRetries: 5,
    });

    const completion = await client.chat.completions.create({
      model: "qwen/qwen3.8-27b",
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: getCommunicationAnalysisPrompt(transcript),
        },
      ],
      response_format: { type: "json_object" },
    });

    const analysis = completion.choices[0]?.message?.content;

    logger.info("Communication analysis completed successfully");

    return NextResponse.json(
      { analysis: JSON.parse(analysis || "{}") },
      { status: 200 },
    );
  } catch (error) {
    logger.error("Error analyzing communication skills");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
