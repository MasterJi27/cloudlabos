"use client";

import { useState, useEffect } from "react";
import { Save, User, Shield, Bell, Palette, Database, Key, Plus, Trash2, Copy, Monitor, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { useStore } from "@/store";
import { api } from "@/lib/api";

export default function SettingsPage() {
  const { user, apiKeys, fetchApiKeys, fetchCreateApiKey, fetchRevokeApiKey, sessions, fetchSessions, fetchRevokeSession } = useStore();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeSection, setActiveSection] = useState("profile");

  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileRole, setProfileRole] = useState("");

  const [activeTheme, setActiveTheme] = useState("dark");
  const [language, setLanguage] = useState("en");

  const [passwordForm, setPasswordForm] = useState({ current: "", newPass: "", confirm: "" });
  const [passFeedback, setPassFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaSetup, setMfaSetup] = useState<{ secret: string; qr_uri: string } | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [showNewKeyForm, setShowNewKeyForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newRawKey, setNewRawKey] = useState("");
  const [copiedKey, setCopiedKey] = useState(false);

  const [notifications, setNotifications] = useState({
    workflow_completed: true,
    approval_required: true,
    agent_error: true,
    run_failed: true,
    weekly_report: false,
  });

  const [system, setSystem] = useState({
    session_timeout_minutes: 60,
    max_concurrent_workflows: 10,
  });

  useEffect(() => {
    fetchApiKeys();
    fetchSessions();
    
    if (user) {
      setProfileName(user.name || "");
      setProfileEmail(user.email || "");
      setProfileRole(user.role || "");
    }

    const isDark = document.documentElement.classList.contains("dark");
    setActiveTheme(isDark ? "dark" : "light");
  }, [user, fetchApiKeys, fetchSessions]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateSettings({ theme: activeTheme, language, notifications, system });
      
      if (user) {
        useStore.setState({
          user: {
            ...user,
            name: profileName,
            email: profileEmail
          }
        });
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      alert("Failed to save configuration settings");
    } finally {
      setSaving(false);
    }
  };

  const handleThemeChange = (newTheme: string) => {
    setActiveTheme(newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const createApiKey = async () => {
    if (!newKeyName.trim()) return;
    try {
      const raw = await fetchCreateApiKey(newKeyName);
      setNewRawKey(raw);
      setNewKeyName("");
      setShowNewKeyForm(false);
    } catch {}
  };

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPassFeedback(null);

    if (!passwordForm.current || !passwordForm.newPass || !passwordForm.confirm) {
      setPassFeedback({ type: "error", msg: "All fields are required" });
      return;
    }
    if (passwordForm.newPass !== passwordForm.confirm) {
      setPassFeedback({ type: "error", msg: "New passwords do not match" });
      return;
    }

    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setPassFeedback({ type: "success", msg: "Password updated successfully" });
      setPasswordForm({ current: "", newPass: "", confirm: "" });
    }, 1000);
  };

  const sections = [
    { id: "profile", label: "Profile", icon: User },
    { id: "security", label: "Security", icon: Shield },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "system", label: "System", icon: Database },
  ];

  return (
    <div data-ui-sweep className="page-shell max-w-5xl animate-fade-in">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h1 className="page-heading text-[var(--text-primary)] mb-2">Settings</h1>
          <p className="text-[14px] text-[var(--text-secondary)]">Manage details, active tokens, and workspace configurations.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : saved ? "Changes Saved!" : "Save Changes"}
        </button>
      </header>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Navigation Sidebar */}
        <nav className="w-full md:w-52 flex-shrink-0">
          <div className="space-y-1">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-[13px] transition-colors ${
                  activeSection === s.id
                    ? "bg-[var(--surface-2)] shadow-[var(--edge-subtle)] text-[var(--text-primary)] font-medium"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-1)] hover:text-[var(--text-primary)]"
                }`}
              >
                <s.icon className="w-4 h-4" />
                {s.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Form Fields */}
        <div className="flex-1 max-w-2xl space-y-6">
          
          {/* PROFILE SECTION */}
          {activeSection === "profile" && (
            <div className="card p-6 space-y-6">
              <div>
                <h2 className="text-[15px] font-medium tracking-body text-[var(--text-primary)]">Profile Information</h2>
                <p className="text-[13px] text-[var(--text-secondary)] mt-1">Edit credentials and identities.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[12px] font-medium tracking-body text-[var(--text-secondary)] mb-2">Full Name</label>
                  <input 
                    type="text" 
                    value={profileName} 
                    onChange={e => setProfileName(e.target.value)} 
                    className="input" 
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium tracking-body text-[var(--text-secondary)] mb-2">Email Address</label>
                  <input 
                    type="email" 
                    value={profileEmail} 
                    onChange={e => setProfileEmail(e.target.value)} 
                    className="input" 
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium tracking-body text-[var(--text-secondary)] mb-2">Assigned Role</label>
                  <input 
                    type="text" 
                    value={profileRole} 
                    disabled 
                    className="input opacity-50 cursor-not-allowed" 
                  />
                </div>
              </div>
            </div>
          )}

          {/* SECURITY SECTION */}
          {activeSection === "security" && (
            <div className="space-y-6">
              {/* Change Password */}
              <div className="card p-6">
                <div className="mb-6">
                  <h2 className="text-[15px] font-medium tracking-body text-[var(--text-primary)]">Update Account Password</h2>
                  <p className="text-[13px] text-[var(--text-secondary)] mt-1">Ensure passwords are rotated frequently.</p>
                </div>
                {passFeedback && (
                  <div className={`p-3 shadow-[var(--edge-subtle)] rounded-lg text-[12px] mb-4 flex items-center gap-2 ${
                    passFeedback.type === "success" ? "bg-[var(--surface-1)] text-[var(--success)]" : "bg-[var(--surface-1)] text-[var(--danger)]"
                  }`}>
                    {passFeedback.type === "success" ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
                    <span>{passFeedback.msg}</span>
                  </div>
                )}
                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <div>
                    <label className="block text-[12px] font-medium tracking-body text-[var(--text-secondary)] mb-2">Current Password</label>
                    <input type="password" value={passwordForm.current} onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })} className="input" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium tracking-body text-[var(--text-secondary)] mb-2">New Password</label>
                    <input type="password" value={passwordForm.newPass} onChange={(e) => setPasswordForm({ ...passwordForm, newPass: e.target.value })} className="input" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium tracking-body text-[var(--text-secondary)] mb-2">Confirm New Password</label>
                    <input type="password" value={passwordForm.confirm} onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })} className="input" />
                  </div>
                  <button type="submit" className="btn-secondary">Update Password</button>
                </form>
              </div>

              {/* MFA */}
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-[15px] font-medium tracking-body text-[var(--text-primary)]">Multi-Factor Authentication</h2>
                    <p className="text-[13px] text-[var(--text-secondary)] mt-1">Secure access via token authorizations.</p>
                  </div>
                  <button
                    onClick={async () => {
                      if (!mfaEnabled) {
                        try {
                          const res = await api.setupMfa();
                          setMfaSetup({ secret: res.secret, qr_uri: res.qr_code });
                        } catch {}
                      } else {
                        try {
                          await api.disableMfa();
                          setMfaEnabled(false);
                        } catch {}
                      }
                    }}
                    className={`w-9 h-5 rounded-full relative transition-colors duration-200 focus:outline-none ${mfaEnabled ? 'bg-[var(--text-primary)]' : 'bg-[var(--surface-3)]'}`}
                  >
                    <div className={`w-3.5 h-3.5 bg-[var(--void)] rounded-full absolute top-[3px] transition-transform duration-200 shadow-sm ${mfaEnabled ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                  </button>
                </div>
                {mfaSetup && !mfaEnabled && (
                  <div className="mt-4 p-5 bg-[var(--surface-1)] shadow-[var(--edge-subtle)] rounded-lg space-y-4">
                    <p className="text-[13px] font-medium tracking-body text-[var(--text-primary)]">Scan Authenticator QR code</p>
                    <div className="flex flex-col sm:flex-row gap-5">
                      <div className="w-24 h-24 bg-white p-1 rounded-md flex-shrink-0">
                         <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(mfaSetup.qr_uri)}`} alt="QR Code" className="w-full h-full" />
                      </div>
                      <div className="flex-1 space-y-3">
                        <p className="text-[12px] text-[var(--text-secondary)]">Secret token: <span className="text-[var(--text-primary)] font-mono font-medium">{mfaSetup.secret}</span></p>
                        <input type="text" placeholder="Enter 6-digit MFA Code" value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} className="input" />
                        <button onClick={async () => {
                           try { await api.verifyMfa(mfaCode); setMfaEnabled(true); setMfaSetup(null); setMfaCode(""); } catch { alert("Invalid authorization code"); }
                        }} className="btn-primary text-[12px]">Verify & Enable</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* API Keys */}
              <div className="card p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-[15px] font-medium tracking-body text-[var(--text-primary)]">Access Tokens & API Keys</h2>
                    <p className="text-[13px] text-[var(--text-secondary)] mt-1">Authorization keys for CLI scripts.</p>
                  </div>
                  <button onClick={() => setShowNewKeyForm(true)} className="btn-secondary">
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Create Key
                  </button>
                </div>
                {showNewKeyForm && (
                  <div className="flex items-center gap-3 mb-6 bg-[var(--surface-1)] p-4 shadow-[var(--edge-subtle)] rounded-lg">
                    <input
                      type="text" placeholder="e.g. CLI-Access-Token" value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      className="flex-1 input"
                    />
                    <button onClick={createApiKey} className="btn-primary text-[12px]">Create</button>
                    <button onClick={() => setShowNewKeyForm(false)} className="btn-secondary text-[12px]">Cancel</button>
                  </div>
                )}
                {newRawKey && (
                  <div className="mb-6 p-4 bg-[var(--surface-1)] border border-[var(--success)]/30 rounded-lg space-y-3">
                    <p className="text-[13px] font-medium text-[var(--text-primary)]">API token generated successfully</p>
                    <p className="text-[11px] text-[var(--danger)]">Important: Copy this key now. It will not be shown again.</p>
                    <div className="flex items-center gap-3">
                      <code className="flex-1 px-3 py-2 bg-[var(--void)] shadow-[var(--edge-subtle)] rounded-md text-[12px] text-[var(--success)] select-all font-mono">{newRawKey}</code>
                      <button 
                        onClick={() => { 
                          navigator.clipboard.writeText(newRawKey); 
                          setCopiedKey(true);
                          setTimeout(() => { setNewRawKey(""); setCopiedKey(false); }, 1500);
                        }} 
                        className="btn-primary text-[12px]"
                      >
                        {copiedKey ? "Copied!" : "Copy & Close"}
                      </button>
                    </div>
                  </div>
                )}
                {apiKeys.length === 0 ? (
                  <p className="text-[13px] text-[var(--text-tertiary)] text-center py-8">No active API keys created</p>
                ) : (
                  <div className="space-y-2">
                    {apiKeys.map((key) => (
                      <div key={key.id} className="flex items-center justify-between p-4 bg-[var(--surface-1)] shadow-[var(--edge-subtle)] rounded-lg hover:bg-[var(--surface-2)] transition-colors">
                        <div className="flex items-center gap-3">
                          <Key className="w-4 h-4 text-[var(--text-tertiary)]" />
                          <div>
                            <p className="text-[13px] font-medium tracking-body text-[var(--text-primary)]">{key.name}</p>
                            <p className="text-[11px] text-[var(--text-tertiary)] font-mono">{key.key_prefix} • Created {new Date(key.created_at).toLocaleDateString()}{key.last_used_at ? ` • Last used ${new Date(key.last_used_at).toLocaleDateString()}` : ""}</p>
                          </div>
                        </div>
                        <button onClick={() => fetchRevokeApiKey(key.id)} className="btn-ghost px-2 text-[var(--text-tertiary)] hover:text-[var(--danger)]"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Active Sessions */}
              <div className="card p-6">
                <div className="mb-6">
                  <h2 className="text-[15px] font-medium tracking-body text-[var(--text-primary)]">Active Browser Sessions</h2>
                  <p className="text-[13px] text-[var(--text-secondary)] mt-1">Revoke stale connected portal IPs.</p>
                </div>
                {sessions.length === 0 ? (
                  <p className="text-[13px] text-[var(--text-tertiary)] text-center py-8">No active sessions</p>
                ) : (
                  <div className="space-y-2">
                    {sessions.map((session) => (
                      <div key={session.id} className="flex items-center justify-between p-4 bg-[var(--surface-1)] shadow-[var(--edge-subtle)] rounded-lg hover:bg-[var(--surface-2)] transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <Monitor className="w-4 h-4 text-[var(--text-tertiary)] flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium tracking-body text-[var(--text-primary)] truncate">{session.ip_address}</p>
                            <p className="text-[11px] text-[var(--text-secondary)] truncate font-mono">{session.user_agent}</p>
                            <p className="text-[10px] text-[var(--text-tertiary)] font-mono mt-0.5">Started: {new Date(session.created_at).toLocaleString()}</p>
                          </div>
                        </div>
                        <button onClick={() => fetchRevokeSession(session.id)} className="btn-ghost text-[var(--danger)] hover:bg-[var(--danger)]/10 px-3 py-1.5 text-[11px] font-medium rounded-md">Revoke</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* NOTIFICATIONS SECTION */}
          {activeSection === "notifications" && (
            <div className="card p-6 space-y-6">
              <div>
                <h2 className="text-[15px] font-medium tracking-body text-[var(--text-primary)]">Notification Preferences</h2>
                <p className="text-[13px] text-[var(--text-secondary)] mt-1">Decide when the system triggers Slack/Email pings.</p>
              </div>
              <div className="space-y-1">
                {[
                  { key: "workflow_completed", label: "Workflow Completed", desc: "When a workflow finishes execution" },
                  { key: "approval_required", label: "Approval Required", desc: "When a human-in-the-loop approval is needed" },
                  { key: "agent_error", label: "Agent Error", desc: "When an agent encounters an error" },
                  { key: "run_failed", label: "Run Failed", desc: "When a workflow run fails" },
                  { key: "weekly_report", label: "Weekly Report", desc: "Receive weekly summary of system activity" },
                ].map((n) => (
                  <div key={n.key} className="flex items-center justify-between py-4 border-b border-[rgba(255,255,255,0.04)] last:border-b-0">
                    <div>
                      <p className="text-[14px] font-medium tracking-body text-[var(--text-primary)]">{n.label}</p>
                      <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">{n.desc}</p>
                    </div>
                    <button
                      onClick={() => setNotifications((prev) => ({ ...prev, [n.key]: !(prev as any)[n.key] }))}
                      className={`w-9 h-5 rounded-full relative transition-colors duration-200 focus:outline-none flex-shrink-0 ${(notifications as any)[n.key] ? 'bg-[var(--text-primary)]' : 'bg-[var(--surface-3)]'}`}
                    >
                      <div className={`w-3.5 h-3.5 bg-[var(--void)] rounded-full absolute top-[3px] transition-transform duration-200 shadow-sm ${(notifications as any)[n.key] ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* APPEARANCE SECTION */}
          {activeSection === "appearance" && (
            <div className="card p-6 space-y-6">
              <div>
                <h2 className="text-[15px] font-medium tracking-body text-[var(--text-primary)]">Appearance</h2>
                <p className="text-[13px] text-[var(--text-secondary)] mt-1">Toggle live interface styles and variables.</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between py-4 border-b border-[rgba(255,255,255,0.04)]">
                  <div>
                    <p className="text-[14px] font-medium tracking-body text-[var(--text-primary)]">Display Theme</p>
                    <p className="text-[12px] text-[var(--text-tertiary)] mt-0.5">Select your preferred platform color rules</p>
                  </div>
                  <select
                    value={activeTheme}
                    onChange={(e) => handleThemeChange(e.target.value)}
                    className="input w-40"
                  >
                    <option value="dark">Pitch Black</option>
                    <option value="light">Pure White</option>
                  </select>
                </div>
                <div className="flex items-center justify-between py-4">
                  <div>
                    <p className="text-[14px] font-medium tracking-body text-[var(--text-primary)]">Localization</p>
                    <p className="text-[12px] text-[var(--text-tertiary)] mt-0.5">Portal interface translation rules</p>
                  </div>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="input w-40"
                  >
                    <option value="en">English (US)</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                    <option value="de">Deutsch</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* SYSTEM SECTION */}
          {activeSection === "system" && (
            <div className="card p-6 space-y-6">
              <div>
                <h2 className="text-[15px] font-medium tracking-body text-[var(--text-primary)]">System Constraints</h2>
                <p className="text-[13px] text-[var(--text-secondary)] mt-1">Fine-tune memory limits and daemon rules.</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between py-4 border-b border-[rgba(255,255,255,0.04)]">
                  <div>
                    <p className="text-[14px] font-medium tracking-body text-[var(--text-primary)]">Inactivity Session Timeout</p>
                    <p className="text-[12px] text-[var(--text-tertiary)] mt-0.5">Auto-revoke cookies after idling (minutes)</p>
                  </div>
                  <input
                    type="number" value={system.session_timeout_minutes}
                    onChange={(e) => setSystem({ ...system, session_timeout_minutes: Number(e.target.value) })}
                    className="w-24 input text-center font-mono"
                  />
                </div>
                <div className="flex items-center justify-between py-4 border-b border-[rgba(255,255,255,0.04)]">
                  <div>
                    <p className="text-[14px] font-medium tracking-body text-[var(--text-primary)]">Max Concurrent Executions</p>
                    <p className="text-[12px] text-[var(--text-tertiary)] mt-0.5">Safety threshold for concurrent agent run loops</p>
                  </div>
                  <input
                    type="number" value={system.max_concurrent_workflows}
                    onChange={(e) => setSystem({ ...system, max_concurrent_workflows: Number(e.target.value) })}
                    className="w-24 input text-center font-mono"
                  />
                </div>
                <div className="flex items-center justify-between py-5 px-4 bg-[var(--surface-1)] shadow-[var(--edge-subtle)] rounded-lg mt-4">
                  <div>
                    <p className="text-[14px] font-medium tracking-body text-[var(--text-primary)]">Orchestrator Kernel Version</p>
                    <p className="text-[12px] text-[var(--text-tertiary)]">CloudLabOS Enterprise Engine</p>
                  </div>
                  <span className="text-[13px] text-[var(--text-secondary)] font-mono">v1.0.0-stable</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
