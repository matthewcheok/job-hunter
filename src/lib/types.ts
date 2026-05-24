export const APPLICATION_STATUSES = [
  "ready",
  "applied",
  "interviewing",
  "rejected",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export type JobApplication = {
  id: string;
  user_id: string;
  position: string;
  company_name: string;
  job_listing_url: string | null;
  notes: string;
  about_role: string;
  about_company: string;
  responsibilities: string;
  requirements: string;
  created_at: string;
  updated_at: string;
};

export type StatusHistory = {
  id: string;
  application_id: string;
  user_id: string;
  status: ApplicationStatus;
  created_at: string;
};

export type ApplicationWithCurrentStatus = JobApplication & {
  current_status: ApplicationStatus;
  status_history: StatusHistory[];
};

export type ApplicationFormInput = {
  position: string;
  company_name: string;
  job_listing_url?: string;
  notes?: string;
  about_role?: string;
  about_company?: string;
  responsibilities?: string;
  requirements?: string;
};
