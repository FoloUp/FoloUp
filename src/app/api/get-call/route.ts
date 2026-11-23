import { logger } from "@/lib/logger";
import { generateInterviewAnalytics } from "@/services/analytics.service";
import { ResponseAdminService } from "@/services/responses-admin.service";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Retell from "retell-sdk";

const retell = new Retell({
  apiKey: process.env.RETELL_API_KEY || "",
});

export async function POST(req: Request) {
  logger.info("get-call request received");

  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const callDetails = await ResponseAdminService.getResponseByCallId(body.id);

    if (!callDetails) {
      return NextResponse.json({ error: "Response not found" }, { status: 404 });
    }

    let callResponse = callDetails.details;

    if (callDetails.is_analysed) {
      return NextResponse.json(
        {
          callResponse,
          analytics: callDetails.analytics,
        },
        { status: 200 },
      );
    }

    const callOutput: any = await retell.call.retrieve(body.id);
    const interviewId = callDetails.interview_id;
    callResponse = callOutput;

    const duration = Math.round(
      (callOutput.end_timestamp ?? 0) / 1000 - (callOutput.start_timestamp ?? 0) / 1000,
    );

    const result = await generateInterviewAnalytics({
      callId: body.id,
      interviewId: interviewId,
      transcript: callOutput.transcript,
    });

    if (!("analytics" in result) || !result.analytics) {
      logger.error("Analytics generation failed");

      return NextResponse.json({ error: "Failed to generate analytics" }, { status: 500 });
    }

    const analytics = result.analytics;

    await ResponseAdminService.saveResponse(
      {
        details: callResponse,
        is_analysed: true,
        duration: duration,
        analytics: analytics,
      },
      body.id,
    );

    logger.info("Call analysed successfully");

    return NextResponse.json(
      {
        callResponse,
        analytics,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[get-call] error:", error);

    return NextResponse.json({ error: "Failed to get call" }, { status: 500 });
  }
}
