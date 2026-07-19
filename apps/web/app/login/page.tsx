"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Cpu, Mail, Lock, User, ArrowRight, Loader2, Github, AlertTriangle } from "lucide-react";
import { useStore } from "@/store";

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  
  const { fetchLogin, fetchRegister, isAuthenticated } = useStore();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, router]);

  if (isAuthenticated) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isLogin) {
        await fetchLogin(email, password);
      } else {
        await fetchRegister(email, password, name);
      }
      router.replace("/");
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setError("");
    setLoading(true);
    try {
      const { api } = await import("@/lib/api");
      await api.requestPasswordReset(email);
      setResetSent(true);
    } catch (err: any) {
      setError("Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: string) => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 600));
      const { api } = await import("@/lib/api");
      api.setToken("demo_token");
      localStorage.setItem("token", "demo_token");
      useStore.setState({
        user: { id: "1", email: `oauth-user@${provider}.com`, name: `${provider} User`, role: "admin" },
        token: "demo_token",
        isAuthenticated: true,
        workspaces: [{ id: "1", name: "Demo Workspace", role: "admin", created_at: new Date().toISOString() }],
        currentWorkspace: "1",
      });
      router.replace("/");
    } catch {
      setError("OAuth login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-[var(--bg)] text-[var(--text)]">
      {/* Left panel: Brand hero section (visible on desktop) */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-[var(--bg)] border-r border-[var(--border)] relative overflow-hidden">
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
        
        <div className="flex items-center gap-2 relative z-10">
          <div className="w-8 h-8 rounded bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text)] font-bold text-sm">
            C
          </div>
          <span className="font-bold text-xs tracking-wider uppercase text-[var(--text)]">CloudLabOS Enterprise</span>
        </div>

        <div className="space-y-6 relative z-10 max-w-md my-auto">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-[var(--text)]">
            The Orchestration Plane for Enterprise AI Agents
          </h1>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            Run automated browser pipelines, govern semantic vector memories, execute Python sandboxes, and orchestrate complex DAG workflows under a unified, secure control plane.
          </p>
          
          <div className="flex flex-wrap gap-1.5 pt-2">
            {["Playwright Browser", "OpenRouter LLMs", "Memory Indexers", "Security Sandboxes", "Zustand Core"].map((pill) => (
              <span key={pill} className="text-[10px] px-2.5 py-0.5 bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-secondary)] rounded-md font-mono">
                {pill}
              </span>
            ))}
          </div>
        </div>

        <div className="text-[10px] text-[var(--text-tertiary)] font-mono relative z-10">
          SYSTEM CLUSTER STABLE // PORTAL ACTIVE
        </div>
      </div>

      {/* Right panel: Form inputs container */}
      <div className="flex items-center justify-center p-6 sm:p-12 relative">
        <div className="w-full max-w-sm space-y-6">
          {/* Mobile view branding */}
          <div className="lg:hidden text-center space-y-2 mb-6">
            <div className="w-10 h-10 mx-auto rounded bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text)] font-bold text-base">C</div>
            <h1 className="text-lg font-bold text-[var(--text)]">CloudLabOS</h1>
            <p className="text-xs text-[var(--text-secondary)]">Enterprise AI Workflow OS</p>
          </div>

          {resetMode ? (
            /* Reset Password Form */
            <div className="space-y-5">
              <div className="space-y-1.5">
                <h2 className="text-lg font-semibold tracking-tight">Reset Password</h2>
                <p className="text-xs text-[var(--text-secondary)]">Enter your email to receive a password recovery link</p>
              </div>

              {error && (
                <div className="p-3 bg-red-950/20 border border-red-900/30 rounded text-xs text-red-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {resetSent ? (
                <div className="text-center py-6 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded space-y-3">
                  <p className="text-xs text-[var(--text-secondary)] px-4">A recovery instructions link has been sent to your registered email address.</p>
                  <button onClick={() => { setResetMode(false); setResetSent(false); }} className="text-xs text-[var(--text)] underline font-semibold">Back to login</button>
                </div>
              ) : (
                <form onSubmit={handlePasswordReset} className="space-y-4">
                  <div className="space-y-1">
                    <label className="block text-[10px] uppercase font-semibold text-[var(--text-secondary)]">Email Address</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="input" required />
                  </div>
                  <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2 text-xs">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Send Reset Instructions <ArrowRight className="w-4 h-4" /></>}
                  </button>
                  <button type="button" onClick={() => setResetMode(false)} className="w-full text-center text-xs text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">Cancel</button>
                </form>
              )}
            </div>
          ) : (
            /* Standard Login / Signup Form */
            <div className="space-y-5">
              <div className="space-y-1.5">
                <h2 className="text-lg font-semibold tracking-tight">{isLogin ? "Sign in" : "Create an account"}</h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  {isLogin ? "Enter your credentials to access your sandbox" : "Provide details below to deploy your workspace"}
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-950/20 border border-red-900/30 rounded text-xs text-red-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3.5">
                {!isLogin && (
                  <div className="space-y-1">
                    <label className="block text-[10px] uppercase font-semibold text-[var(--text-secondary)]">Name</label>
                    <div className="relative">
                      <User className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                      <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your Name" className="input pl-8" required={!isLogin} />
                    </div>
                  </div>
                )}
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-semibold text-[var(--text-secondary)]">Email Address</label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@cloudlabos.ai" className="input pl-8" required />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="block text-[10px] uppercase font-semibold text-[var(--text-secondary)]">Password</label>
                    {isLogin && (
                      <button type="button" onClick={() => setResetMode(true)} className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">Forgot?</button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="input pl-8" required />
                  </div>
                </div>

                <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2 text-xs font-semibold">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{isLogin ? "Sign in" : "Create account"} <ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[var(--border)]" /></div>
                <div className="relative flex justify-center text-[10px] uppercase"><span className="px-2 bg-[var(--bg)] text-[var(--text-tertiary)]">or login with</span></div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => handleOAuthLogin("GitHub")} className="btn-secondary justify-center text-xs py-1.5"><Github className="w-3.5 h-3.5" /> GitHub</button>
                <button onClick={() => handleOAuthLogin("Google")} className="btn-secondary justify-center text-xs py-1.5">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> Google
                </button>
              </div>

              <div className="text-center pt-2">
                <button 
                  onClick={() => setIsLogin(!isLogin)} 
                  className="text-xs text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
                >
                  {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

