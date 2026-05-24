"use client";

import { Trash2 } from "lucide-react";
import { deleteApplication } from "@/app/actions";

export function DeleteApplicationForm({
  applicationId,
  applicationName,
}: {
  applicationId: string;
  applicationName: string;
}) {
  return (
    <form
      action={deleteApplication}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          `Delete "${applicationName}"? This cannot be undone.`,
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input name="id" type="hidden" value={applicationId} />
      <button className="danger-button icon-button-label" type="submit">
        <Trash2 aria-hidden="true" size={16} />
        Delete application
      </button>
    </form>
  );
}
