"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, BriefcaseBusiness, Building2, Check, ChevronDown, CirclePlus, Clock3, MapPin, Search, Sparkles, X } from "lucide-react";
import type { ApplicationStatus, Job, JobApplication, JobType } from "@/lib/types";

const jobTypes: JobType[] = ["Full-time", "Part-time", "Contract", "Remote"];
const statuses: ApplicationStatus[] = ["New", "Reviewing", "Interview", "Offer", "Rejected"];

type TrackingItem = { id: string; title: string; company: string; status: ApplicationStatus };

export default function HomePage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All roles");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [panel, setPanel] = useState<"apply" | "track" | "recruiter" | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [trackingId, setTrackingId] = useState("");
  const [trackingResult, setTrackingResult] = useState<TrackingItem | null>(null);
  const [recruiterKey, setRecruiterKey] = useState("");
  const [recruiterUnlocked, setRecruiterUnlocked] = useState(false);
  const [jobForm, setJobForm] = useState({ title: "", company: "", location: "", type: "Full-time" as JobType, salary: "", description: "", tags: "" });
  const [applicationForm, setApplicationForm] = useState({ name: "", email: "", resumeUrl: "", note: "" });
  const [submitting, setSubmitting] = useState(false);

  async function loadJobs(search = query) {
    setLoading(true);
    try {
      const response = await fetch(`/api/jobs?q=${encodeURIComponent(search)}`);
      const data = await response.json();
      setJobs(data.jobs ?? []);
    } catch {
      setNotice("We couldn't reach the job board. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function loadRecruiterData(key = recruiterKey) {
    const response = await fetch("/api/recruiter/applications", { headers: { "x-recruiter-key": key } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Recruiter access could not be verified");
    setApplications(data.applications ?? []);
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/jobs?q=")
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load jobs");
        const data = await response.json();
        if (!cancelled) setJobs(data.jobs ?? []);
      })
      .catch(() => { if (!cancelled) setNotice("We couldn't reach the job board. Please try again."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const visibleJobs = useMemo(() => jobs.filter((job) => typeFilter === "All roles" || job.type === typeFilter), [jobs, typeFilter]);

  function openPanel(nextPanel: "apply" | "track" | "recruiter", job?: Job) {
    setNotice("");
    setTrackingResult(null);
    if (job) setSelectedJob(job);
    if (nextPanel === "recruiter") {
      const savedKey = window.localStorage.getItem("careerhub-recruiter-key") ?? "";
      const demoKey = process.env.NODE_ENV === "development" ? "careerhub-demo-key" : savedKey;
      setRecruiterKey(savedKey || demoKey);
      if (savedKey || process.env.NODE_ENV === "development") {
        void loadRecruiterData(savedKey || demoKey).then(() => setRecruiterUnlocked(true)).catch(() => setRecruiterUnlocked(false));
      }
    }
    setPanel(nextPanel);
  }

  async function submitApplication(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedJob) return;
    setSubmitting(true);
    setNotice("");
    try {
      const response = await fetch("/api/applications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...applicationForm, jobId: selectedJob.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Application could not be sent");
      const item: TrackingItem = { id: data.application.id, title: data.application.jobTitle, company: data.application.company, status: data.application.status };
      const saved = JSON.parse(window.localStorage.getItem("careerhub-applications") ?? "[]") as TrackingItem[];
      window.localStorage.setItem("careerhub-applications", JSON.stringify([item, ...saved.filter((entry) => entry.id !== item.id)]));
      setTrackingId(item.id);
      setTrackingResult(item);
      setNotice("Application sent. Keep this reference to check your progress.");
      setApplicationForm({ name: "", email: "", resumeUrl: "", note: "" });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Application could not be sent");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitJob(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setNotice("");
    try {
      const response = await fetch("/api/jobs", { method: "POST", headers: { "Content-Type": "application/json", "x-recruiter-key": recruiterKey }, body: JSON.stringify({ ...jobForm, tags: jobForm.tags.split(",").map((tag) => tag.trim()).filter(Boolean) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Job could not be published");
      setJobForm({ title: "", company: "", location: "", type: "Full-time", salary: "", description: "", tags: "" });
      setNotice("Your role is live on CareerHub.");
      await loadJobs("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Job could not be published");
    } finally {
      setSubmitting(false);
    }
  }

  async function unlockRecruiter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setNotice("");
    try {
      await loadRecruiterData();
      window.localStorage.setItem("careerhub-recruiter-key", recruiterKey);
      setRecruiterUnlocked(true);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Access denied");
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(id: string, status: ApplicationStatus) {
    const response = await fetch(`/api/applications/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", "x-recruiter-key": recruiterKey }, body: JSON.stringify({ status }) });
    const data = await response.json();
    if (!response.ok) { setNotice(data.error ?? "Status could not be updated"); return; }
    setApplications((current) => current.map((application) => application.id === id ? data.application : application));
  }

  async function checkTracking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setNotice("");
    try {
      const response = await fetch(`/api/applications/${encodeURIComponent(trackingId)}?tracking=${encodeURIComponent(trackingId)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Application not found");
      setTrackingResult({ id: data.application.id, title: data.application.jobTitle, company: data.application.company, status: data.application.status });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Application not found");
    } finally {
      setSubmitting(false);
    }
  }

  const applicationCount = applications.length;
  const interviewCount = applications.filter((application) => application.status === "Interview").length;

  return (
    <main>
      <header className="topbar">
        <a className="wordmark" href="#top" aria-label="CareerHub home"><span className="brand-mark"><Sparkles size={17} strokeWidth={2.5} /></span>career<span>hub</span></a>
        <nav className="topnav" aria-label="Main navigation">
          <a className="nav-current" href="#open-roles">Find a job</a>
          <button className="nav-link" onClick={() => openPanel("track")}>My applications</button>
          <button className="nav-employer" onClick={() => openPanel("recruiter")}>For employers <ArrowUpRight size={15} /></button>
        </nav>
      </header>

      <section className="intro" id="top">
        <div className="intro-copy">
          <div className="eyebrow"><span className="live-dot" />GOOD WORK STARTS HERE</div>
          <h1>Find work that<br /><em>moves you.</em></h1>
          <p className="intro-lede">A better kind of job search. Meet thoughtful teams, find work that fits, and make your next move with confidence.</p>
          <a className="text-cta" href="#open-roles">Explore open roles <ArrowDown size={16} /></a>
        </div>
        <div className="intro-aside" aria-label="CareerHub job board statistics">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="aside-note"><span>GOOD PEOPLE.</span><span>GOOD WORK.</span><span>GOOD FIT.</span></div>
          <div className="aside-bottom"><div><strong>{jobs.length.toString().padStart(2, "0")}</strong><span>open roles</span></div><div className="aside-divider" /><div><strong>01</strong><span>next chapter</span></div></div>
          <span className="aside-spark">✳</span>
        </div>
      </section>

      <section className="ticker" aria-label="CareerHub values"><span>ROOM TO GROW</span><b>✳</b><span>PEOPLE FIRST</span><b>✳</b><span>WORK WITH PURPOSE</span><b>✳</b><span>BETTER TOGETHER</span></section>

      <section className="roles-section" id="open-roles">
        <div className="section-heading"><div><div className="eyebrow section-eyebrow">THE NEXT GOOD THING</div><h2>Open <em>roles.</em></h2></div><div className="role-total"><span>{visibleJobs.length.toString().padStart(2, "0")}</span> opportunities</div></div>
        <div className="search-tools">
          <label className="search-box"><Search size={19} /><input aria-label="Search jobs" placeholder="Role, company, or keyword" value={query} onChange={(event) => { setQuery(event.target.value); void loadJobs(event.target.value); }} /><kbd>↵</kbd></label>
          <label className="filter-select"><span className="sr-only">Filter by employment type</span><BriefcaseBusiness size={17} /><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option>All roles</option>{jobTypes.map((type) => <option key={type}>{type}</option>)}</select><ChevronDown size={15} /></label>
        </div>
        <div className="jobs-list" aria-live="polite">
          {loading ? <div className="empty-state">Finding the right opportunities...</div> : visibleJobs.length ? visibleJobs.map((job, index) => (
            <article className="job-row" key={job.id} style={{ animationDelay: `${Math.min(index, 5) * 55}ms` }}>
              <div className="company-stamp">{job.company.split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase()}</div>
              <div className="job-main"><div className="job-company">{job.company}<span className="verified-mark"><Check size={10} /></span><span className="job-separator">·</span><span>{job.type}</span></div><h3>{job.title}</h3><div className="job-meta"><span><MapPin size={14} />{job.location}</span><span className="salary">{job.salary}</span></div></div>
              <div className="job-tags">{job.tags.slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}</div>
              <button className="open-job" aria-label={`View ${job.title} at ${job.company}`} onClick={() => { setSelectedJob(job); setNotice(""); setPanel("apply"); }}><ArrowUpRight size={20} /></button>
            </article>
          )) : <div className="empty-state">No roles match that search. Try a different keyword.</div>}
        </div>
        <div className="roles-foot"><span>Showing {visibleJobs.length} {visibleJobs.length === 1 ? "role" : "roles"}</span><button onClick={() => { setQuery(""); setTypeFilter("All roles"); void loadJobs(""); }}>Clear filters <X size={13} /></button></div>
      </section>

      <section className="closing-band"><div className="closing-mark"><Building2 size={22} /></div><div><div className="eyebrow">HIRING WITH US</div><h2>Good people make <em>great work.</em></h2><p>Meet the people who are ready for what comes next.</p></div><button onClick={() => openPanel("recruiter")}>Find your next hire <ArrowRight size={17} /></button></section>

      <footer className="footer"><a className="wordmark footer-wordmark" href="#top"><span className="brand-mark"><Sparkles size={15} /></span>career<span>hub</span></a><span>Hiring, in good company.</span><span>© 2026 CareerHub</span></footer>

      {panel && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPanel(null); }}><section className={`dialog ${panel === "recruiter" ? "dialog-wide" : ""}`} role="dialog" aria-modal="true" aria-label={panel === "apply" ? "Apply for this job" : panel === "track" ? "Track an application" : "Recruiter workspace"}>
        <button className="dialog-close" aria-label="Close dialog" onClick={() => setPanel(null)}><X size={20} /></button>
        {panel === "apply" && selectedJob && <>
          <div className="dialog-kicker">YOUR NEXT CHAPTER</div><h2>{selectedJob.title}</h2><div className="dialog-subtitle">{selectedJob.company} <span>·</span> {selectedJob.location}</div>
          <p className="job-description">{selectedJob.description}</p><div className="dialog-tags">{selectedJob.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
          {trackingResult ? <div className="success-box"><span className="success-icon"><Check size={18} /></span><div><strong>You&apos;re in the running.</strong><p>Your reference is <code>{trackingResult.id}</code>. Save it to track your application.</p><button className="inline-link" onClick={() => { setPanel("track"); setTrackingId(trackingResult.id); }}>Track application <ArrowRight size={14} /></button></div></div> : <form className="form-stack" onSubmit={submitApplication}><h3>Make your introduction</h3><div className="form-grid"><label>Your name<input required minLength={2} maxLength={120} value={applicationForm.name} onChange={(event) => setApplicationForm({ ...applicationForm, name: event.target.value })} placeholder="Alex Morgan" /></label><label>Email address<input required type="email" maxLength={254} value={applicationForm.email} onChange={(event) => setApplicationForm({ ...applicationForm, email: event.target.value })} placeholder="alex@email.com" /></label></div><label>Resume link <span className="optional">(optional)</span><input type="url" maxLength={2048} value={applicationForm.resumeUrl} onChange={(event) => setApplicationForm({ ...applicationForm, resumeUrl: event.target.value })} placeholder="https://drive.google.com/..." /></label><label>A note for the team <span className="optional">(optional)</span><textarea rows={3} maxLength={2000} value={applicationForm.note} onChange={(event) => setApplicationForm({ ...applicationForm, note: event.target.value })} placeholder="What drew you to this role?" /></label><button className="primary-button" disabled={submitting}>{submitting ? "Sending..." : "Send application"}<ArrowRight size={16} /></button></form>}
        </>}

        {panel === "track" && <><div className="dialog-kicker">YOUR CAREERHUB ACTIVITY</div><h2>Keep your next<br /><em>move in view.</em></h2><p className="dialog-intro">Enter the private reference shown after you applied.</p><form className="track-form" onSubmit={checkTracking}><input required value={trackingId} onChange={(event) => setTrackingId(event.target.value)} placeholder="Application reference" /><button className="primary-button" disabled={submitting}>Check status <ArrowRight size={16} /></button></form>{trackingResult && <div className="tracking-card"><span className="status-dot" /><div><strong>{trackingResult.title}</strong><span>{trackingResult.company}</span></div><span className={`status-pill status-${trackingResult.status.toLowerCase()}`}>{trackingResult.status}</span></div>}{notice && <p className="form-notice">{notice}</p>}<div className="track-tip"><Clock3 size={16} />Your application status is updated by the hiring team.</div></>}

        {panel === "recruiter" && <><div className="dialog-kicker">THE PEOPLE BEHIND THE WORK</div><h2>Build a team that<br /><em>moves things forward.</em></h2><p className="dialog-intro">Publish thoughtful opportunities and keep every candidate in view.</p>
          {!recruiterUnlocked ? <form className="auth-form" onSubmit={unlockRecruiter}><label>Recruiter access key<input type="password" required value={recruiterKey} onChange={(event) => setRecruiterKey(event.target.value)} placeholder="Enter your recruiter key" /></label><button className="primary-button" disabled={submitting}>Open workspace <ArrowRight size={16} /></button></form> : <div className="recruiter-workspace"><div className="dashboard-summary"><div><span>IN YOUR PIPELINE</span><strong>{applicationCount.toString().padStart(2, "0")}</strong><small>candidates</small></div><div><span>IN CONVERSATION</span><strong>{interviewCount.toString().padStart(2, "0")}</strong><small>interviews</small></div><div><span>ON THE BOARD</span><strong>{jobs.length.toString().padStart(2, "0")}</strong><small>open roles</small></div></div><div className="recruiter-columns"><form className="form-stack post-form" onSubmit={submitJob}><h3><CirclePlus size={17} /> Post a role</h3><label>Job title<input required maxLength={120} value={jobForm.title} onChange={(event) => setJobForm({ ...jobForm, title: event.target.value })} placeholder="Senior Product Designer" /></label><div className="form-grid"><label>Company<input required maxLength={120} value={jobForm.company} onChange={(event) => setJobForm({ ...jobForm, company: event.target.value })} placeholder="Company name" /></label><label>Location<input required maxLength={120} value={jobForm.location} onChange={(event) => setJobForm({ ...jobForm, location: event.target.value })} placeholder="Remote · US" /></label></div><div className="form-grid"><label>Employment type<select value={jobForm.type} onChange={(event) => setJobForm({ ...jobForm, type: event.target.value as JobType })}>{jobTypes.map((type) => <option key={type}>{type}</option>)}</select></label><label>Salary range<input required maxLength={80} value={jobForm.salary} onChange={(event) => setJobForm({ ...jobForm, salary: event.target.value })} placeholder="$120k–$150k" /></label></div><label>About the role<textarea required rows={3} maxLength={5000} value={jobForm.description} onChange={(event) => setJobForm({ ...jobForm, description: event.target.value })} placeholder="Tell candidates what makes this work matter." /></label><label>Skills <span className="optional">(comma separated)</span><input value={jobForm.tags} onChange={(event) => setJobForm({ ...jobForm, tags: event.target.value })} placeholder="TypeScript, Product, Research" /></label><button className="primary-button" disabled={submitting}>{submitting ? "Publishing..." : "Publish role"}<ArrowRight size={16} /></button></form><div className="candidate-panel"><h3>Candidate pipeline <span>{applications.length}</span></h3>{applications.length ? <div className="candidate-list">{applications.map((application) => <article className="candidate-row" key={application.id}><div className="candidate-avatar">{application.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div><div className="candidate-detail"><strong>{application.name}</strong><span>{application.jobTitle}</span><a href={`mailto:${application.email}`}>{application.email}</a>{application.resumeUrl && <a href={application.resumeUrl} target="_blank" rel="noreferrer">Resume <ArrowUpRight size={12} /></a>}{application.note && <p>{application.note}</p>}<select aria-label={`Status for ${application.name}`} value={application.status} onChange={(event) => void updateStatus(application.id, event.target.value as ApplicationStatus)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></div></article>)}</div> : <div className="candidate-empty"><span><BriefcaseBusiness size={20} /></span><strong>Your pipeline starts here.</strong><p>Applications will show up here as people discover your roles.</p></div>}</div></div></div>}
        </>}
        {notice && panel !== "track" && <p className="form-notice">{notice}</p>}
      </section></div>}
    </main>
  );
}