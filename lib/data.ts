import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Pool } from "pg";
import type { ApplicationStatus, Job, JobApplication } from "@/lib/types";

interface Store {
  jobs: Job[];
  applications: JobApplication[];
}

const dataPath = path.join(process.cwd(), ".data", "careerhub.json");
const sampleJobs: Job[] = [
  { id: "job-northstar", title: "Senior Product Designer", company: "Northstar Studio", location: "New York, NY · Hybrid", type: "Full-time", salary: "$145k–$175k", description: "Shape the next generation of tools that help ambitious teams do their best work. You will partner closely with product and engineering from discovery through launch.", tags: ["Figma", "Product strategy", "Design systems"], createdAt: "2026-09-25T12:00:00.000Z" },
  { id: "job-sundial", title: "Staff Software Engineer", company: "Sundial Health", location: "Remote · US", type: "Remote", salary: "$180k–$220k", description: "Build thoughtful, reliable software that makes care easier to access. Lead technical direction across a small, collaborative platform team.", tags: ["TypeScript", "Node.js", "PostgreSQL"], createdAt: "2026-09-24T12:00:00.000Z" },
  { id: "job-common", title: "People Operations Lead", company: "Common Ground", location: "Austin, TX · Hybrid", type: "Full-time", salary: "$105k–$130k", description: "Create the systems and experiences that let a growing, distributed team feel connected and do meaningful work.", tags: ["People ops", "Culture", "Scale-up"], createdAt: "2026-09-23T12:00:00.000Z" },
  { id: "job-tide", title: "Brand Copywriter", company: "Tide & Timber", location: "Portland, OR · Remote", type: "Contract", salary: "$70–$90 / hr", description: "Find a distinct voice for a new generation of responsible outdoor products. Work with a small creative team on a six-month launch project.", tags: ["Brand voice", "Campaigns", "Outdoor"], createdAt: "2026-09-22T12:00:00.000Z" },
  { id: "job-morrow", title: "Data Analyst", company: "Morrow Finance", location: "Chicago, IL · Hybrid", type: "Full-time", salary: "$115k–$140k", description: "Turn complex customer and market data into clear decisions. Build trusted reporting and partner directly with business leaders.", tags: ["SQL", "Analytics", "Python"], createdAt: "2026-09-21T12:00:00.000Z" },
  { id: "job-fieldwork", title: "Customer Success Associate", company: "Fieldwork", location: "Remote · North America", type: "Part-time", salary: "$38–$48 / hr", description: "Help independent businesses get more value from the tools they use every day. Flexible hours with a kind, customer-first team.", tags: ["Customer care", "SaaS", "Communication"], createdAt: "2026-09-20T12:00:00.000Z" },
];

let poolPromise: Promise<Pool> | undefined;

async function getPool(): Promise<Pool> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  poolPromise ??= import("pg").then(({ Pool }) => new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  }));
  const pool = await poolPromise;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, company TEXT NOT NULL,
      location TEXT NOT NULL, type TEXT NOT NULL, salary TEXT NOT NULL,
      description TEXT NOT NULL, tags JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      name TEXT NOT NULL, email TEXT NOT NULL, resume_url TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'New',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(job_id, email)
    );
  `);
  const existingJobs = await pool.query("SELECT 1 FROM jobs LIMIT 1");
  if (!existingJobs.rowCount) {
    for (const job of sampleJobs) {
      await pool.query(`INSERT INTO jobs (id,title,company,location,type,salary,description,tags,created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
      [job.id, job.title, job.company, job.location, job.type, job.salary, job.description, JSON.stringify(job.tags), job.createdAt]);
    }
  }
  return pool;
}

async function readStore(): Promise<Store> {
  try {
    return JSON.parse(await readFile(dataPath, "utf8")) as Store;
  } catch {
    return { jobs: sampleJobs, applications: [] };
  }
}

async function writeStore(store: Store): Promise<void> {
  await mkdir(path.dirname(dataPath), { recursive: true });
  await writeFile(dataPath, JSON.stringify(store, null, 2), "utf8");
}

function mapJob(row: Record<string, unknown>): Job {
  return {
    id: String(row.id), title: String(row.title), company: String(row.company),
    location: String(row.location), type: row.type as Job["type"], salary: String(row.salary),
    description: String(row.description), tags: row.tags as string[],
    createdAt: new Date(String(row.created_at ?? row.createdAt)).toISOString(),
  };
}

function mapApplication(row: Record<string, unknown>): JobApplication {
  return {
    id: String(row.id), jobId: String(row.job_id ?? row.jobId),
    jobTitle: String(row.job_title ?? row.jobTitle), company: String(row.company),
    name: String(row.name), email: String(row.email), resumeUrl: String(row.resume_url ?? row.resumeUrl ?? ""),
    note: String(row.note ?? ""), status: row.status as ApplicationStatus,
    createdAt: new Date(String(row.created_at ?? row.createdAt)).toISOString(),
  };
}

export async function listJobs(query = ""): Promise<Job[]> {
  if (process.env.DATABASE_URL) {
    const pool = await getPool();
    const result = await pool.query(`SELECT * FROM jobs
      WHERE $1 = '' OR title ILIKE $2 OR company ILIKE $2 OR location ILIKE $2 OR EXISTS
      (SELECT 1 FROM jsonb_array_elements_text(tags) tag WHERE tag ILIKE $2)
      ORDER BY created_at DESC`, [query.trim(), `%${query.trim()}%`]);
    return result.rows.map(mapJob);
  }
  const store = await readStore();
  const needle = query.trim().toLowerCase();
  return store.jobs.filter((job) => !needle || [job.title, job.company, job.location, ...job.tags].some((value) => value.toLowerCase().includes(needle))).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getJob(id: string): Promise<Job | null> {
  if (process.env.DATABASE_URL) {
    const pool = await getPool();
    const result = await pool.query("SELECT * FROM jobs WHERE id = $1", [id]);
    return result.rows[0] ? mapJob(result.rows[0]) : null;
  }
  return (await readStore()).jobs.find((job) => job.id === id) ?? null;
}

export async function createJob(input: Omit<Job, "id" | "createdAt">): Promise<Job> {
  const job: Job = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
  if (process.env.DATABASE_URL) {
    const pool = await getPool();
    const result = await pool.query(`INSERT INTO jobs (id,title,company,location,type,salary,description,tags)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [job.id, job.title, job.company, job.location, job.type, job.salary, job.description, JSON.stringify(job.tags)]);
    return mapJob(result.rows[0]);
  }
  const store = await readStore();
  store.jobs.unshift(job);
  await writeStore(store);
  return job;
}

export async function createApplication(input: Pick<JobApplication, "jobId" | "name" | "email" | "resumeUrl" | "note">): Promise<JobApplication> {
  const job = await getJob(input.jobId);
  if (!job) throw new Error("JOB_NOT_FOUND");
  const application: JobApplication = { ...input, id: randomUUID(), jobTitle: job.title, company: job.company, status: "New", createdAt: new Date().toISOString() };
  if (process.env.DATABASE_URL) {
    const pool = await getPool();
    const result = await pool.query(`INSERT INTO applications (id,job_id,name,email,resume_url,note)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [application.id, application.jobId, application.name, application.email.toLowerCase(), application.resumeUrl, application.note]);
    return mapApplication({ ...result.rows[0], job_title: job.title, company: job.company });
  }
  const store = await readStore();
  if (store.applications.some((item) => item.jobId === input.jobId && item.email.toLowerCase() === input.email.toLowerCase())) throw new Error("DUPLICATE_APPLICATION");
  store.applications.unshift(application);
  await writeStore(store);
  return application;
}

export async function getApplication(id: string): Promise<JobApplication | null> {
  if (process.env.DATABASE_URL) {
    const pool = await getPool();
    const result = await pool.query(`SELECT a.*,j.title AS job_title,j.company FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.id=$1`, [id]);
    return result.rows[0] ? mapApplication(result.rows[0]) : null;
  }
  return (await readStore()).applications.find((item) => item.id === id) ?? null;
}

export async function listApplications(): Promise<JobApplication[]> {
  if (process.env.DATABASE_URL) {
    const pool = await getPool();
    const result = await pool.query(`SELECT a.*,j.title AS job_title,j.company FROM applications a JOIN jobs j ON j.id=a.job_id ORDER BY a.created_at DESC`);
    return result.rows.map(mapApplication);
  }
  return (await readStore()).applications;
}

export async function updateApplicationStatus(id: string, status: ApplicationStatus): Promise<JobApplication | null> {
  if (process.env.DATABASE_URL) {
    const pool = await getPool();
    const result = await pool.query(`UPDATE applications SET status=$2 WHERE id=$1 RETURNING *`, [id, status]);
    return result.rows[0] ? getApplication(id) : null;
  }
  const store = await readStore();
  const application = store.applications.find((item) => item.id === id);
  if (!application) return null;
  application.status = status;
  await writeStore(store);
  return application;
}