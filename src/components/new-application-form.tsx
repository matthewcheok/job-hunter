"use client";

import { useRef, useState } from "react";
import { Check, LoaderCircle, Plus, WandSparkles, XCircle } from "lucide-react";
import { createApplication, extractApplicationFromUrl } from "@/app/actions";
import {
  type ApplicationDraftValues,
  getExtractedOverwriteFields,
  isReadableJobListingUrl,
  mergeExtractedFieldValues,
} from "@/lib/job-extraction-form";

type ExtractionStatus = "idle" | "reading" | "read" | "error";

const initialValues: ApplicationDraftValues = {
  job_listing_url: "",
  position: "",
  company_name: "",
  notes: "",
  about_role: "",
  about_company: "",
  responsibilities: "",
  requirements: "",
};

export function NewApplicationForm({
  onCreated,
}: {
  onCreated: (applicationId: string) => void;
}) {
  const [values, setValues] = useState<ApplicationDraftValues>(initialValues);
  const valuesRef = useRef<ApplicationDraftValues>(initialValues);
  const [extractionStatus, setExtractionStatus] =
    useState<ExtractionStatus>("idle");
  const [extractionError, setExtractionError] = useState("");
  const canReadListing = isReadableJobListingUrl(values.job_listing_url);

  function updateValue(field: keyof ApplicationDraftValues, value: string) {
    valuesRef.current = {
      ...valuesRef.current,
      [field]: value,
    };
    setValues(valuesRef.current);

    if (field === "job_listing_url") {
      setExtractionStatus("idle");
      setExtractionError("");
    }
  }

  async function readListing() {
    if (!canReadListing || extractionStatus === "reading") {
      return;
    }

    setExtractionStatus("reading");

    try {
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
      const { mergedValues } = mergeExtractedFieldValues(
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
      setExtractionStatus("read");
      window.setTimeout(() => setExtractionStatus("idle"), 2200);
    } catch (error) {
      setExtractionError(getErrorMessage(error));
      setExtractionStatus("error");
    }
  }

  return (
      <form
        action={async (formData) => {
          const application = await createApplication(formData);
          onCreated(application.id);
        }}
        className="application-form"
      >
        <label>
          <span className="field-label-row">
            <span>Job listing URL</span>
            <FieldExtractionStatus
              error={extractionError}
              status={extractionStatus}
            />
          </span>
          <span className="url-field-row">
            <input
              name="job_listing_url"
              onChange={(event) =>
                updateValue("job_listing_url", event.currentTarget.value)
              }
              type="url"
              placeholder="https://company.com/jobs/123"
              value={values.job_listing_url}
            />
            {canReadListing ? (
              <button
                className="secondary-button inline-action-button icon-button-label"
                disabled={extractionStatus === "reading"}
                onMouseDown={(event) => event.preventDefault()}
                onClick={readListing}
                type="button"
              >
                <WandSparkles aria-hidden="true" size={15} />
                Read
              </button>
            ) : null}
          </span>
        </label>
        <label>
          <span>Position</span>
          <input
            name="position"
            onChange={(event) => updateValue("position", event.currentTarget.value)}
            type="text"
            placeholder="Product Designer"
            required
            value={values.position}
          />
        </label>
        <label>
          <span>Company</span>
          <input
            name="company_name"
            onChange={(event) =>
              updateValue("company_name", event.currentTarget.value)
            }
            type="text"
            placeholder="Acme Studio"
            required
            value={values.company_name}
          />
        </label>
        <label>
          <span>Notes</span>
          <textarea
            name="notes"
            onChange={(event) => updateValue("notes", event.currentTarget.value)}
            placeholder="Hiring manager, compensation notes, referrals..."
            rows={5}
            value={values.notes}
          />
        </label>
        <label>
          <span>About the role</span>
          <textarea
            name="about_role"
            onChange={(event) =>
              updateValue("about_role", event.currentTarget.value)
            }
            placeholder="Role summary, team context, impact..."
            rows={5}
            value={values.about_role}
          />
        </label>
        <label>
          <span>About the company</span>
          <textarea
            name="about_company"
            onChange={(event) =>
              updateValue("about_company", event.currentTarget.value)
            }
            placeholder="Mission, market, funding, culture..."
            rows={5}
            value={values.about_company}
          />
        </label>
        <label>
          <span>Responsibilities</span>
          <textarea
            name="responsibilities"
            onChange={(event) =>
              updateValue("responsibilities", event.currentTarget.value)
            }
            placeholder="What the role is expected to own..."
            rows={5}
            value={values.responsibilities}
          />
        </label>
        <label>
          <span>Requirements</span>
          <textarea
            name="requirements"
            onChange={(event) =>
              updateValue("requirements", event.currentTarget.value)
            }
            placeholder="Experience, skills, tools, qualifications..."
            rows={5}
            value={values.requirements}
          />
        </label>
        <button className="primary-button icon-button-label" type="submit">
          <Plus aria-hidden="true" size={18} />
          Add position
        </button>
      </form>
  );
}

function FieldExtractionStatus({
  error,
  status,
}: {
  error: string;
  status: ExtractionStatus;
}) {
  if (status === "idle") {
    return null;
  }

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
