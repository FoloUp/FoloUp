"use server";

import { SYSTEM_PROMPT, getInterviewAnalyticsPrompt } from "@/lib/prompts/analytics";
import { getInterviewByIdUnscopedAdmin } from "@/services/interviews-admin.service";
import { ResponseAdminService } from "@/services/responses-admin.service";
import type { Question } from "@/types/interview";
import type { Analytics } from "@/types/response";
import { OpenAI } from "openai";

export const generateInterviewAnalytics = async (payload: {
  callId: string;
  interviewId: string;
  transcript: string;
}) => {
  const { callId, interviewId, transcript } = payload;

  try {
    const response = await ResponseAdminService.getResponseByCallId(callId);
    const interview = await getInterviewByIdUnscopedAdmin(interviewId);

    if (response?.analytics) {
      return { analytics: response.analytics as Analytics, status: 200 };
    }

    const interviewTranscript = transcript || response?.details?.transcript;
    const questions = interview?.questions || [];

    const mainInterviewQuestions = questions
      .map((q: Question, index: number) => `${index + 1}. ${q.question}`)
      .join("\n");

    // Groq client using the OpenAI-compatible API
    const groq = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
      maxRetries: 5,
    });

    const prompt = getInterviewAnalyticsPrompt(
      interviewTranscript,
      mainInterviewQuestions
    );

    const baseCompletion = await groq.chat.completions.create({
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

    const basePromptOutput = baseCompletion.choices[0] || {};
    const content = basePromptOutput.message?.content || "";

    const analyticsResponse = JSON.parse(content);

    analyticsResponse.mainInterviewQuestions = questions.map(
      (q: Question) => q.question
    );

    return { analytics: analyticsResponse, status: 200 };
  } catch (error) {
    console.error("Error in Groq request:", error);
    return { error: "internal server error", status: 500 };
  }
};