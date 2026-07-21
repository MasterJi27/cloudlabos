"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Plus, Trash2, X, Send, CheckCircle2, AlertTriangle } from "lucide-react";
import { useStore } from "@/store";
import { useToast } from "@/components/ui/Toast";

type MemberRole = "admin" | "member" | "viewer";

const roleStyles: Record<MemberRole, string> = {
  admin: "text-[var(--text-primary)] bg-[var(--surface-2)] shadow-[var(--edge-subtle)]",
  member: "text-[var(--success)] bg-[var(--surface-2)] shadow-[var(--edge-subtle)]",
  viewer: "text-[var(--text-secondary)] bg-[var(--surface-1)] shadow-[var(--edge-subtle)]",
};

const roleLabels: Record<MemberRole, string> = { admin: "Admin", member: "Member", viewer: "Viewer" };

export default function InvitationsPage() {
  const { toast } = useToast();
  const { user, members, fetchMembers, fetchInviteMember, fetchRemoveMember } = useStore();
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>("viewer");
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    fetchMembers().finally(() => setLoading(false));
  }, [fetchMembers]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviting(true);
    setInviteError("");
    try {
      await fetchInviteMember(inviteEmail, inviteRole);
      setInviteSuccess(true);
      await fetchMembers();
      setTimeout(() => {
        setInviteSuccess(false);
        setIsModalOpen(false);
        setInviteEmail("");
        setInviteRole("viewer");
      }, 1500);
    } catch (err: any) {
      setInviteError(err?.message?.includes("404") || /not found/i.test(err?.message || "")
        ? "No CloudLabOS account exists for that email yet — they need to sign up first."
        : (err?.message || "Failed to add member"));
    } finally {
      setInviting(false);
    }
  };

  const removeMember = async (memberId: string) => {
    try {
      await fetchRemoveMember(memberId);
      toast("success", "Member removed");
    } catch (e: any) {
      toast("error", e.message || "Failed to remove member");
    }
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
          <Plus className="w-4 h-4" /> Add Member
        </button>
      </header>

      {/* Workspace Members */}
      <div className="card overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-[rgba(255,255,255,0.06)] bg-[var(--surface-1)]">
          <h2 className="text-[13px] font-medium tracking-body text-[var(--text-primary)]">Workspace Members <span className="text-[var(--text-tertiary)] font-mono">({members.length})</span></h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-[13px] text-[var(--text-tertiary)]">Loading members…</div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center text-[13px] text-[var(--text-tertiary)]">No members yet.</div>
        ) : (
          <div className="divide-y divide-[rgba(255,255,255,0.04)]">
            {members.map((member: any) => (
              <div key={member.id} className="flex items-center justify-between p-6 hover:bg-[var(--surface-1)] transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-[var(--surface-2)] shadow-[var(--edge-subtle)] flex items-center justify-center text-[var(--text-primary)] text-[14px] font-medium">
                    {(member.name || member.email || "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] font-medium tracking-body text-[var(--text-primary)]">{member.name}</p>
                      {member.user_id === user?.id && (
                        <span className="text-[10px] bg-[var(--surface-2)] shadow-[var(--edge-subtle)] text-[var(--text-secondary)] px-2 py-0.5 rounded-full font-mono">You</span>
                      )}
                    </div>
                    <p className="text-[12px] font-mono text-[var(--text-tertiary)] mt-0.5">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex flex-col items-end gap-1.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-micro ${roleStyles[member.role as MemberRole] || roleStyles.viewer}`}>
                      {roleLabels[member.role as MemberRole] || member.role}
                    </span>
                    <span className="text-[11px] font-mono text-[var(--text-tertiary)]">Joined {new Date(member.created_at).toLocaleDateString()}</span>
                  </div>
                  {member.user_id !== user?.id ? (
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
        )}
      </div>

      {/* Add Member Modal */}
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
                <h2 className="text-[20px] font-medium tracking-subheader text-[var(--text-primary)]">Add Workspace Member</h2>
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
                    <h4 className="text-[18px] font-medium tracking-body text-[var(--text-primary)] mb-2">Member Added!</h4>
                    <p className="text-[13px] text-[var(--text-secondary)]">They now have access to this workspace.</p>
                  </motion.div>
                ) : (
                  <form onSubmit={handleInvite} className="space-y-6">
                    <p className="text-[12px] text-[var(--text-tertiary)] -mt-2">The person must already have a CloudLabOS account.</p>
                    {inviteError && (
                      <div className="p-3 bg-[var(--surface-1)] text-[var(--danger)] rounded-lg text-[12px] flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {inviteError}
                      </div>
                    )}
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
                        {(["admin", "member", "viewer"] as const).map((role) => (
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
                            {roleLabels[role]}
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] text-[var(--text-tertiary)] mt-3 leading-relaxed">
                        {inviteRole === "admin" && "Can manage members, delete the workspace, and change all settings."}
                        {inviteRole === "member" && "Can create and run agents, workflows, and memory collections."}
                        {inviteRole === "viewer" && "Can view resources, but cannot make changes."}
                      </p>
                    </div>

                    <div className="pt-2 flex justify-end gap-3">
                      <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">
                        Cancel
                      </button>
                      <button type="submit" disabled={inviting} className="btn-primary disabled:opacity-50">
                        <Send className="w-4 h-4 mr-1.5" /> {inviting ? "Adding..." : "Add Member"}
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
