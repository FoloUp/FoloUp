
import { logger } from "@/lib/logger";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";

import {
  createInterviewAdmin,
  ensureOrganizationAdmin,
  ensureUserAdmin,
} from "@/services/interviews-admin.service";

const baseUrl = process.env.NEXT_PUBLIC_LIVE_URL;

export async function POST(req: Request) {
  try {
    logger.info("create-interview request received");

    const { userId, orgId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    if (!baseUrl) {
      throw new Error("NEXT_PUBLIC_LIVE_URL is missing");
    }

    const body = await req.json();
    const payload = body?.interviewData;

    if (!payload || typeof payload !== "object") {
      return NextResponse.json(
        { error: "Invalid interview data" },
        { status: 400 },
      );
    }

    const organizationName =
      typeof body.organizationName === "string"
        ? body.organizationName.trim()
        : null;

    // Get authenticated Clerk user
    const clerkUser = await currentUser();

    if (!clerkUser) {
      return NextResponse.json(
        { error: "Clerk user not found" },
        { status: 401 },
      );
    }

    const email =
      clerkUser.emailAddresses?.[0]?.emailAddress ?? null;

    // Step 1: Ensure organization exists
    if (orgId) {
      await ensureOrganizationAdmin(
        orgId,
        organizationName,
      );
    }

    // Step 2: Ensure user exists in Supabase
    logger.info("Ensuring user exists in Supabase");

    await ensureUserAdmin(
      userId,
      email,
      orgId ?? null,
    );

    // Step 3: Prepare interview
    const urlId = nanoid();
    const interviewUrl = `${baseUrl}/call/${urlId}`;

    let readableSlug: string | null = null;

    if (organizationName) {
      const interviewNameSlug = payload.name
        ?.toLowerCase()
        .trim()
        .replace(/\s+/g, "-");

      const orgNameSlug = organizationName
        .toLowerCase()
        .replace(/\s+/g, "-");

      readableSlug = interviewNameSlug
        ? `${orgNameSlug}-${interviewNameSlug}`
        : orgNameSlug;
    }

    const interviewPayload = {
      ...payload,
      user_id: userId,
      organization_id: orgId ?? null,
      id: urlId,
      url: interviewUrl,
      readable_slug: readableSlug,
    };

    // Step 4: Create interview
    const newInterview = await createInterviewAdmin(
      interviewPayload,
    );

    logger.info("Interview created successfully");

    return NextResponse.json(
      {
        success: true,
        response: "Interview created successfully",
        interview: newInterview,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[POST /api/create-interview] Error:", err);

    logger.error("Error creating interview");

    return NextResponse.json(
      {
        error: "Internal server error",
        details:
          err instanceof Error
            ? err.message
            : "Unknown error",
      },
      { status: 500 },
    );
  }
}
