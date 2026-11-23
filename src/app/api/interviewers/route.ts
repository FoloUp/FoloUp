
import { auth } from "@clerk/nextjs/server";
import { getAllInterviewersAdmin } from "@/services/interviewers-admin.service";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const interviewers = await getAllInterviewersAdmin();

    return NextResponse.json({
      success: true,
      interviewers,
    });
  } catch (error) {
    console.error("Get interviewers failed:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch interviewers",
      },
      { status: 500 }
    );
  }
}
