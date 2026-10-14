import { NextRequest, NextResponse } from "next/server";
import { createJob, listJobs } from "@/lib/data";
import type { JobType } from "@/lib/types";

const jobTypes: JobType[] = ["Full-time", "Part-time", "Contract", "Remote"];

function authorized(request: NextRequest): boolean {
  const expected = process.env.RECRUITER_API_KEY ?? (process.env.NODE_ENV === "production" ? "" : "careerhub-demo-key");
  return Boolean(expected && request.headers.get("x-recruiter-key") === expected);
}

export async function GET(request: NextRequest) {
  try {
    const jobs = await listJobs(request.nextUrl.searchParams.get("q") ?? "");
    return NextResponse.json({ jobs });
  } catch {
    return NextResponse.json({ error: "Unable to load jobs" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Recruiter authorization required" }, { status: 401 });
  try {
    const body = await request.json();
    const required = ["title", "company", "location", "salary", "description"] as const;
    if (required.some((field) => typeof body[field] !== "string" || !body[field].trim()) || !jobTypes.includes(body.type) || !Array.isArray(body.tags)) {
      return NextResponse.json({ error: "Please provide all required job details" }, { status: 400 });
    }
    const job = await createJob({
      title: body.title.trim().slice(0, 120), company: body.company.trim().slice(0, 120),
      location: body.location.trim().slice(0, 120), type: body.type,
      salary: body.salary.trim().slice(0, 80), description: body.description.trim().slice(0, 5000),
      tags: body.tags.filter((tag: unknown): tag is string => typeof tag === "string").slice(0, 8).map((tag: string) => tag.trim().slice(0, 40)),
    });
    return NextResponse.json({ job }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to create job" }, { status: 500 });
  }
}