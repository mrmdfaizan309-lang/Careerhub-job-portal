export type JobType = "Full-time" | "Part-time" | "Contract" | "Remote";
export type ApplicationStatus = "New" | "Reviewing" | "Interview" | "Offer" | "Rejected";

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  type: JobType;
  salary: string;
  description: string;
  tags: string[];
  createdAt: string;
}

export interface JobApplication {
  id: string;
  jobId: string;
  jobTitle: string;
  company: string;
  name: string;
  email: string;
  resumeUrl: string;
  note: string;
  status: ApplicationStatus;
  createdAt: string;
}