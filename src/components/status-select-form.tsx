"use client";

import { useRef } from "react";
import { moveApplicationStatus } from "@/app/actions";
import {
  APPLICATION_STATUSES,
  type ApplicationStatus,
} from "@/lib/types";

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  ready: "Ready",
  applied: "Applied",
  interviewing: "Interviewing",
  rejected: "Rejected",
};

export function StatusSelectForm({
  applicationId,
  currentStatus,
}: {
  applicationId: string;
  currentStatus: ApplicationStatus;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form action={moveApplicationStatus} className="status-select-form" ref={formRef}>
      <input name="application_id" type="hidden" value={applicationId} />
      <label>
        <span>Status</span>
        <select
          name="status"
          defaultValue={currentStatus}
          onChange={() => formRef.current?.requestSubmit()}
        >
          {APPLICATION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </label>
    </form>
  );
}
