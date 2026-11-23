import { ResponseAdminService } from "@/services/responses-admin.service";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const pick = (source: any, keys: string[]) => {
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    if (source && Object.prototype.hasOwnProperty.call(source, key)) {
      result[key] = source[key];
    }
  }

  return result;
};

// Fields the browser is allowed to write. Analysis results (details, analytics,
// is_analysed, duration) are only ever written by server code.
const CREATE_FIELDS = ["interview_id", "call_id", "email", "name"];
const UPDATE_FIELDS = ["is_ended", "tab_switch_count", "is_viewed", "candidate_status"];

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    switch (body?.action) {
      case "create": {
        const id = await ResponseAdminService.createResponse(pick(body.payload, CREATE_FIELDS));

        return NextResponse.json({ data: id });
      }
      case "save":
      case "update": {
        if (typeof body.call_id !== "string" || !body.call_id) {
          return NextResponse.json({ error: "call_id is required" }, { status: 400 });
        }
        await ResponseAdminService.saveResponse(pick(body.payload, UPDATE_FIELDS), body.call_id);

        return NextResponse.json({ data: true });
      }
      case "getAll": {
        const data = await ResponseAdminService.getAllResponses(String(body.interview_id));

        return NextResponse.json({ data });
      }
      case "getByCallId": {
        const data = await ResponseAdminService.getResponseByCallId(String(body.call_id));

        return NextResponse.json({ data });
      }
      case "getEmails": {
        const data = await ResponseAdminService.getAllEmails(String(body.interview_id));

        return NextResponse.json({ data });
      }
      case "countByOrg": {
        const data = await ResponseAdminService.getResponseCountByOrganizationId(
          String(body.organization_id),
        );

        return NextResponse.json({ data });
      }
      case "delete": {
        await ResponseAdminService.deleteResponse(String(body.call_id));

        return NextResponse.json({ data: true });
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("[POST /api/responses] Error:", error);

    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
