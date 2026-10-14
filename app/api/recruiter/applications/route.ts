import { NextRequest, NextResponse } from "next/server";
import { listApplications } from "@/lib/data";

export async function GET(request: NextRequest) {
  const expected = process.env.RECRUITER_API_KEY ?? (process.env.NODE_ENV === "production" ? "" : "careerhub-demo-key");
  if (!expected || request.headers.get("x-recruiter-key") !== expected) return NextResponse.json({ error: "Recruiter authorization required" }, { status: 401 });
  try {
    return NextResponse.json({ applications: await listApplications() });
  } catch {
    return NextResponse.json({ error: "Unable to load applications" }, { status: 500 });
  }
}