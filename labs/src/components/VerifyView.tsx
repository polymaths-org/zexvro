import React, { useState, useEffect } from 'react';
import { ShieldCheck, BadgeCheck, CheckCircle2, XCircle, Loader2, ExternalLink } from 'lucide-react';
import { motion } from 'motion/react';
import { CertificatePreview } from './CertificatePreview';
import { Certificate } from '../types';

interface VerifyViewProps {
  certNumber: string;
}

export const VerifyView: React.FC<VerifyViewProps> = ({ certNumber }) => {
  const [state, setState] = useState<'loading' | 'valid' | 'invalid'>('loading');
  const [cert, setCert] = useState<Certificate | null>(null);

  useEffect(() => {
    setState('loading');
    fetch(`/api/certificates/verify/${encodeURIComponent(certNumber)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.valid && data.certificate) {
          setCert(data.certificate);
          setState('valid');
        } else {
          setState('invalid');
        }
      })
      .catch(() => setState('invalid'));
  }, [certNumber]);

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col">
      <header className="sticky top-0 z-40 bg-black/90 backdrop-blur-md border-b border-zinc-800/80 px-4 lg:px-6 py-3 flex items-center justify-between">
        <a href="/" className="flex items-center gap-3">
          <img src="/brand/logo.png" alt="ZEXVRO" className="w-9 h-9 object-contain" />
          <span className="text-[10px] font-mono uppercase tracking-widest bg-zinc-900 text-zinc-300 border border-zinc-700 px-2 py-0.5 rounded-md font-bold">
            VERIFY
          </span>
        </a>
        <a
          href="/"
          className="px-3.5 py-1.5 bg-white text-black text-xs font-bold rounded-xl hover:bg-zinc-200 transition-colors"
        >
          Visit ZEXVRO Labs
        </a>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        {state === 'loading' && (
          <div className="flex flex-col items-center gap-3 text-zinc-400 font-mono text-sm">
            <Loader2 className="h-6 w-6 animate-spin text-blue-accent" />
            Verifying certificate {certNumber}...
          </div>
        )}

        {state === 'valid' && cert && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-3xl space-y-6"
          >
            <div className="flex items-center gap-3 justify-center">
              <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="text-center">
                <h1 className="text-xl sm:text-2xl font-black text-white font-heading">Certificate Verified</h1>
                <p className="text-xs text-emerald-400 font-mono mt-0.5">
                  {cert.certificateNumber} is authentic and issued by ZEXVRO Labs.
                </p>
              </div>
            </div>

            <CertificatePreview
              design={cert.design}
              studentName={cert.studentName}
              labTitle={cert.labTitle}
              issuedAt={cert.issuedAt}
              certNumber={cert.certificateNumber}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Fact label="Issued To" value={cert.studentName} icon={<BadgeCheck className="h-4 w-4" />} />
              <Fact label="Credential" value={cert.labTitle} icon={<ShieldCheck className="h-4 w-4" />} />
              <Fact label="Issued On" value={cert.issuedAt} icon={<BadgeCheck className="h-4 w-4" />} />
            </div>

            <p className="text-center text-xs text-zinc-500 font-mono flex items-center justify-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              Tamper-evident record · Verified via ZEXVRO Labs public ledger
            </p>
          </motion.div>
        )}

        {state === 'invalid' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-zinc-950 border border-red-900 rounded-3xl p-8 text-center max-w-md w-full"
          >
            <div className="w-14 h-14 mx-auto bg-red-950 border border-red-800 rounded-full flex items-center justify-center mb-4">
              <XCircle className="h-7 w-7 text-red-400" />
            </div>
            <h1 className="text-xl font-black text-white font-heading">Unable to verify</h1>
            <p className="text-sm text-zinc-400 mt-2 font-mono">
              No valid ZEXVRO certificate matches <span className="text-white">{certNumber}</span>. Check the link or contact the issuer.
            </p>
            <a
              href="/"
              className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 btn-primary-blue text-white text-sm font-extrabold rounded-xl font-heading"
            >
              <ExternalLink className="h-4 w-4" /> Go to ZEXVRO Labs
            </a>
          </motion.div>
        )}
      </main>
    </div>
  );
};

const Fact: React.FC<{ label: string; value: string; icon: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
    <div className="flex items-center gap-1.5 text-zinc-500 mb-1">
      {icon}
      <span className="text-[10px] font-mono uppercase tracking-widest font-bold">{label}</span>
    </div>
    <p className="text-sm font-bold text-white truncate">{value}</p>
  </div>
);
