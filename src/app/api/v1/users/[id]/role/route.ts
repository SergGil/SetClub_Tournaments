import { NextResponse } from "next/server";

import { updateUserRoleAction } from "@/lib/actions/users";
import { withApiErrorHandling } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

/** updateUserRoleAction throws plain Errors for business-rule violations (invalid role, self-demotion, protected superadmin) - mapped to 400 here since withApiErrorHandling only special-cases Unauthorized/Forbidden. */
export const PATCH = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const role = typeof body?.role === "string" ? body.role : "";

  try {
    await updateUserRoleAction(id, role, request);
  } catch (error) {
    if (error instanceof Error && !error.message.startsWith("Forbidden") && !error.message.startsWith("Unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  return NextResponse.json({ success: true });
});
