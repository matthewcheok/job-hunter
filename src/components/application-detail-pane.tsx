import { ApplicationEditForm } from "@/components/application-edit-form";
import { DeleteApplicationForm } from "@/components/delete-application-form";
import { StatusSelectForm } from "@/components/status-select-form";
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

export function ApplicationDetailPane({
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
