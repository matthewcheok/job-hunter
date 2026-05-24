"use client";

import { useState } from "react";
import { FileText, ScrollText } from "lucide-react";
import { ApplicationEditForm } from "@/components/application-edit-form";
import { CoverLetterTab } from "@/components/cover-letter-tab";
import { DeleteApplicationForm } from "@/components/delete-application-form";
import { StatusSelectForm } from "@/components/status-select-form";
import {
  type ApplicationStatus,
  type ApplicationWithCurrentStatus,
  type UserResume,
} from "@/lib/types";

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  ready: "Ready",
  applied: "Applied",
  interviewing: "Interviewing",
  rejected: "Rejected",
};

export function ApplicationDetailPane({
  application,
  resume,
}: {
  application: ApplicationWithCurrentStatus;
  resume: UserResume | null;
}) {
  const [activeTab, setActiveTab] = useState<"details" | "cover-letter">(
    "details",
  );

  return (
    <>
      <div className="pane-tabs" role="tablist" aria-label="Application sections">
        <button
          aria-selected={activeTab === "details"}
          className="pane-tab"
          onClick={() => setActiveTab("details")}
          role="tab"
          type="button"
        >
          <ScrollText aria-hidden="true" size={16} />
          Details
        </button>
        <button
          aria-selected={activeTab === "cover-letter"}
          className="pane-tab"
          onClick={() => setActiveTab("cover-letter")}
          role="tab"
          type="button"
        >
          <FileText aria-hidden="true" size={16} />
          Cover Letter
        </button>
      </div>

      {activeTab === "details" ? (
        <DetailsTab application={application} />
      ) : (
        <CoverLetterTab application={application} resume={resume} />
      )}
    </>
  );
}

function DetailsTab({
  application,
}: {
  application: ApplicationWithCurrentStatus;
}) {
  return (
    <div className="pane-content">
      <div className="current-status-block">
        <StatusSelectForm
          applicationId={application.id}
          currentStatus={application.current_status}
        />
        <p className="status-updated-at">
          Updated{" "}
          <time dateTime={application.updated_at}>
            {formatDate(application.updated_at)}
          </time>
        </p>
      </div>

      <ApplicationEditForm application={application} />

      <div className="timeline">
        <h3>Status history</h3>
        <ol>
          {application.status_history.map((event) => (
            <li key={event.id}>
              <span className="timeline-status">{STATUS_LABELS[event.status]}</span>
              <time dateTime={event.created_at}>{formatDate(event.created_at)}</time>
            </li>
          ))}
        </ol>
      </div>

      <DeleteApplicationForm
        applicationId={application.id}
        applicationName={`${application.position} at ${application.company_name}`}
      />
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
