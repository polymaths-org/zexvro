import React from 'react';
import { VerifyView } from '../components/VerifyView';

export const VerifyPage: React.FC<{ number: string }> = ({ number }) => (
  <VerifyView certNumber={number} />
);
