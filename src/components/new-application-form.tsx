"use client";

import { Plus } from "lucide-react";
import { createApplication } from "@/app/actions";

export function NewApplicationForm({
  onCreated,
}: {
  onCreated: (applicationId: string) => void;
}) {
  return (
      <form
        action={async (formData) => {
          const application = await createApplication(formData);
          onCreated(application.id);
        }}
        className="application-form"
      >
        <label>
          <span>Job listing URL</span>
          <input
            name="job_listing_url"
            type="url"
            placeholder="https://company.com/jobs/123"
          />
        </label>
        <label>
          <span>Position</span>
          <input name="position" type="text" placeholder="Product Designer" required />
        </label>
        <label>
          <span>Company</span>
          <input name="company_name" type="text" placeholder="Acme Studio" required />
        </label>
        <label>
          <span>Notes</span>
          <textarea
            name="notes"
            placeholder="Hiring manager, compensation notes, referrals..."
            rows={5}
          />
        </label>
        <label>
          <span>About the role</span>
          <textarea
            name="about_role"
            placeholder="Role summary, team context, impact..."
            rows={5}
          />
        </label>
        <label>
          <span>About the company</span>
          <textarea
            name="about_company"
            placeholder="Mission, market, funding, culture..."
            rows={5}
          />
        </label>
        <label>
          <span>Responsibilities</span>
          <textarea
            name="responsibilities"
            placeholder="What the role is expected to own..."
            rows={5}
          />
        </label>
        <label>
          <span>Requirements</span>
          <textarea
            name="requirements"
            placeholder="Experience, skills, tools, qualifications..."
            rows={5}
          />
        </label>
        <button className="primary-button icon-button-label" type="submit">
          <Plus aria-hidden="true" size={18} />
          Add position
        </button>
      </form>
  );
}
