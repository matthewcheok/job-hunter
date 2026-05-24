import type { JobExtraction } from "@/lib/job-extraction";

export const APPLICATION_DETAIL_FIELDS = [
  "position",
  "company_name",
  "notes",
  "about_role",
  "about_company",
  "responsibilities",
  "requirements",
] as const;

export type ApplicationDetailField = (typeof APPLICATION_DETAIL_FIELDS)[number];

export type ApplicationDraftValues = Record<ApplicationDetailField, string> & {
  job_listing_url: string;
};

export function isReadableJobListingUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function getExtractedFieldValues(extraction: JobExtraction) {
  return {
    position: extraction.position,
    company_name: extraction.company_name,
    notes: extraction.notes,
    about_role: extraction.about_role,
    about_company: extraction.about_company,
    responsibilities: extraction.responsibilities,
    requirements: extraction.requirements,
  } satisfies Record<ApplicationDetailField, string>;
}

export function mergeExtractedIntoEmptyFields(
  currentValues: ApplicationDraftValues,
  extraction: JobExtraction,
) {
  return mergeExtractedFieldValues(currentValues, extraction, {
    overwriteExisting: false,
  });
}

export function mergeExtractedFieldValues(
  currentValues: ApplicationDraftValues,
  extraction: JobExtraction,
  { overwriteExisting }: { overwriteExisting: boolean },
) {
  const extractedValues = getExtractedFieldValues(extraction);
  const mergedValues = { ...currentValues };
  const filledFields: ApplicationDetailField[] = [];

  for (const field of APPLICATION_DETAIL_FIELDS) {
    const extractedValue = extractedValues[field].trim();
    const currentValue = currentValues[field].trim();

    if (
      extractedValue &&
      (!currentValue || (overwriteExisting && currentValue !== extractedValue))
    ) {
      mergedValues[field] = extractedValue;
      filledFields.push(field);
    }
  }

  return { mergedValues, filledFields };
}

export function getExtractedOverwriteFields(
  currentValues: ApplicationDraftValues,
  extraction: JobExtraction,
) {
  const extractedValues = getExtractedFieldValues(extraction);

  return APPLICATION_DETAIL_FIELDS.filter((field) => {
    const currentValue = currentValues[field].trim();
    const extractedValue = extractedValues[field].trim();

    return Boolean(currentValue && extractedValue && currentValue !== extractedValue);
  });
}
