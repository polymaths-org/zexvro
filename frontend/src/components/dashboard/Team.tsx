import React, { useState } from 'react';
import { 
  Users, Plus, Mail, MessageSquare, ShieldAlert, CheckCircle2, 
  Trash2, X, Clipboard, ArrowRight, ArrowDownRight, GitCommit 
} from 'lucide-react';
import { TeamMember, CollaborationNote } from '../../types';
import { mockTeamMembers, mockCollaborationNotes } from '../../data/mock';
import { motion, AnimatePresence } from 'motion/react';

interface TeamProps {
  teamMembers: TeamMember[];
  setTeamMembers: React.Dispatch<React.SetStateAction<TeamMember[]>>;
  openInviteModal: boolean;
  setOpenInviteModal: (open: boolean) => void;
}

export default function Team({ 
  teamMembers, 
  setTeamMembers, 
  openInviteModal, 
  setOpenInviteModal 
}: TeamProps) {
  
  const [collabNotes, setCollabNotes] = useState<CollaborationNote[]>(mockCollaborationNotes);

  // Invite member form state
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'Owner' | 'Admin' | 'Developer' | 'Viewer' | 'Agent'>('Developer');
  const [inviteAlias, setInviteAlias] = useState('');

  // Handoff composer form state
  const [currentState, setCurrentState] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [filesToInspect, setFilesToInspect] = useState('');
  const [doNotTouch, setDoNotTouch] = useState('');
  const [ownerNeeded, setOwnerNeeded] = useState('workspace-admin');

  // Handle member invite
  const handleInviteMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) return;

    const newMember: TeamMember = {
      id: `team-${Date.now()}`,
      name: inviteName,
      alias: inviteAlias || inviteName.toLowerCase().replace(' ', '-'),
      email: inviteEmail,
      role: inviteRole,
      status: 'invited',
      lastActive: 'Invited just now',
      servicesOwned: []
    };

    setTeamMembers([...teamMembers, newMember]);
    
    // Reset form
    setInviteName('');
    setInviteEmail('');
    setInviteAlias('');
    setInviteRole('Developer');
    setOpenInviteModal(false);
  };

  // Handle publishing handoff note
  const handlePublishHandoff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentState.trim() || !nextStep.trim()) return;

    const newNote: CollaborationNote = {
      id: `note-${Date.now()}`,
      author: 'Workspace',
      timestamp: 'Just now',
      currentState,
      nextStep,
      filesToInspect: filesToInspect.split(',').map(f => f.trim()).filter(Boolean),
      doNotTouch: doNotTouch.split(',').map(f => f.trim()).filter(Boolean),
      ownerNeeded
    };

    setCollabNotes([newNote, ...collabNotes]);

    // Reset composer form
    setCurrentState('');
    setNextStep('');
    setFilesToInspect('');
    setDoNotTouch('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold font-heading tracking-tight flex items-center gap-2">
            <Users className="h-5 w-5 text-brand-blue" />
            Team & Collaboration
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Synchronize human and autonomous agent interactions inside your workspace
          </p>
        </div>
        <button
          onClick={() => setOpenInviteModal(true)}
          className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-100 font-medium text-xs transition-colors self-start sm:self-auto cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          Invite Member
        </button>
      </div>

      {/* Main Split Screen */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left Col (2 Columns wide): Member List & Feed */}
        <div className="xl:col-span-2 space-y-6">
          
          {/* Members Registry table */}
          <div className="p-4 rounded-lg border border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#0A0A0B]">
            <span className="text-xs font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mb-4">Workspace Registry</span>
            {teamMembers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="p-3 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-400 mb-3">
                  <Users className="h-5 w-5" />
                </div>
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">No team members yet</p>
                <p className="text-[11px] text-zinc-400 mt-1">Invite your first teammate to start collaborating.</p>
                <button
                  onClick={() => setOpenInviteModal(true)}
                  className="mt-4 flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 text-xs font-medium cursor-pointer hover:bg-zinc-800 dark:hover:bg-zinc-100"
                >
                  <Plus className="h-3 w-3" />
                  Invite Member
                </button>
              </div>
            ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800 pb-2 font-mono text-zinc-400">
                    <th className="pb-2">Name & Alias</th>
                    <th className="pb-2">Role</th>
                    <th className="pb-2">Last active</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2 text-right">Scope Owned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-mono">
                  {teamMembers.map((member) => (
                    <tr key={member.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10">
                      <td className="py-3">
                        <span className="font-semibold text-zinc-900 dark:text-white block">{member.name}</span>
                        <span className="text-[10px] text-zinc-400">@{member.alias} • {member.email}</span>
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-semibold border ${
                          member.role === 'Owner' 
                            ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' 
                            : member.role === 'Agent'
                            ? 'bg-brand-blue/10 text-brand-blue border-brand-blue/20'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700'
                        }`}>
                          {member.role}
                        </span>
                      </td>
                      <td className="py-3 text-zinc-500 dark:text-zinc-400 text-[10px]">{member.lastActive}</td>
                      <td className="py-3">
                        <span className={`inline-flex items-center gap-1 text-[10px] ${
                          member.status === 'active' ? 'text-emerald-500' : 'text-amber-500'
                        }`}>
                          <span className={`h-1 w-1 rounded-full ${
                            member.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                          }`}></span>
                          {member.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 text-right text-[10px] text-zinc-400">
                        {member.servicesOwned.length > 0 ? (
                          <span>{member.servicesOwned.length} modules</span>
                        ) : (
                          <span>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </div>

          {/* Active Collaboration Feed */}
          <div className="space-y-4">
            <span className="text-xs font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">Active Handoff Feed</span>
            <div className="space-y-4">
              {collabNotes.map((note) => (
                <div 
                  key={note.id} 
                  className="p-4 rounded-lg border border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#0A0A0B] space-y-3.5"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800/80 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-zinc-100 dark:bg-zinc-800 text-brand-blue flex items-center justify-center font-bold text-xs font-mono">
                        {note.author.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="font-mono text-xs">
                        <span className="font-semibold text-zinc-900 dark:text-white">@{note.author}</span>
                        <span className="text-zinc-400 font-normal"> published a handoff note</span>
                      </div>
                    </div>
                    <span className="font-mono text-[9px] text-zinc-400">{note.timestamp}</span>
                  </div>

                  {/* Body grid representing structure */}
                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase block">Current State</span>
                      <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mt-1">{note.currentState}</p>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase block">Next Step Plan</span>
                      <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mt-1 flex items-start gap-1.5 font-medium">
                        <ArrowDownRight className="h-4.5 w-4.5 text-brand-blue shrink-0 mt-0.5" />
                        {note.nextStep}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 border-t border-zinc-100 dark:border-zinc-800/50 pt-2.5">
                      <div className="font-mono text-[10px] space-y-1">
                        <span className="text-zinc-400 uppercase">Files to Inspect</span>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {note.filesToInspect.length > 0 ? note.filesToInspect.map(f => (
                            <span key={f} className="px-1.5 py-0.5 rounded border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-[9px] text-zinc-500">{f}</span>
                          )) : <span className="text-zinc-500 italic">None</span>}
                        </div>
                      </div>
                      <div className="font-mono text-[10px] space-y-1">
                        <span className="text-red-400 uppercase">DO NOT TOUCH</span>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {note.doNotTouch.length > 0 ? note.doNotTouch.map(f => (
                            <span key={f} className="px-1.5 py-0.5 rounded border border-red-500/10 bg-red-500/5 text-[9px] text-red-400">{f}</span>
                          )) : <span className="text-zinc-500 italic">None</span>}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800/50 pt-2 font-mono text-[10px] text-zinc-400">
                    <span>Handoff saved to workspace memory</span>
                    <span>Owner needed: <span className="text-brand-blue font-semibold">@{note.ownerNeeded}</span></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Col: Handoff composer note */}
        <div className="p-4 rounded-lg border border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#0A0A0B] h-fit space-y-4">
          <div className="border-b border-zinc-100 dark:border-zinc-800 pb-2">
            <span className="text-xs font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">Compose handoff note</span>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 leading-normal">
              Publish structured engineering handoffs that both human teammates and operations agents can parse instantly.
            </p>
          </div>

          <form onSubmit={handlePublishHandoff} className="space-y-3.5">
            {/* Current State */}
            <div>
              <label className="block text-[10px] font-mono font-semibold text-zinc-500 uppercase mb-1">Current State</label>
              <textarea
                required
                rows={2}
                placeholder="What is the current status of the codebase or deployment?"
                value={currentState}
                onChange={(e) => setCurrentState(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50/20 dark:bg-zinc-900/10 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-brand-blue"
              />
            </div>

            {/* Next Step */}
            <div>
              <label className="block text-[10px] font-mono font-semibold text-zinc-500 uppercase mb-1">Next Step Plan</label>
              <textarea
                required
                rows={2}
                placeholder="What exactly needs to be executed next?"
                value={nextStep}
                onChange={(e) => setNextStep(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50/20 dark:bg-zinc-900/10 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-brand-blue"
              />
            </div>

            {/* Files to Inspect */}
            <div>
              <label className="block text-[10px] font-mono font-semibold text-zinc-500 uppercase mb-1">Files to Inspect (comma separated)</label>
              <input
                type="text"
                placeholder="e.g. src/App.tsx, src/data/mock.ts"
                value={filesToInspect}
                onChange={(e) => setFilesToInspect(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50/20 dark:bg-zinc-900/10 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-brand-blue"
              />
            </div>

            {/* Do Not Touch */}
            <div>
              <label className="block text-[10px] font-mono font-semibold text-zinc-500 uppercase mb-1">DO NOT TOUCH (comma separated)</label>
              <input
                type="text"
                placeholder="e.g. backend secrets, service owner files"
                value={doNotTouch}
                onChange={(e) => setDoNotTouch(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50/20 dark:bg-zinc-900/10 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-brand-blue"
              />
            </div>

            {/* Assigned Owner */}
            <div>
              <label className="block text-[10px] font-mono font-semibold text-zinc-500 uppercase mb-1">Assigned Owner Needed</label>
              <select
                value={ownerNeeded}
                onChange={(e) => setOwnerNeeded(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0A0A0B] text-zinc-800 dark:text-zinc-200 focus:outline-none"
              >
                {teamMembers.map(m => (
                  <option key={m.id} value={m.alias}>@{m.alias} ({m.name})</option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-2 rounded font-mono text-xs font-bold text-center bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors cursor-pointer"
            >
              Publish Handoff Note
            </button>
          </form>
        </div>

      </div>

      {/* Invite Modal */}
      <AnimatePresence>
        {openInviteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpenInviteModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            ></motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              className="relative w-full max-w-md overflow-hidden rounded-lg border border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#0A0A0B] p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-white font-heading">Invite teammate to ZEXVRO</h3>
                <button onClick={() => setOpenInviteModal(false)} className="text-zinc-400 hover:text-zinc-600">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleInviteMember} className="space-y-4 mt-4 text-xs">
                <div>
                  <label className="block text-[10px] font-mono font-semibold text-zinc-500 uppercase mb-1.5">Teammate Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/20 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-brand-blue"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-semibold text-zinc-500 uppercase mb-1.5">Developer Alias</label>
                  <input
                    type="text"
                    placeholder="e.g. jdoe-core"
                    value={inviteAlias}
                    onChange={(e) => setInviteAlias(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/20 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-brand-blue"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-semibold text-zinc-500 uppercase mb-1.5">Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. john@zexvro.io"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/20 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-brand-blue"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-semibold text-zinc-500 uppercase mb-1.5">Platform Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                    className="w-full px-3 py-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0A0A0B] text-zinc-800 dark:text-zinc-200 focus:outline-none"
                  >
                    <option value="Owner">Owner</option>
                    <option value="Admin">Admin</option>
                    <option value="Developer">Developer</option>
                    <option value="Viewer">Viewer</option>
                    <option value="Agent">Autonomous Agent</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setOpenInviteModal(false)}
                    className="px-3 py-2 font-semibold text-zinc-400 hover:text-zinc-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 font-semibold rounded bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-100 cursor-pointer"
                  >
                    Send Invitation
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
