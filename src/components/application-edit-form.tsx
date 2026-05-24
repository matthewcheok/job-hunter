"use client";

import { useRef, useState, useTransition } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { updateApplicationField } from "@/app/actions";
import { type ApplicationWithCurrentStatus } from "@/lib/types";

type FieldName =
  | "job_listing_url"
  | "position"
  | "company_name"
  | "notes"
  | "about_role"
  | "about_company"
  | "responsibilities"
  | "requirements";

type FieldStatus = "idle" | "saving" | "saved";

const FIELDS: Array<{
  label: string;
  name: FieldName;
  rows?: number;
  placeholder?: string;
  required?: boolean;
  type?: "text" | "url";
}> = [
  { label: "Job listing URL", name: "job_listing_url", type: "url" },
  { label: "Position", name: "position", required: true, type: "text" },
  { label: "Company", name: "company_name", required: true, type: "text" },
  {
    label: "Notes",
    name: "notes",
    placeholder: "Hiring manager, compensation notes, referrals...",
    rows: 5,
  },
  {
    label: "About the role",
    name: "about_role",
    placeholder: "Role summary, team context, impact...",
    rows: 5,
  },
  {
    label: "About the company",
    name: "about_company",
    placeholder: "Mission, market, funding, culture...",
    rows: 5,
  },
  {
    label: "Responsibilities",
    name: "responsibilities",
    placeholder: "What the role is expected to own...",
    rows: 5,
  },
  {
    label: "Requirements",
    name: "requirements",
    placeholder: "Experience, skills, tools, qualifications...",
    rows: 5,
  },
];

export function ApplicationEditForm({
  application,
}: {
  application: ApplicationWithCurrentStatus;
}) {
  const [, startTransition] = useTransition();
  const [fieldStatuses, setFieldStatuses] = useState<
    Partial<Record<FieldName, FieldStatus>>
  >({});
  const lastSavedValuesRef = useRef<Record<FieldName, string>>({
    job_listing_url: application.job_listing_url ?? "",
    position: application.position,
    company_name: application.company_name,
    notes: application.notes,
    about_role: application.about_role,
    about_company: application.about_company,
    responsibilities: application.responsibilities,
    requirements: application.requirements,
  });
  const clearTimersRef = useRef<Partial<Record<FieldName, number>>>({});

  function saveField(
    field: FieldName,
    value: string,
    control: HTMLInputElement | HTMLTextAreaElement,
  ) {
    if (!control.reportValidity() || value === lastSavedValuesRef.current[field]) {
      return;
    }

    window.clearTimeout(clearTimersRef.current[field]);
    setFieldStatus(field, "saving");

    const formData = new FormData();
    formData.set("id", application.id);
    formData.set("field", field);
    formData.set("value", value);

    startTransition(async () => {
      await updateApplicationField(formData);
      lastSavedValuesRef.current[field] = value;
      setFieldStatus(field, "saved");
      clearTimersRef.current[field] = window.setTimeout(
        () => setFieldStatus(field, "idle"),
        2200,
      );
    });
  }

  function setFieldStatus(field: FieldName, status: FieldStatus) {
    setFieldStatuses((current) => ({
      ...current,
      [field]: status,
    }));
  }

  return (
    <form
      className="application-form"
      onSubmit={(event) => event.preventDefault()}
    >
      {FIELDS.map((field) => (
        <label key={field.name}>
          <span className="field-label-row">
            <span>{field.label}</span>
            <FieldSaveStatus status={fieldStatuses[field.name] ?? "idle"} />
          </span>
          {field.rows ? (
            <textarea
              name={field.name}
              placeholder={field.placeholder}
              rows={field.rows}
              defaultValue={getApplicationFieldValue(application, field.name)}
              onBlur={(event) =>
                saveField(field.name, event.currentTarget.value, event.currentTarget)
              }
            />
          ) : (
            <input
              name={field.name}
              required={field.required}
              type={field.type}
              defaultValue={getApplicationFieldValue(application, field.name)}
              onBlur={(event) =>
                saveField(field.name, event.currentTarget.value, event.currentTarget)
              }
            />
          )}
        </label>
      ))}
    </form>
  );
}

function FieldSaveStatus({ status }: { status: FieldStatus }) {
  if (status === "idle") {
    return null;
  }

  return (
    <span className="field-save-status" aria-live="polite">
      {status === "saving" ? (
        <>
          <LoaderCircle aria-hidden="true" className="button-spinner" size={13} />
          <span>Saving</span>
        </>
      ) : (
        <>
          <Check aria-hidden="true" size={13} />
          <span>Saved</span>
        </>
      )}
    </span>
  );
}

function getApplicationFieldValue(
  application: ApplicationWithCurrentStatus,
  field: FieldName,
) {
  return application[field] ?? "";
}
