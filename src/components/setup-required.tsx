import { Wrench } from "lucide-react";

type SetupRequiredProps = {
  title?: string;
  message?: string;
  showEnvExample?: boolean;
};

export function SetupRequired({
  title = "Connect Supabase to start tracking.",
  message = "Add your Supabase project URL and anon key to `.env.local`, then run the SQL in `sql/setup.sql` inside your hosted Supabase project.",
  showEnvExample = true,
}: SetupRequiredProps) {
  return (
    <main className="auth-page">
      <section className="auth-shell" aria-labelledby="setup-title">
        <div className="brand-mark">
          <Wrench aria-hidden="true" size={24} />
        </div>
        <div>
          <p className="eyebrow">Setup required</p>
          <h1 id="setup-title">{title}</h1>
          <p className="auth-copy">{message}</p>
        </div>
        {showEnvExample ? (
          <pre className="env-example">
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key</pre>
        ) : null}
      </section>
    </main>
  );
}
