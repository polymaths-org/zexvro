import React from 'react';
import { navigate, paths } from '../lib/router';

export const NotFoundPage: React.FC = () => (
  <div className="p-16 text-center">
    <p className="text-4xl font-black text-white font-heading">404</p>
    <p className="text-sm text-zinc-500 font-mono mt-2">That page does not exist.</p>
    <button
      onClick={() => navigate(paths.home)}
      className="inline-block mt-4 px-4 py-2 btn-primary-blue text-white text-sm font-extrabold rounded-xl font-heading"
    >
      Go Home
    </button>
  </div>
);
