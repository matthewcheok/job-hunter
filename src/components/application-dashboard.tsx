"use client";

import { useMemo, useState } from "react";
import { FilePlus2, Search } from "lucide-react";
import { ApplicationDetailPane } from "@/components/application-detail-pane";
import { ApplicationTable } from "@/components/application-table";
import { NewApplicationForm } from "@/components/new-application-form";
import {
  type ApplicationWithCurrentStatus,
  type UserResume,
} from "@/lib/types";

type PaneState =
  | { mode: "new" }
  | { mode: "detail"; applicationId: string }
  | null;

export function ApplicationDashboard({
  applications,
  resume,
}: {
  applications: ApplicationWithCurrentStatus[];
  resume: UserResume | null;
}) {
  const [pane, setPane] = useState<PaneState>(null);
  const [query, setQuery] = useState("");

  const selectedApplicationId =
    pane?.mode === "detail" ? pane.applicationId : undefined;

  const selectedApplication = useMemo(() => {
    if (!selectedApplicationId) {
      return undefined;
    }

    return applications.find(
      (application) => application.id === selectedApplicationId,
    );
  }, [applications, selectedApplicationId]);

  const filteredApplications = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return applications;
    }

    return applications.filter((application) =>
      [
        application.position,
        application.company_name,
        application.notes,
        application.current_status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [applications, query]);

  const activePane =
    pane?.mode === "detail" && !selectedApplication ? null : pane;

  return (
    <section className={`table-workspace${activePane ? " pane-open" : ""}`}>
      <div className="table-panel">
        <div className="table-toolbar">
          <label className="search-field">
            <Search aria-hidden="true" size={17} />
            <span className="sr-only">Search applications</span>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search applications"
              type="search"
              value={query}
            />
          </label>
          <button
            className="primary-button icon-button-label"
            onClick={() => setPane({ mode: "new" })}
            type="button"
          >
            <FilePlus2 aria-hidden="true" size={18} />
            New position
          </button>
        </div>

        <ApplicationTable
          applications={filteredApplications}
          onSelectApplication={(application) =>
            setPane({ mode: "detail", applicationId: application.id })
          }
          selectedApplicationId={selectedApplicationId}
        />
      </div>

      {activePane ? (
        <aside className="side-pane" aria-label="Application pane">
          <div className="pane-header">
            <div>
              <p className="eyebrow">
                {activePane.mode === "new" ? "New position" : "Application details"}
              </p>
              <h2>
                {activePane.mode === "new"
                  ? "Track an application"
                  : selectedApplication?.position}
              </h2>
            </div>
            <button
              className="secondary-button"
              onClick={() => setPane(null)}
              type="button"
            >
              Close
            </button>
          </div>

          {activePane.mode === "new" ? (
            <NewApplicationForm
              onCreated={(applicationId) =>
                setPane({ mode: "detail", applicationId })
              }
            />
          ) : selectedApplication ? (
            <ApplicationDetailPane
              application={selectedApplication}
              key={selectedApplication.id}
              resume={resume}
            />
          ) : null}
        </aside>
      ) : null}
    </section>
  );
}
