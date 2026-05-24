"use client";

import { ExternalLink } from "lucide-react";
import {
  type ApplicationStatus,
  type ApplicationWithCurrentStatus,
} from "@/lib/types";

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  ready: "Ready",
  applied: "Applied",
  interviewing: "Interviewing",
  rejected: "Rejected",
};

export function ApplicationTable({
  applications,
  onSelectApplication,
  selectedApplicationId,
}: {
  applications: ApplicationWithCurrentStatus[];
  onSelectApplication: (application: ApplicationWithCurrentStatus) => void;
  selectedApplicationId?: string;
}) {
  if (applications.length === 0) {
    return (
      <div className="empty-table">
        <h2>No applications yet</h2>
        <p>Add your first role when you are ready to track it.</p>
      </div>
    );
  }

  return (
    <div className="application-table-wrap">
      <table className="application-table">
        <thead>
          <tr>
            <th>Position</th>
            <th>Company</th>
            <th>Status</th>
            <th>Listing</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {applications.map((application) => (
            <tr
              data-selected={application.id === selectedApplicationId}
              key={application.id}
              onClick={() => onSelectApplication(application)}
            >
              <td>
                <button className="table-row-button" type="button">
                  {application.position}
                </button>
              </td>
              <td>{application.company_name}</td>
              <td>
                <span className="status-pill" data-status={application.current_status}>
                  {STATUS_LABELS[application.current_status]}
                </span>
              </td>
              <td>
                {application.job_listing_url ? (
                  <a
                    className="table-link"
                    href={application.job_listing_url}
                    onClick={(event) => event.stopPropagation()}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <ExternalLink aria-hidden="true" size={16} />
                    <span>Open</span>
                  </a>
                ) : (
                  <span className="muted-cell">None</span>
                )}
              </td>
              <td>
                <time dateTime={application.updated_at}>
                  {formatShortDate(application.updated_at)}
                </time>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
