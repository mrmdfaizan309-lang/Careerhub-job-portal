import { NextRequest, NextResponse } from "next/server";
import { getApplication, updateApplicationStatus } from "@/lib/data";
import type { ApplicationStatus } from "@/lib/types";

const statuses: ApplicationStatus[] = ["New", "Reviewing", "Interview", "Offer", "Rejected"];

function authorized(request: NextRequest): boolean {
  const expected = process.env.RECRUITER_API_KEY ?? (process.env.NODE_ENV === "production" ? "" : "careerhub-demo-key");
  return Boolean(expected && request.headers.get("x-recruiter-key") === expected);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const application = await getApplication(id);
    if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });
    if (request.nextUrl.searchParams.get("tracking") !== application.id) return NextResponse.json({ error: "Invalid tracking reference" }, { status: 403 });
    return NextResponse.json({ application: { id: application.id, jobTitle: application.jobTitle, company: application.company, status: application.status, createdAt: application.createdAt } });
  } catch {
    return NextResponse.json({ error: "Unable to load application" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!authorized(request)) return NextResponse.json({ error: "Recruiter authorization required" }, { status: 401 });
  try {
    const body = await request.json();
    if (!statuses.includes(body.status)) return NextResponse.json({ error: "Invalid application status" }, { status: 400 });
    const { id } = await params;
    const application = await updateApplicationStatus(id, body.status);
    return application ? NextResponse.json({ application }) : NextResponse.json({ error: "Application not found" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Unable to update application" }, { status: 500 });
  }
}