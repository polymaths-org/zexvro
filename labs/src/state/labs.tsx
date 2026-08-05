import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  initialUser,
  sampleBadges,
  sampleCertificates,
  sampleLabs,
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
import { loadLocalDB, saveLocalDB, mergeLabs } from '../lib/persistence';
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
  // deletions) survive reload — sampleLabs is only a first-run fallback and
  // must never resurrect labs the admin deleted.
  const [labs, setLabs] = useState<Lab[]>(() => {
    const local = loadLocalDB();
    return local?.labs ? local.labs : sampleLabs;
  });
  const [badges, setBadges] = useState<Badge[]>(sampleBadges);
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
          setLabs((prev) => mergeLabs(data.labs!, loadLocalDB()?.labs));
        }
      })
      .catch(() => {})
      .finally(() => setTimeout(() => setIsLoading(false), 300));
  }, []);

  // Fetch platform users for the admin Users tab.
  useEffect(() => {
    api
      .fetchUsers()
      .then((data) => {
        const list = data?.users as User[];
        if (list && list.length > 0) setUsers(list);
        else setUsers([user]);
      })
      .catch(() => setUsers([user]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setUser((prev) => ({
        ...prev,
        xp: prev.xp + xpEarned,
        completedLabsCount: prev.completedLabsCount + 1,
      }));

      if (lab.badgeId) {
        setBadges((prev) =>
          prev.map((b) =>
            b.id === lab.badgeId ? { ...b, earnedAt: new Date().toISOString().split('T')[0] } : b,
          ),
        );
      }

      const newCertNumber = `ZEXVRO-CERT-2026-${Math.floor(100 + Math.random() * 900)}`;
      const newCert: Certificate = {
        id: `cert_${Date.now()}`,
        certificateNumber: newCertNumber,
        studentId: user.id,
        studentName: user.name,
        labTitle: lab.title,
        category: lab.category,
        issuedAt: new Date().toISOString().split('T')[0],
        verificationUrl: `https://labs.zexvro.in/verify/${newCertNumber}`,
        instructorName: 'Zexvro Certification Board',
        design: lab.credential?.certificate,
      };

      setCertificates((prev) => [newCert, ...prev]);
      api.createCertificate(newCert);
    },
    [user.id, user.name],
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
