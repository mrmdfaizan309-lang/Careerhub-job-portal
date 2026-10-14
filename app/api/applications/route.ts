import { NextRequest, NextResponse } from "next/server";
import { createApplication } from "@/lib/data";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const resumeUrl = typeof body.resumeUrl === "string" ? body.resumeUrl.trim() : "";
    let validResumeUrl = !resumeUrl;
    try {
      const parsedUrl = new URL(resumeUrl);
      validResumeUrl = parsedUrl.protocol === "https:" || parsedUrl.protocol === "http:";
    } catch {
      validResumeUrl = !resumeUrl;
    }
    if (typeof body.jobId !== "string" || typeof body.name !== "string" || body.name.trim().length < 2 || body.name.length > 120 || typeof body.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) || body.email.length > 254 || (body.resumeUrl && (typeof body.resumeUrl !== "string" || body.resumeUrl.length > 2048)) || !validResumeUrl || (body.note && (typeof body.note !== "string" || body.note.length > 2000))) {
      return NextResponse.json({ error: "Enter a valid name and email address" }, { status: 400 });
    }
    const application = await createApplication({
      jobId: body.jobId, name: body.name.trim(), email: body.email.trim().toLowerCase(),
      resumeUrl, note: body.note?.trim() ?? "",
    });
    return NextResponse.json({ application: { id: application.id, jobTitle: application.jobTitle, company: application.company, status: application.status, createdAt: application.createdAt } }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "JOB_NOT_FOUND") return NextResponse.json({ error: "This job is no longer available" }, { status: 404 });
    if (error instanceof Error && (error.message === "DUPLICATE_APPLICATION" || ("code" in error && error.code === "23505"))) return NextResponse.json({ error: "You have already applied for this role" }, { status: 409 });
    return NextResponse.json({ error: "Unable to submit application" }, { status: 500 });
  }
}