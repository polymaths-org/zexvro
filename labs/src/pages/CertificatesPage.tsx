import React from 'react';
import { CertificatesView } from '../components/CertificatesView';
import { useLabs } from '../state/labs';

export const CertificatesPage: React.FC = () => {
  const { user, certificates, badges, labs } = useLabs();
  return <CertificatesView user={user} certificates={certificates} badges={badges} labs={labs} />;
};
