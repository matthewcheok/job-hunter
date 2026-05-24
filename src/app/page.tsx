import { BriefcaseBusiness } from "lucide-react";
import { redirect } from "next/navigation";
import { signInWithGoogle } from "@/app/actions";
import { SetupRequired } from "@/components/setup-required";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!hasSupabaseEnv()) {
    return <SetupRequired />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="auth-page">
      <section className="auth-shell" aria-labelledby="auth-title">
        <div className="brand-mark">
          <BriefcaseBusiness aria-hidden="true" size={24} />
        </div>
        <div>
          <p className="eyebrow">JobHunter</p>
          <h1 id="auth-title">Keep every application moving.</h1>
          <p className="auth-copy">
            A focused workspace for tracking roles, company notes, listing
            links, and the status trail behind each opportunity.
          </p>
        </div>
        <form action={signInWithGoogle}>
          <button className="primary-button" type="submit">
            Sign in with Google
          </button>
        </form>
      </section>
    </main>
  );
}
