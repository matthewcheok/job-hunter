import { redirect } from "next/navigation";
import { ApplicationDashboard } from "@/components/application-dashboard";
import { ProfileMenu } from "@/components/profile-menu";
import { SetupRequired } from "@/components/setup-required";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import {
  APPLICATION_STATUSES,
  type ApplicationWithCurrentStatus,
  type JobApplication,
  type StatusHistory,
  type UserResume,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  if (!hasSupabaseEnv()) {
    return <SetupRequired />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: applications, error: applicationsError } = await supabase
    .from("applications")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (applicationsError) {
    if (isMissingSchemaError(applicationsError.message)) {
      return <DatabaseSetupRequired />;
    }

    throw new Error(applicationsError.message);
  }

  const { data: history, error: historyError } = await supabase
    .from("status_history")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (historyError) {
    if (isMissingSchemaError(historyError.message)) {
      return <DatabaseSetupRequired />;
    }

    throw new Error(historyError.message);
  }

  const { data: resume, error: resumeError } = await supabase
    .from("user_resumes")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (resumeError) {
    if (isMissingSchemaError(resumeError.message)) {
      return <DatabaseSetupRequired />;
    }

    throw new Error(resumeError.message);
  }

  const applicationsWithStatus = mergeApplicationsWithHistory(
    applications ?? [],
    history ?? [],
  );
  const profile = getUserProfile(user);

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">JobHunter</p>
          <h1>Applications</h1>
        </div>
        <ProfileMenu
          avatarUrl={profile.avatarUrl}
          displayName={profile.displayName}
          email={profile.email}
        />
      </header>

      <ApplicationDashboard
        applications={applicationsWithStatus}
        resume={resume as UserResume | null}
      />
    </main>
  );
}

function getUserProfile(user: {
  email?: string;
  user_metadata?: Record<string, unknown>;
}) {
  const metadata = user.user_metadata ?? {};
  const displayName =
    getString(metadata.full_name) ??
    getString(metadata.name) ??
    user.email ??
    "Account";
  const avatarUrl =
    getString(metadata.avatar_url) ?? getString(metadata.picture);

  return {
    avatarUrl,
    displayName,
    email: user.email,
  };
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function DatabaseSetupRequired() {
  return (
    <SetupRequired
      title="Create the JobHunter tables in Supabase."
      message="Your login is working, but this Supabase project does not have the `applications` and `status_history` tables yet. Open Supabase SQL Editor for this project and run the contents of `sql/setup.sql`, then reload the dashboard."
      showEnvExample={false}
    />
  );
}

function isMissingSchemaError(message: string) {
  return (
    message.includes("schema cache") ||
    message.includes("Could not find the table") ||
    message.includes("relation") && message.includes("does not exist")
  );
}

function mergeApplicationsWithHistory(
  applications: JobApplication[],
  history: StatusHistory[],
): ApplicationWithCurrentStatus[] {
  const historyByApplication = new Map<string, StatusHistory[]>();

  for (const event of history) {
    const events = historyByApplication.get(event.application_id) ?? [];
    events.push(event);
    historyByApplication.set(event.application_id, events);
  }

  return applications
    .map((application) => {
      const events = historyByApplication.get(application.id) ?? [];
      const latest = events[0];

      if (!latest || !APPLICATION_STATUSES.includes(latest.status)) {
        return null;
      }

      return {
        ...application,
        current_status: latest.status,
        status_history: events,
      };
    })
    .filter((application): application is ApplicationWithCurrentStatus =>
      Boolean(application),
    );
}
