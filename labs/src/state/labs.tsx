import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  initialUser,
  sampleBadges,
  sampleCertificates,
  sampleSubmissions,
} from '../data/mockData';
import {
  Lab,
  Badge,
  Certificate,
  User,
  Submission,
  SubmissionStatus,
  LabRunProgress,
} from '../types';
import { api } from '../lib/api';
import { loadLocalDB, saveLocalDB, mergeLabs, sanitizeLabs, canViewLab } from '../lib/persistence';
import { navigate, paths } from '../lib/router';
import { toast } from '../components/ui/Toaster';
import {
  onAuthChange,
  resolveUser,
  signOutFirebase,
} from '../lib/firebase';
import type { ActiveTab } from '../components/Sidebar';

interface LabsContextValue {
  user: User;
  setUser: (updater: User | ((prev: User) => User)) => void;
  labs: Lab[];
  visibleLabs: Lab[];
  badges: Badge[];
  certificates: Certificate[];
  submissions: Submission[];
  users: User[];
  labProgress: Record<string, LabRunProgress>;
  activeLab: Lab | null;
  isLoginOpen: boolean;
  setIsLoginOpen: (open: boolean) => void;
  pendingLab: Lab | null;
  cancelPendingLab: () => void;
  pendingStartLab: Lab | null;
  accessInput: string;
  setAccessInput: (v: string) => void;
  accessError: string | null;
  isLoading: boolean;
  searchQuery: string;
  setSearchQuery: (v: string) => void;

  goToTab: (tab: ActiveTab) => void;
  handleStartLab: (lab: Lab) => void;
  handleOpenDetails: (lab: Lab) => void;
  handleConfirmAccess: () => void;
  handleExitLab: () => void;
  handleLabCompleted: (lab: Lab, xpEarned: number) => void;
  handleAddSubmission: (submission: Submission) => void;
  handleProgressChange: (labId: string, patch: Partial<LabRunProgress>) => void;
  handleCreateLab: (lab: Partial<Lab>) => void;
  handleUpdateLab: (id: string, labData: Partial<Lab>) => void;
  handleDeleteLab: (id: string) => void;
  handleUpdateBadge: (id: string, patch: Partial<Badge>) => void;
  handleCreateBadge: (badge: Partial<Badge>) => void;
  handleDeleteBadge: (id: string) => void;
  handleUpdateSubmission: (id: string, status: SubmissionStatus, note?: string) => void;
  handleDemoLogin: (u: User) => void;
  handleLogout: () => void;
}

const LabsContext = createContext<LabsContextValue | null>(null);

export function LabsProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User>(initialUser);
  // Bootstrap from the persisted store when present so admin edits (including
  // deletions) survive reload — start EMPTY on a fresh browser. Dummy/sample
  // labs must never be shown to users; only the real backend catalog.
  const [labs, setLabs] = useState<Lab[]>(() => {
    const local = loadLocalDB();
    return local?.labs ? local.labs : [];
  });
  const [badges, setBadges] = useState<Badge[]>(() => {
    const local = loadLocalDB();
    // Seed the badge catalog so learners can actually earn badges even on a
    // fresh browser. The backend catalog (if any) overrides on fetch.
    return local?.badges && local.badges.length > 0 ? local.badges : sampleBadges;
  });
  const [certificates, setCertificates] = useState<Certificate[]>(sampleCertificates);
  const [submissions, setSubmissions] = useState<Submission[]>(sampleSubmissions);
  const [users, setUsers] = useState<User[]>([]);
  const [labProgress, setLabProgress] = useState<Record<string, LabRunProgress>>({});
  const [activeLab, setActiveLab] = useState<Lab | null>(null);

  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [pendingLab, setPendingLab] = useState<Lab | null>(null);
  const [pendingStartLab, setPendingStartLab] = useState<Lab | null>(null);
  const [accessInput, setAccessInput] = useState('');
  const [accessError, setAccessError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasHydrated, setHasHydrated] = useState(false);

  const setUser = useCallback(
    (updater: User | ((prev: User) => User)) =>
      setUserState((prev) => (typeof updater === 'function' ? (updater as (p: User) => User)(prev) : updater)),
    [],
  );

  // Hydrate from the local store so edits survive reloads, then reconcile with the backend.
  useEffect(() => {
    const local = loadLocalDB();
    if (local?.labs) setLabs((prev) => mergeLabs(prev, local.labs));
    if (local?.badges && local.badges.length > 0) setBadges(local.badges);
    if (local?.certificates) setCertificates(local.certificates);
    if (local?.submissions) setSubmissions(local.submissions);
    if (local?.users && local.users.length > 0) setUsers(local.users);
    if (local?.user && local.user.id) setUser((prev) => ({ ...prev, ...local.user }));
    if (local?.labProgress) setLabProgress(local.labProgress);
    setHasHydrated(true);
  }, [setUser]);

  // Persist every mutation so "reload" never brings back the old state.
  useEffect(() => {
    if (!hasHydrated) return;
    saveLocalDB({ labs, badges, certificates, submissions, users, user, labProgress });
  }, [labs, badges, certificates, submissions, users, user, labProgress, hasHydrated]);

  // Restore the authenticated session via Firebase Auth. The SDK keeps the
  // ID token fresh (auto-refresh), so no manual session-cookie handling is
  // needed on the client.
  useEffect(() => {
    const unsub = onAuthChange(async (fbUser) => {
      if (fbUser) {
        try {
          const { user: resolved } = await resolveUser(fbUser);
          setUser((prev) => ({ ...prev, ...resolved, githubConnected: true }));
        } catch {
          setUser((prev) => ({
            ...prev,
            id: fbUser.uid,
            name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Learner',
            email: fbUser.email || '',
            avatarUrl: fbUser.photoURL || '',
            githubConnected: true,
          }));
        }
      }
    });
    return unsub;
  }, [setUser]);

  // Sync labs from backend.
  useEffect(() => {
    setIsLoading(true);
    api
      .fetchLabs()
      .then((data) => {
        if (data?.labs) {
          setLabs((prev) => mergeLabs(sanitizeLabs(data.labs), loadLocalDB()?.labs));
        }
      })
      .catch(() => {})
      .finally(() => setTimeout(() => setIsLoading(false), 300));
  }, []);

  // Sync badges, subscriptions, and certificates from the backend so the
  // learner's earned badges / issued certs are not lost across devices.
  useEffect(() => {
    if (!user.githubConnected) return;
    api
      .fetchBadges()
      .then((data) => data?.badges && data.badges.length > 0 && setBadges(data.badges))
      .catch(() => {});

    api
      .fetchSubmissions()
      .then((data) => {
        if (data?.submissions && data.submissions.length > 0 && user.role === 'admin') {
          setSubmissions(data.submissions);
        }
      })
      .catch(() => {});

    api.fetchCertificates().then((data) => {
      if (data?.certificates && data.certificates.length > 0) setCertificates(data.certificates);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.githubConnected, user.role]);

  // Fetch platform users for the admin Users tab — only when the viewer is an
  // admin. Non-admins / visitors should never hit the admin users endpoint.
  useEffect(() => {
    if (user.role !== 'admin') return;
    api
      .fetchUsers()
      .then((data) => {
        const list = data?.users as User[];
        if (list && list.length > 0) setUsers(list);
        else setUsers([user]);
      })
      .catch(() => setUsers([user]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.role]);

  const handleProgressChange = useCallback((labId: string, patch: Partial<LabRunProgress>) => {
    setLabProgress((prev) => ({
      ...prev,
      [labId]: {
        ...(prev[labId] || {
          completedTaskIds: [],
          currentPageId: null,
          timeLeftSeconds: null,
          startedAt: new Date().toISOString(),
        }),
        ...patch,
      },
    }));
  }, []);

  const goToTab = useCallback(
    (tab: ActiveTab) => {
      switch (tab) {
        case 'dashboard':
          navigate(paths.home);
          break;
        case 'catalog':
          navigate(paths.labs);
          break;
        case 'student-progress':
          navigate(paths.certificates);
          break;
        case 'profile':
          navigate(paths.profile);
          break;
        case 'lab-runner':
          navigate(activeLab ? paths.runner(activeLab.id) : paths.labs);
          break;
        case 'admin-panel':
          navigate(paths.admin('labs'));
          break;
        case 'operations':
          navigate(paths.operations);
          break;
      }
    },
    [activeLab],
  );

  const handleStartLab = useCallback(
    (lab: Lab) => {
      if (!user.githubConnected) {
        setPendingStartLab(lab);
        setIsLoginOpen(true);
        return;
      }
      if (lab.password || lab.accessCode) {
        setPendingLab(lab);
        setAccessInput('');
        setAccessError(null);
        return;
      }
      setActiveLab(lab);
      navigate(paths.runner(lab.id));
      setLabProgress((prev) => {
        if (prev[lab.id]) return prev;
        return {
          ...prev,
          [lab.id]: {
            currentPageId: lab.pages?.[0]?.id || null,
            timeLeftSeconds: lab.timeLimitMinutes ? lab.timeLimitMinutes * 60 : null,
            completedTaskIds: [],
            startedAt: new Date().toISOString(),
          },
        };
      });
      // Record enrollment once per user + lab: bump the lab's enrolled count
      // and the user's started-labs list so stats survive reload.
      setLabs((prev) =>
        prev.map((l) =>
          l.id === lab.id ? { ...l, enrolledCount: (l.enrolledCount || 0) + 1 } : l,
        ),
      );
      setUser((prev) => {
        const started = new Set(prev.startedLabIds || []);
        started.add(lab.id);
        return { ...prev, startedLabIds: [...started] };
      });
      api.enrollLab(lab.id).catch(() => {});
    },
    [user.githubConnected],
  );

  const handleOpenDetails = useCallback((lab: Lab) => {
    navigate(paths.lab(lab.slug || lab.id));
  }, []);

  const handleConfirmAccess = useCallback(() => {
    const required = pendingLab?.password || pendingLab?.accessCode || '';
    if (!required) return;
    if (accessInput.trim().toLowerCase() !== required.trim().toLowerCase()) {
      setAccessError('Incorrect access code. Please try again.');
      return;
    }
    const lab = pendingLab;
    setPendingLab(null);
    setAccessInput('');
    setAccessError(null);
    setActiveLab(lab);
    navigate(paths.runner(lab.id));
  }, [pendingLab, accessInput]);

  const handleExitLab = useCallback(() => {
    setActiveLab(null);
    navigate(paths.labs);
  }, []);

  const cancelPendingLab = useCallback(() => {
    setPendingLab(null);
    setAccessError(null);
    setAccessInput('');
  }, []);

  const handleLabCompleted = useCallback(
    (lab: Lab, xpEarned: number) => {
      const now = new Date();
      const earnedBadge = lab.badgeId ? badges.find((b) => b.id === lab.badgeId) : null;

      let badgeXp = 0;
      if (earnedBadge && !earnedBadge.earnedAt) {
        badgeXp = earnedBadge.xpBonus || 0;
        setBadges((prev) =>
          prev.map((b) =>
            b.id === lab.badgeId ? { ...b, earnedAt: now.toISOString().split('T')[0] } : b,
          ),
        );
      }

      setUser((prev) => {
        const completed = new Set(prev.completedLabIds || []);
        completed.add(lab.id);
        return {
          ...prev,
          xp: prev.xp + xpEarned + badgeXp,
          completedLabsCount: prev.completedLabsCount + 1,
          completedLabIds: [...completed],
        };
      });

      // Dedupe certificate issuance — never mint a second cert for the same
      // student + lab, and never when the lab has no publishable credential.
      const alreadyCertified = certificates.some(
        (c) => c.studentId === user.id && c.labTitle === lab.title,
      );
      if (!alreadyCertified) {
        const newCertNumber = `ZEXVRO-CERT-2026-${Date.now()}`;
        const newCert: Certificate = {
          id: `cert_${Date.now()}`,
          certificateNumber: newCertNumber,
          studentId: user.id,
          studentName: user.name,
          labTitle: lab.title,
          category: lab.category,
          issuedAt: now.toISOString().split('T')[0],
          verificationUrl: `https://labs.zexvro.in/verify/${newCertNumber}`,
          instructorName: 'Zexvro Certification Board',
          status: 'issued',
          design: lab.credential?.certificate,
        };
        setCertificates((prev) => [newCert, ...prev]);
        api.createCertificate(newCert);
      }

      // Record an actual lab submission so it appears in the admin Operations
      // panel (reviewable), and persist to the backend submissions store.
      const submission: Submission = {
        id: `sub_${Date.now()}`,
        labId: lab.id,
        userId: user.id,
        userName: user.name || user.username,
        labTitle: lab.title,
        status: 'for_review',
        score: xpEarned,
        submittedAt: new Date().toISOString(),
        type: 'lab',
      };
      setSubmissions((prev) => [submission, ...prev]);
      api.createSubmission(submission);
    },
    [user.id, user.name, badges, certificates, api],
  );

  const handleAddSubmission = useCallback((submission: Submission) => {
    setSubmissions((prev) => [submission, ...prev]);
  }, []);

  const handleCreateLab = useCallback((labData: Partial<Lab>) => {
    api.createLab(labData).then((data) => {
      if (data?.lab) {
        setLabs((prev) => [data.lab!, ...prev]);
        toast('Lab created');
      } else {
        toast('Failed to create lab', 'error');
      }
    });
  }, []);

  const handleUpdateLab = useCallback((id: string, labData: Partial<Lab>) => {
    setLabs((prev) => prev.map((l) => (l.id === id ? { ...l, ...labData } : l)));
    setActiveLab((prev) => (prev && prev.id === id ? { ...prev, ...labData } : prev));
    api.updateLab(id, labData).then((ok) => {
      toast(ok ? 'Lab saved' : 'Failed to save lab', ok ? 'success' : 'error');
    });
  }, []);

  const handleDeleteLab = useCallback((id: string) => {
    setLabs((prev) => prev.filter((l) => l.id !== id));
    if (activeLab?.id === id) setActiveLab(null);
    api.deleteLab(id).then((ok) => {
      toast(ok ? 'Lab deleted' : 'Failed to delete lab', ok ? 'success' : 'error');
    });
  }, [activeLab]);

  const handleUpdateBadge = useCallback((id: string, patch: Partial<Badge>) => {
    setBadges((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    api.updateBadge(id, patch).then((ok) => {
      toast(ok ? 'Badge saved' : 'Failed to save badge', ok ? 'success' : 'error');
    });
  }, []);

  const handleCreateBadge = useCallback((badge: Partial<Badge>) => {
    setBadges((prev) => [badge as Badge, ...prev]);
    api.createBadge(badge).then((ok) => {
      toast(ok ? 'Badge created' : 'Failed to create badge', ok ? 'success' : 'error');
    });
  }, []);

  const handleDeleteBadge = useCallback((id: string) => {
    setBadges((prev) => prev.filter((b) => b.id !== id));
    api.deleteBadge(id).then((ok) => {
      toast(ok ? 'Badge deleted' : 'Failed to delete badge', ok ? 'success' : 'error');
    });
  }, []);

  const handleUpdateSubmission = useCallback(
    (id: string, status: SubmissionStatus, note?: string) => {
      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, status, reviewedBy: user.name, reviewNote: note || s.reviewNote } : s,
        ),
      );
      api.updateSubmission(id, { status, reviewedBy: user.name, reviewNote: note }).then((ok) => {
        toast(
          ok
            ? `Submission ${status === 'passed' ? 'approved' : status === 'rejected' ? 'rejected' : 'pending'}`
            : 'Failed to update submission',
          ok ? 'success' : 'error',
        );
      });
    },
    [user.name],
  );

  const handleDemoLogin = useCallback(
    (u: User) => {
      setUser((prev) => ({ ...prev, ...u, githubConnected: true }));
      setIsLoginOpen(false);
      if (pendingStartLab) {
        const lab = pendingStartLab;
        setPendingStartLab(null);
        handleStartLab(lab);
      }
    },
    [pendingStartLab, handleStartLab],
  );

  const handleLogout = useCallback(() => {
    signOutFirebase().catch(() => {});
    setUser(initialUser);
  }, []);

  const value: LabsContextValue = {
    user,
    setUser,
    labs,
    visibleLabs: labs.filter((l) => canViewLab(l, user)),
    badges,
    certificates,
    submissions,
    users,
    labProgress,
    activeLab,
    isLoginOpen,
    setIsLoginOpen,
    pendingLab,
    cancelPendingLab,
    pendingStartLab,
    accessInput,
    setAccessInput,
    accessError,
    isLoading,
    searchQuery,
    setSearchQuery,
    goToTab,
    handleStartLab,
    handleOpenDetails,
    handleConfirmAccess,
    handleExitLab,
    handleLabCompleted,
    handleAddSubmission,
    handleProgressChange,
    handleCreateLab,
    handleUpdateLab,
    handleDeleteLab,
    handleUpdateBadge,
    handleCreateBadge,
    handleDeleteBadge,
    handleUpdateSubmission,
    handleDemoLogin,
    handleLogout,
  };

  return <LabsContext.Provider value={value}>{children}</LabsContext.Provider>;
}

export function useLabs(): LabsContextValue {
  const ctx = useContext(LabsContext);
  if (!ctx) throw new Error('useLabs must be used inside LabsProvider');
  return ctx;
}
