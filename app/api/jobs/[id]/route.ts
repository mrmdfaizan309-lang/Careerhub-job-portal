import { NextResponse } from "next/server";
import { getJob } from "@/lib/data";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const job = await getJob(id);
    return job ? NextResponse.json({ job }) : NextResponse.json({ error: "Job not found" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Unable to load job" }, { status: 500 });
  }
}