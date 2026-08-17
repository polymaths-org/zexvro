import React from 'react';

export const DevPage: React.FC = () => (
  <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 text-center">
    <img src="/dev.gif" alt="" className="w-64 h-64 object-contain" />
    <h1 className="mt-8 text-3xl font-black text-white font-heading sm:text-4xl">
      Platform Under Maintenance
    </h1>
    <p className="mt-3 max-w-md text-sm text-zinc-400 font-mono">
      The SPPU lab session has wrapped up and we re taking a short break. Please check back in a bit.
    </p>
  </div>
);