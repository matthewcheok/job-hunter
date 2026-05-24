"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isApplicationStatus, normalizeOptionalUrl, requiredText } from "@/lib/validation";

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
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";

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
