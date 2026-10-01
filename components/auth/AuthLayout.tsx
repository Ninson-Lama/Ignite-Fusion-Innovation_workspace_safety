import { Brand } from "@/components/Brand";

interface AuthLayoutProps {
  children: React.ReactNode;
  variant?: "default" | "login";
}

export function AuthLayout({ children, variant = "default" }: AuthLayoutProps) {
  const isLogin = variant === "login";

  return (
    <main className={`auth-shell${isLogin ? " auth-shell-login" : ""}`} id="main-content">
      <section className={`auth-visual${isLogin ? " auth-visual-login" : ""}`} aria-label="Automotive warehouse training context">
        <div className="auth-visual-overlay" />
        <div className="auth-visual-grid" />
        <div className="auth-brand"><Brand inverse /></div>
        <div className="auth-visual-copy">
          <p>Operational learning / built for the warehouse floor</p>
          <blockquote>“Notice the risk. Understand the consequence. Choose the safer action.”</blockquote>
          <div className="auth-visual-meta"><span>Immersive scenarios</span><span>Immediate feedback</span><span>Measured progress</span></div>
        </div>
      </section>
      <section className={`auth-panel${isLogin ? " auth-panel-login" : ""}`}>{children}</section>
    </main>
  );
}
