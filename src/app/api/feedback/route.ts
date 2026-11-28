import { createFeedbackAdmin } from "@/services/feedback-admin.service";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const asNullableString = (value: unknown, maxLength: number) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : null;

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (typeof body?.interview_id !== "string" || !body.interview_id) {
      return NextResponse.json({ error: "interview_id is required" }, { status: 400 });
    }

    const satisfaction =
      typeof body.satisfaction === "number" && Number.isFinite(body.satisfaction)
        ? Math.round(body.satisfaction)
        : null;

    // Only whitelisted fields are inserted.
    const feedback = await createFeedbackAdmin({
      interview_id: body.interview_id,
      satisfaction,
      feedback: asNullableString(body.feedback, 5000),
      email: asNullableString(body.email, 320),
    });

    return NextResponse.json({ success: true, feedback }, { status: 200 });
  } catch (error) {
    console.error("[POST /api/feedback] Error:", error);

    return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
  }
}
