"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Plus, Trash2, X, RefreshCw, Send, CheckCircle2 } from "lucide-react";

interface Member {
  id: string;
  name: string;
  email: string;
  role: "Admin" | "Editor" | "Viewer";
  joinedAt: string;
}

interface Invitation {
  id: string;
  email: string;
  role: "Admin" | "Editor" | "Viewer";
  sentAt: string;
}

const CURRENT_USER_ID = "u1";

const INITIAL_MEMBERS: Member[] = [
  { id: "u1", name: "Alice Smith", email: "alice@cloudlabos.com", role: "Admin", joinedAt: "2026-01-15" },
  { id: "u2", name: "Bob Johnson", email: "bob@example.com", role: "Editor", joinedAt: "2026-03-22" },
  { id: "u3", name: "Charlie Davis", email: "charlie@example.com", role: "Viewer", joinedAt: "2026-05-10" },
];

const INITIAL_INVITATIONS: Invitation[] = [
  { id: "inv1", email: "diana@example.com", role: "Editor", sentAt: "2026-07-16" },
  { id: "inv2", email: "evan@example.com", role: "Viewer", sentAt: "2026-07-17" },
];

const roleStyles: Record<string, string> = {
  Admin: "text-[var(--text-primary)] bg-[var(--surface-2)] shadow-[var(--edge-subtle)]",
  Editor: "text-[var(--success)] bg-[var(--surface-2)] shadow-[var(--edge-subtle)]",
  Viewer: "text-[var(--text-secondary)] bg-[var(--surface-1)] shadow-[var(--edge-subtle)]",
};

export default function InvitationsPage() {
  const [members, setMembers] = useState<Member[]>(INITIAL_MEMBERS);
  const [invitations, setInvitations] = useState<Invitation[]>(INITIAL_INVITATIONS);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"Admin" | "Editor" | "Viewer">("Viewer");
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    const newInvite: Invitation = {
      id: `inv-${Date.now()}`,
      email: inviteEmail,
      role: inviteRole,
      sentAt: new Date().toISOString().split("T")[0],
    };

    setInvitations([newInvite, ...invitations]);
    setInviteSuccess(true);
    setTimeout(() => {
      setInviteSuccess(false);
      setIsModalOpen(false);
      setInviteEmail("");
      setInviteRole("Viewer");
    }, 1500);
  };

  const removeMember = (id: string) => {
    setMembers(members.filter(m => m.id !== id));
  };

  const cancelInvitation = (id: string) => {
    setInvitations(invitations.filter(i => i.id !== id));
  };

  const resendInvitation = (id: string) => {
    const updated = invitations.map(i => {
      if (i.id === id) {
        return { ...i, sentAt: new Date().toISOString().split("T")[0] };
      }
      return i;
    });
    setInvitations(updated);
  };

  return (
    <div data-ui-sweep className="page-shell max-w-4xl animate-fade-in">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h1 className="page-heading text-[var(--text-primary)] mb-2">Team Members</h1>
          <p className="text-[14px] text-[var(--text-secondary)]">Manage who has access to your workspace.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)} 
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Invite Member
        </button>
      </header>

      {/* Workspace Members */}
      <div className="card overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-[rgba(255,255,255,0.06)] bg-[var(--surface-1)]">
          <h2 className="text-[13px] font-medium tracking-body text-[var(--text-primary)]">Workspace Members <span className="text-[var(--text-tertiary)] font-mono">({members.length})</span></h2>
        </div>
        <div className="divide-y divide-[rgba(255,255,255,0.04)]">
          {members.map((member) => (
            <div key={member.id} className="flex items-center justify-between p-6 hover:bg-[var(--surface-1)] transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-[var(--surface-2)] shadow-[var(--edge-subtle)] flex items-center justify-center text-[var(--text-primary)] text-[14px] font-medium">
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[14px] font-medium tracking-body text-[var(--text-primary)]">{member.name}</p>
                    {member.id === CURRENT_USER_ID && (
                      <span className="text-[10px] bg-[var(--surface-2)] shadow-[var(--edge-subtle)] text-[var(--text-secondary)] px-2 py-0.5 rounded-full font-mono">You</span>
                    )}
                  </div>
                  <p className="text-[12px] font-mono text-[var(--text-tertiary)] mt-0.5">{member.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex flex-col items-end gap-1.5">
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-micro ${roleStyles[member.role]}`}>
                    {member.role}
                  </span>
                  <span className="text-[11px] font-mono text-[var(--text-tertiary)]">Joined {member.joinedAt}</span>
                </div>
                {member.id !== CURRENT_USER_ID ? (
                  <button onClick={() => removeMember(member.id)} className="btn-ghost px-2 text-[var(--text-tertiary)] hover:text-[var(--danger)]" title="Remove Member">
                    <Trash2 className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="w-8" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-[rgba(255,255,255,0.06)] bg-[var(--surface-1)]">
            <h2 className="text-[13px] font-medium tracking-body text-[var(--text-primary)]">Pending Invitations <span className="text-[var(--text-tertiary)] font-mono">({invitations.length})</span></h2>
          </div>
          <div className="divide-y divide-[rgba(255,255,255,0.04)]">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between p-6 hover:bg-[var(--surface-1)] transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full border-2 border-dashed border-[rgba(255,255,255,0.1)] flex items-center justify-center text-[var(--text-tertiary)]">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[14px] font-medium tracking-body text-[var(--text-primary)]">{inv.email}</p>
                    <p className="text-[11px] font-mono text-[var(--text-tertiary)] mt-0.5">Sent on {inv.sentAt}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-micro ${roleStyles[inv.role]}`}>
                    {inv.role}
                  </span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => resendInvitation(inv.id)} className="btn-secondary h-8 px-3 text-[11px]">
                      <RefreshCw className="w-3 h-3 mr-1.5" /> Resend
                    </button>
                    <button onClick={() => cancelInvitation(inv.id)} className="btn-ghost px-3 h-8 text-[11px] text-[var(--danger)] hover:bg-[var(--danger)]/10">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-[var(--void)] shadow-[var(--elev-3)] rounded-2xl overflow-hidden border border-[rgba(255,255,255,0.1)]"
            >
              <div className="flex items-center justify-between p-6 shadow-[0_1px_0_0_rgba(255,255,255,0.06)]">
                <h2 className="text-[20px] font-medium tracking-subheader text-[var(--text-primary)]">Invite New Member</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-1.5 rounded-md hover:bg-[var(--surface-1)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6">
                {inviteSuccess ? (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-14 h-14 rounded-full bg-[var(--surface-2)] shadow-[var(--edge-subtle)] text-[var(--success)] flex items-center justify-center mb-4">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <h4 className="text-[18px] font-medium tracking-body text-[var(--text-primary)] mb-2">Invitation Sent!</h4>
                    <p className="text-[13px] text-[var(--text-secondary)]">They will receive an email shortly.</p>
                  </motion.div>
                ) : (
                  <form onSubmit={handleInvite} className="space-y-6">
                    <div>
                      <label className="block text-[12px] font-medium tracking-body text-[var(--text-secondary)] mb-2">Email Address</label>
                      <input 
                        type="email" 
                        required
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="colleague@company.com" 
                        className="input" 
                      />
                    </div>
                    
                    <div>
                      <label className="block text-[12px] font-medium tracking-body text-[var(--text-secondary)] mb-2">Role</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(["Admin", "Editor", "Viewer"] as const).map((role) => (
                          <button
                            key={role}
                            type="button"
                            onClick={() => setInviteRole(role)}
                            className={`py-2.5 px-3 text-[13px] font-medium rounded-lg transition-colors ${
                              inviteRole === role 
                                ? "bg-[var(--text-primary)] text-[var(--void)]" 
                                : "bg-[var(--surface-1)] shadow-[var(--edge-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"
                            }`}
                          >
                            {role}
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] text-[var(--text-tertiary)] mt-3 leading-relaxed">
                        {inviteRole === "Admin" && "Can manage billing, members, and all workspace settings."}
                        {inviteRole === "Editor" && "Can create and edit projects, but cannot manage members."}
                        {inviteRole === "Viewer" && "Can view projects and resources, but cannot make changes."}
                      </p>
                    </div>

                    <div className="pt-2 flex justify-end gap-3">
                      <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">
                        Cancel
                      </button>
                      <button type="submit" className="btn-primary">
                        <Send className="w-4 h-4 mr-1.5" /> Send Invite
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
