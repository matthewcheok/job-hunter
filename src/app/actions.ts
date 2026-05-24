"use server";

import { Redis } from "@upstash/redis";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { generateCoverLetter as generateCoverLetterText } from "@/lib/cover-letter";
import { createClient } from "@/lib/supabase/server";
import { processJobExtractionUrl } from "@/lib/job-extraction-url";
import { isApplicationStatus, normalizeOptionalUrl, requiredText } from "@/lib/validation";

const RESUME_BUCKET = "resumes";
const MAX_RESUME_BYTES = 10 * 1024 * 1024;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/");
  }

  return { supabase, user };
}

export async function signInWithGoogle() {
  const supabase = await createClient();
  const origin =
    (await headers()).get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    redirect("/?error=Unable%20to%20start%20Google%20sign-in");
  }

  if (data.url) {
    redirect(data.url);
  }
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function extractApplicationFromUrl(formData: FormData) {
  await requireUser();
  const url = requiredText(formData, "url", "Job listing URL");
  const normalizedUrl = normalizeOptionalUrl(url);

  if (!normalizedUrl) {
    throw new Error("Enter a valid job listing URL.");
  }

  const result = await processJobExtractionUrl({
    rawUrl: normalizedUrl,
    cache: Redis.fromEnv(),
  });

  return {
    url: result.url,
    data: result.data,
  };
}

export async function createApplication(formData: FormData) {
  const { supabase, user } = await requireUser();
  const position = requiredText(formData, "position", "Position");
  const companyName = requiredText(formData, "company_name", "Company name");
  const jobListingUrl = normalizeOptionalUrl(formData.get("job_listing_url"));
  const notes = String(formData.get("notes") ?? "").trim();
  const aboutRole = String(formData.get("about_role") ?? "").trim();
  const aboutCompany = String(formData.get("about_company") ?? "").trim();
  const responsibilities = String(formData.get("responsibilities") ?? "").trim();
  const requirements = String(formData.get("requirements") ?? "").trim();

  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .insert({
      user_id: user.id,
      position,
      company_name: companyName,
      job_listing_url: jobListingUrl,
      notes,
      about_role: aboutRole,
      about_company: aboutCompany,
      responsibilities,
      requirements,
    })
    .select("id")
    .single();

  if (applicationError) {
    throw new Error(applicationError.message);
  }

  const { error: historyError } = await supabase.from("status_history").insert({
    application_id: application.id,
    user_id: user.id,
    status: "ready",
  });

  if (historyError) {
    throw new Error(historyError.message);
  }

  revalidatePath("/dashboard");
  return { id: application.id };
}

export async function updateApplication(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = requiredText(formData, "id", "Application");
  const position = requiredText(formData, "position", "Position");
  const companyName = requiredText(formData, "company_name", "Company name");
  const jobListingUrl = normalizeOptionalUrl(formData.get("job_listing_url"));
  const notes = String(formData.get("notes") ?? "").trim();
  const aboutRole = String(formData.get("about_role") ?? "").trim();
  const aboutCompany = String(formData.get("about_company") ?? "").trim();
  const responsibilities = String(formData.get("responsibilities") ?? "").trim();
  const requirements = String(formData.get("requirements") ?? "").trim();

  const { error } = await supabase
    .from("applications")
    .update({
      position,
      company_name: companyName,
      job_listing_url: jobListingUrl,
      notes,
      about_role: aboutRole,
      about_company: aboutCompany,
      responsibilities,
      requirements,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard");
}

export async function updateApplicationField(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = requiredText(formData, "id", "Application");
  const field = requiredText(formData, "field", "Field");
  const value = formData.get("value");
  const update = getApplicationFieldUpdate(field, value);

  const { error } = await supabase
    .from("applications")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard");
}

export async function uploadResume(formData: FormData) {
  const { supabase, user } = await requireUser();
  const file = formData.get("resume");

  if (!(file instanceof File)) {
    throw new Error("Choose a PDF resume to upload.");
  }

  if (file.type !== "application/pdf") {
    throw new Error("Resume must be a PDF.");
  }

  if (file.size > MAX_RESUME_BYTES) {
    throw new Error("Resume PDF must be 10 MB or smaller.");
  }

  const storagePath = `${user.id}/resume.pdf`;
  const { error: uploadError } = await supabase.storage
    .from(RESUME_BUCKET)
    .upload(storagePath, file, {
      cacheControl: "3600",
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { error } = await supabase.from("user_resumes").upsert({
    user_id: user.id,
    storage_path: storagePath,
    original_filename: file.name,
    mime_type: file.type,
    size_bytes: file.size,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard");

  return {
    original_filename: file.name,
    size_bytes: file.size,
  };
}

export async function generateCoverLetter(formData: FormData) {
  return saveGeneratedCoverLetter(formData, "generate");
}

export async function refineCoverLetter(formData: FormData) {
  const mode = requiredText(formData, "mode", "Refinement mode");

  if (mode !== "concise" && mode !== "detailed" && mode !== "custom") {
    throw new Error("Choose a valid refinement mode.");
  }

  return saveGeneratedCoverLetter(formData, mode);
}

export async function updateCoverLetter(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = requiredText(formData, "id", "Application");
  const coverLetter = String(formData.get("cover_letter") ?? "").trim();

  const { error } = await supabase
    .from("applications")
    .update({ cover_letter: coverLetter })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard");

  return { cover_letter: coverLetter };
}

async function saveGeneratedCoverLetter(
  formData: FormData,
  mode: "generate" | "concise" | "detailed" | "custom",
) {
  const { supabase, user } = await requireUser();
  const application = await getApplicationForCoverLetter(
    supabase,
    user.id,
    requiredText(formData, "id", "Application"),
  );
  const resume = await getResumePdfForUser(supabase, user.id);
  const instruction = String(formData.get("instruction") ?? "").trim();
  const paragraphIndex = getOptionalParagraphIndex(formData.get("paragraph_index"));
  const existingCoverLetter = String(
    formData.get("cover_letter") ?? application.cover_letter ?? "",
  ).trim();

  if (mode === "custom" && !instruction) {
    throw new Error("Enter an instruction to refine the cover letter.");
  }

  if (mode !== "generate" && !existingCoverLetter) {
    throw new Error("Generate a cover letter before refining it.");
  }

  const coverLetter = await generateCoverLetterText({
    application,
    existingCoverLetter,
    instruction,
    mode,
    paragraphIndex,
    resume,
  });

  const { error } = await supabase
    .from("applications")
    .update({ cover_letter: coverLetter })
    .eq("id", application.id)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard");

  return { cover_letter: coverLetter };
}

async function getApplicationForCoverLetter(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  id: string,
) {
  const { data, error } = await supabase
    .from("applications")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    throw new Error("Application not found.");
  }

  return data;
}

async function getResumePdfForUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data: resume, error: resumeError } = await supabase
    .from("user_resumes")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (resumeError || !resume) {
    throw new Error("Upload a PDF resume before generating a cover letter.");
  }

  const { data, error } = await supabase.storage
    .from(RESUME_BUCKET)
    .download(resume.storage_path);

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to read the saved resume.");
  }

  return {
    kind: "pdf" as const,
    data: await data.arrayBuffer(),
    mimeType: resume.mime_type,
  };
}

function getOptionalParagraphIndex(value: FormDataEntryValue | null) {
  if (value === null || value === "") {
    return undefined;
  }

  const index = Number(value);

  if (!Number.isInteger(index) || index < 0) {
    throw new Error("Choose a valid paragraph.");
  }

  return index;
}

function getApplicationFieldUpdate(
  field: string,
  value: FormDataEntryValue | null,
) {
  switch (field) {
    case "job_listing_url":
      return { job_listing_url: normalizeOptionalUrl(value) };
    case "position":
      return { position: requiredTextValue(value, "Position") };
    case "company_name":
      return { company_name: requiredTextValue(value, "Company name") };
    case "notes":
    case "about_role":
    case "about_company":
    case "responsibilities":
    case "requirements":
      return { [field]: String(value ?? "").trim() };
    default:
      throw new Error("Choose a valid application field.");
  }
}

function requiredTextValue(value: FormDataEntryValue | null, label: string) {
  const text = String(value ?? "").trim();

  if (!text) {
    throw new Error(`${label} is required.`);
  }

  return text;
}

export async function moveApplicationStatus(formData: FormData) {
  const { supabase, user } = await requireUser();
  const applicationId = requiredText(formData, "application_id", "Application");
  const status = requiredText(formData, "status", "Status");

  if (!isApplicationStatus(status)) {
    throw new Error("Choose a valid status.");
  }

  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .select("id")
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .single();

  if (applicationError || !application) {
    throw new Error("Application not found.");
  }

  const { data: latestStatus, error: latestStatusError } = await supabase
    .from("status_history")
    .select("status")
    .eq("application_id", applicationId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestStatusError) {
    throw new Error(latestStatusError.message);
  }

  if (latestStatus?.status === status) {
    revalidatePath("/dashboard");
    return;
  }

  const { error } = await supabase.from("status_history").insert({
    application_id: applicationId,
    user_id: user.id,
    status,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard");
}

export async function deleteApplication(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = requiredText(formData, "id", "Application");

  const { error } = await supabase
    .from("applications")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard");
}
