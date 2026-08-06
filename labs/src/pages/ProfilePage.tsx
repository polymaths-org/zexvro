import React from 'react';
import { ProfileView } from '../components/ProfileView';
import { useLabs } from '../state/labs';

export const ProfilePage: React.FC = () => {
  const { user, badges, certificates, labs } = useLabs();
  return <ProfileView user={user} badges={badges} certificates={certificates} labs={labs} />;
};
