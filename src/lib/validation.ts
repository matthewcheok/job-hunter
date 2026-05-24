import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/types";

export function isApplicationStatus(value: string): value is ApplicationStatus {
  return APPLICATION_STATUSES.includes(value as ApplicationStatus);
}

export function normalizeOptionalUrl(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return null;
  }

  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    throw new Error("Enter a valid job listing URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Job listing URL must start with http:// or https://.");
  }

  return url.toString();
}

export function requiredText(formData: FormData, key: string, label: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    throw new Error(`${label} is required.`);
  }

  return value;
}
