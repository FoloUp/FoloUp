
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getAllInterviewsAdmin } from "@/services/interviews-admin.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId, orgId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const interviews = await getAllInterviewsAdmin(
      userId,
      orgId ?? null
    );

    return NextResponse.json(
      {
        success: true,
        interviews,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("[GET /api/interviews] Error:", error);

    return NextResponse.json(
      { error: "Failed to fetch interviews" },
      { status: 500 }
    );
  }
}
