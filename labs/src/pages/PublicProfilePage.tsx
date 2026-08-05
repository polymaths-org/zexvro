import React, { useEffect, useState } from 'react';
import { ProfileView } from '../components/ProfileView';
import { User, Certificate } from '../types';
import { navigate, paths } from '../lib/router';

export const PublicProfilePage: React.FC<{ username: string }> = ({ username }) => {
  const [state, setState] = useState<'loading' | 'found' | 'missing'>('loading');
  const [profile, setProfile] = useState<{ user: User; certificates: Certificate[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setProfile(null);
    fetch(`/api/users/${encodeURIComponent(username)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.user) {
          setProfile({ user: data.user, certificates: data.certificates || [] });
          setState('found');
        } else {
          setState('missing');
        }
      })
      .catch(() => !cancelled && setState('missing'));
    return () => {
      cancelled = true;
    };
  }, [username]);

  if (state === 'loading') {
    return (
      <div className="p-16 text-center text-zinc-500 font-mono text-sm animate-pulse">
        Loading profile...
      </div>
    );
  }

  if (state === 'missing' || !profile) {
    return (
      <div className="p-16 text-center">
        <p className="text-4xl font-black text-white font-heading">404</p>
        <p className="text-sm text-zinc-500 font-mono mt-2">
          No ZEXVRO learner found for this profile link.
        </p>
        <button
          onClick={() => navigate(paths.home)}
          className="inline-block mt-4 px-4 py-2 btn-primary-blue text-white text-sm font-extrabold rounded-xl font-heading"
        >
          Back to Labs
        </button>
      </div>
    );
  }

  return (
    <ProfileView
      user={profile.user}
      badges={[]}
      certificates={profile.certificates}
    />
  );
};
