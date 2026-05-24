"use client";

import { useRef, useState, useTransition } from "react";
import {
  Check,
  LoaderCircle,
  Pencil,
  WandSparkles,
  XCircle,
} from "lucide-react";
import { extractApplicationFromUrl, updateApplicationField } from "@/app/actions";
import {
  type ApplicationDraftValues,
  getExtractedOverwriteFields,
  isReadableJobListingUrl,
  mergeExtractedFieldValues,
} from "@/lib/job-extraction-form";
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
type UrlExtractionStatus = "idle" | "reading" | "read" | "error";

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
  const initialValues: ApplicationDraftValues = {
    job_listing_url: application.job_listing_url ?? "",
    position: application.position,
    company_name: application.company_name,
    notes: application.notes,
    about_role: application.about_role,
    about_company: application.about_company,
    responsibilities: application.responsibilities,
    requirements: application.requirements,
  };
  const [values, setValues] = useState<ApplicationDraftValues>(initialValues);
  const valuesRef = useRef<ApplicationDraftValues>(initialValues);
  const [urlExtractionStatus, setUrlExtractionStatus] =
    useState<UrlExtractionStatus>("idle");
  const [urlExtractionError, setUrlExtractionError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [fieldStatuses, setFieldStatuses] = useState<
    Partial<Record<FieldName, FieldStatus>>
  >({});
  const lastSavedValuesRef = useRef<Record<FieldName, string>>(initialValues);
  const clearTimersRef = useRef<Partial<Record<FieldName, number>>>({});
  const canReadListing = isReadableJobListingUrl(values.job_listing_url);

  function updateValue(field: FieldName, value: string) {
    valuesRef.current = {
      ...valuesRef.current,
      [field]: value,
    };
    setValues(valuesRef.current);

    if (field === "job_listing_url") {
      setUrlExtractionStatus("idle");
      setUrlExtractionError("");
    }
  }

  function saveField(
    field: FieldName,
    value: string,
    control: HTMLInputElement | HTMLTextAreaElement,
  ) {
    if (!control.reportValidity() || value === lastSavedValuesRef.current[field]) {
      return;
    }

    startTransition(async () => {
      await persistField(field, value);
    });
  }

  async function persistField(field: FieldName, value: string) {
    if (value === lastSavedValuesRef.current[field]) {
      return;
    }

    window.clearTimeout(clearTimersRef.current[field]);
    setFieldStatus(field, "saving");
    const formData = new FormData();
    formData.set("id", application.id);
    formData.set("field", field);
    formData.set("value", value);

    await updateApplicationField(formData);
    lastSavedValuesRef.current[field] = value;
    setFieldStatus(field, "saved");
    clearTimersRef.current[field] = window.setTimeout(
      () => setFieldStatus(field, "idle"),
      2200,
    );
  }

  async function readListing() {
    if (!canReadListing || urlExtractionStatus === "reading") {
      return;
    }

    try {
      const url = valuesRef.current.job_listing_url;

      if (url !== lastSavedValuesRef.current.job_listing_url) {
        await persistField("job_listing_url", url);
      }

      setUrlExtractionStatus("reading");
      const formData = new FormData();
      formData.set("url", valuesRef.current.job_listing_url);
      const result = await extractApplicationFromUrl(formData);
      const currentValues = valuesRef.current;
      const overwriteFields = getExtractedOverwriteFields(
        currentValues,
        result.data,
      );
      const overwriteExisting =
        overwriteFields.length > 0 &&
        window.confirm(
          "Some fields already contain text. Overwrite them with details from this listing?",
        );
      const { mergedValues, filledFields } = mergeExtractedFieldValues(
        currentValues,
        result.data,
        { overwriteExisting },
      );
      const nextValues = {
        ...mergedValues,
        job_listing_url: result.url,
      };

      valuesRef.current = nextValues;
      setValues(nextValues);

      if (result.url !== lastSavedValuesRef.current.job_listing_url) {
        await persistField("job_listing_url", result.url);
      }

      await Promise.all(
        filledFields.map((field) => persistField(field, nextValues[field])),
      );

      setUrlExtractionStatus("read");
      window.setTimeout(() => setUrlExtractionStatus("idle"), 2200);
    } catch (error) {
      setUrlExtractionError(getErrorMessage(error));
      setUrlExtractionStatus("error");
    }
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
      <div className="form-mode-row">
        <p className="form-mode-copy">
          {isEditing ? "Editing application details" : "Application details"}
        </p>
        <button
          className="secondary-button inline-action-button icon-button-label"
          onClick={() => setIsEditing((current) => !current)}
          type="button"
        >
          {isEditing ? (
            <Check aria-hidden="true" size={15} />
          ) : (
            <Pencil aria-hidden="true" size={15} />
          )}
          {isEditing ? "Done" : "Edit"}
        </button>
      </div>
      {FIELDS.map((field) => (
        <label
          className={
            !isEditing && field.name !== "notes" ? "readonly-field-group" : undefined
          }
          key={field.name}
        >
          <span className="field-label-row">
            <span>{field.label}</span>
            {field.name === "job_listing_url" &&
            urlExtractionStatus !== "idle" &&
            isEditing ? (
              <FieldExtractionStatus
                error={urlExtractionError}
                status={urlExtractionStatus}
              />
            ) : (
              <FieldSaveStatus status={fieldStatuses[field.name] ?? "idle"} />
            )}
          </span>
          {!isEditing && field.name !== "notes" ? (
            <ReadOnlyField field={field.name} value={values[field.name]} />
          ) : field.rows ? (
            <textarea
              name={field.name}
              placeholder={field.placeholder}
              rows={field.rows}
              value={values[field.name]}
              onChange={(event) =>
                updateValue(field.name, event.currentTarget.value)
              }
              onBlur={(event) =>
                saveField(field.name, event.currentTarget.value, event.currentTarget)
              }
            />
          ) : (
            <span
              className={
                field.name === "job_listing_url" ? "url-field-row" : undefined
              }
            >
              <input
                name={field.name}
                required={field.required}
                type={field.type}
                value={values[field.name]}
                onChange={(event) =>
                  updateValue(field.name, event.currentTarget.value)
                }
                onBlur={(event) =>
                  saveField(
                    field.name,
                    event.currentTarget.value,
                    event.currentTarget,
                  )
                }
              />
              {field.name === "job_listing_url" && canReadListing ? (
                <button
                  className="secondary-button inline-action-button icon-button-label"
                  disabled={urlExtractionStatus === "reading"}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={readListing}
                  type="button"
                >
                  <WandSparkles aria-hidden="true" size={15} />
                  Read
                </button>
              ) : null}
            </span>
          )}
        </label>
      ))}
    </form>
  );
}

function ReadOnlyField({
  field,
  value,
}: {
  field: FieldName;
  value: string;
}) {
  if (!value.trim()) {
    return <div className="readonly-field empty">Not added yet</div>;
  }

  if (field === "job_listing_url") {
    return (
      <a
        className="readonly-field readonly-link"
        href={value}
        rel="noreferrer"
        target="_blank"
      >
        {value}
      </a>
    );
  }

  return <div className="readonly-field">{renderReadOnlyContent(value)}</div>;
}

function renderReadOnlyContent(value: string) {
  const lines = value.split(/\r?\n/);
  const blocks: Array<
    | { type: "paragraph"; text: string }
    | { type: "ul" | "ol"; items: string[] }
  > = [];
  let currentList: { type: "ul" | "ol"; items: string[] } | null = null;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      currentList = null;
      continue;
    }

    const unorderedMatch = /^[-*•]\s+(.+)$/.exec(trimmedLine);
    const orderedMatch = /^\d+[.)]\s+(.+)$/.exec(trimmedLine);
    const listType = orderedMatch ? "ol" : unorderedMatch ? "ul" : null;
    const listItem = orderedMatch?.[1] ?? unorderedMatch?.[1];

    if (listType && listItem) {
      if (!currentList || currentList.type !== listType) {
        currentList = { type: listType, items: [] };
        blocks.push(currentList);
      }

      currentList.items.push(listItem);
      continue;
    }

    currentList = null;
    blocks.push({ type: "paragraph", text: trimmedLine });
  }

  if (blocks.length === 0) {
    return null;
  }

  return blocks.map((block, index) => {
    if (block.type === "paragraph") {
      return <p key={`${block.type}-${index}`}>{block.text}</p>;
    }

    const ListTag = block.type;

    return (
      <ListTag key={`${block.type}-${index}`}>
        {block.items.map((item, itemIndex) => (
          <li key={`${item}-${itemIndex}`}>{item}</li>
        ))}
      </ListTag>
    );
  });
}

function FieldExtractionStatus({
  error,
  status,
}: {
  error: string;
  status: UrlExtractionStatus;
}) {
  return (
    <span className="field-save-status" aria-live="polite">
      {status === "reading" ? (
        <>
          <LoaderCircle aria-hidden="true" className="button-spinner" size={13} />
          <span>Reading</span>
        </>
      ) : status === "read" ? (
        <>
          <Check aria-hidden="true" size={13} />
          <span>Read</span>
        </>
      ) : (
        <>
          <XCircle aria-hidden="true" size={13} />
          <span title={error}>{error || "Could not read"}</span>
        </>
      )}
    </span>
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Could not read";
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
