import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";

// LOCAL TESTING ONLY: skip the session gate when DEV_AUTH_EMAIL is set.
export default process.env.DEV_AUTH_EMAIL
  ? (_req: NextRequest) => NextResponse.next()
  : auth;

export const config = {
  // Everything except auth endpoints and static assets requires a session.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
