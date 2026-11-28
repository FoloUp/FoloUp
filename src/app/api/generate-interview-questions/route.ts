
import { logger } from "@/lib/logger";
import {
  SYSTEM_PROMPT,
  generateQuestionsPrompt,
} from "@/lib/prompts/generate-questions";
import { NextResponse } from "next/server";
import { OpenAI } from "openai";

export const maxDuration = 60;

export async function POST(req: Request) {
  logger.info("generate-interview-questions request received");

  try {
    const body = await req.json();

    const client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
      maxRetries: 5,
    });

    const completion = await client.chat.completions.create({
      model: "qwen/qwen3.8-27b",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: generateQuestionsPrompt(body) },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;

    logger.info("Interview questions generated successfully");

    return NextResponse.json(
      { response: content },
      { status: 200 },
    );
  } catch (error) {
    logger.error("Error generating interview questions");
    return NextResponse.json(
      { error: "internal server error" },
      { status: 500 },
    );
  }
}
