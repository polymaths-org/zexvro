import React, { useState } from 'react';
import { 
  Award, 
  ShieldCheck, 
  Printer, 
  ExternalLink, 
  CheckCircle2, 
  X, 
} from 'lucide-react';
import { motion } from 'motion/react';
import { Certificate, Badge, User, Lab } from '../types';
import { deriveBadges } from '../lib/badges';
import { CertificatePreview } from './CertificatePreview';

interface CertificatesViewProps {
  user: User;
  certificates: Certificate[];
  badges: Badge[];
  labs?: Lab[];
}

export const CertificatesView: React.FC<CertificatesViewProps> = ({
  user,
  certificates,
  badges: catalogBadges,
  labs = [],
}) => {
  const [selectedCert, setSelectedCert] = useState<Certificate | null>(null);
  const badges = labs.length > 0 ? deriveBadges(labs, user) : catalogBadges;

  const handlePrintCert = () => {
    window.print();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 text-zinc-100">
      {/* Header Banner */}
      <div className="bg-zinc-950 border border-zinc-800 p-6 sm:p-8 rounded-3xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs font-mono font-bold rounded-full mb-2">
              <Award className="h-3.5 w-3.5 text-white" />
              <span>STUDENT CREDENTIALS</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight font-heading">
              Progress, Certificates & Badges
            </h1>
            <p className="text-xs text-zinc-400 mt-1 max-w-xl">
              Verifiable cloud skill credentials issued by ZEXVRO Labs. Share your achievements on LinkedIn or GitHub.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-black border border-zinc-800 p-4 rounded-2xl shrink-0 font-mono">
            <div className="text-center">
              <span className="text-[10px] text-zinc-500 uppercase font-bold">Certificates</span>
              <p className="text-xl font-black text-white">{certificates.length}</p>
            </div>
            <div className="h-8 w-[1px] bg-zinc-800" />
            <div className="text-center">
              <span className="text-[10px] text-zinc-500 uppercase font-bold">Badges</span>
              <p className="text-xl font-black text-zinc-300">{badges.filter((b) => b.earnedAt).length}</p>
            </div>
            <div className="h-8 w-[1px] bg-zinc-800" />
            <div className="text-center">
              <span className="text-[10px] text-zinc-500 uppercase font-bold">XP Score</span>
              <p className="text-xl font-black text-white">{user.xp.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 1: Official Certificates Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 font-heading">
            <ShieldCheck className="h-5 w-5 text-white" />
            <span>Verifiable Certificates of Completion</span>
          </h2>
          <span className="text-xs font-mono text-zinc-500">labs.zexvro.in/verify</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {certificates.map((cert) => (
            <motion.div
              key={cert.id}
              whileHover={{ y: -4 }}
              className="bg-zinc-950 border border-zinc-800 hover:border-zinc-500 rounded-2xl p-6 transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 mb-3">
                  <span className="text-white font-bold">{cert.category}</span>
                  <span>Issued: {cert.issuedAt}</span>
                </div>

                {cert.design && cert.design.elements && cert.design.elements.length > 0 && (
                  <div className="mb-3">
                    <CertificatePreview
                      design={cert.design}
                      studentName={cert.studentName}
                      labTitle={cert.labTitle}
                      issuedAt={cert.issuedAt}
                    />
                  </div>
                )}

                <div className="p-3 bg-black border border-zinc-800 rounded-xl mb-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-zinc-500 block uppercase font-bold">Verification ID</span>
                    <span className="text-xs font-mono font-bold text-white">{cert.certificateNumber}</span>
                  </div>
                  <Award className="h-5 w-5 text-zinc-400" />
                </div>

                <h3 className="text-base font-bold text-white group-hover:text-zinc-200 transition-colors line-clamp-2 font-heading">
                  {cert.labTitle}
                </h3>
                <p className="text-xs text-zinc-400 mt-1">Student: <span className="text-zinc-200 font-bold">{cert.studentName}</span></p>
              </div>

              <div className="pt-4 mt-4 border-t border-zinc-800 flex items-center justify-between">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedCert(cert)}
                  className="w-full py-2 bg-white hover:bg-zinc-200 text-black font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md font-heading"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>View Official Certificate</span>
                </motion.button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* SECTION 2: Collectible Skill Badges */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 font-heading">
            <Award className="h-5 w-5 text-white" />
            <span>Skill Badges Gallery</span>
          </h2>
          <span className="text-xs font-mono text-zinc-500">Earned through hands-on labs</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
          {badges.map((badge) => {
            const isEarned = !!badge.earnedAt;
            const design = labs.find((l) => l.badgeId === badge.id)?.credential?.badge;
            return (
              <div
                key={badge.id}
                className={`p-5 rounded-2xl border text-center flex flex-col items-center justify-between transition-all ${
                  isEarned
                    ? 'bg-zinc-950 border-zinc-600 shadow-md'
                    : 'bg-black border-zinc-800/80 opacity-60'
                }`}
              >
                <div className="w-full">
                  <div className="mx-auto mb-3 relative w-16 h-16 overflow-hidden rounded-2xl border border-zinc-700"
                    style={
                      design?.backgroundImage
                        ? {
                            backgroundImage: `url("${design.backgroundImage}")`,
                            backgroundSize: design.bgSize === 'contain' ? 'contain' : 'cover',
                            backgroundPosition: `${design.bgPosX ?? 50}% ${design.bgPosY ?? 50}%`,
                            backgroundRepeat: 'no-repeat',
                          }
                        : { background: design?.background || badge.color }
                    }
                  >
                    {design?.elements ? (
                      design.elements
                        .filter((e) => e.kind === 'icon')
                        .map((e) => (
                          <div
                            key={e.id}
                            className="absolute inset-0 flex items-center justify-center"
                            style={{ color: '#fff' }}
                          >
                            <Award className="w-7 h-7" style={{ opacity: isEarned ? 1 : 0.4 }} />
                          </div>
                        ))
                    ) : badge.imageUrl ? (
                      <img
                        src={badge.imageUrl}
                        alt={badge.name}
                        className={`w-full h-full object-cover ${isEarned ? '' : 'grayscale opacity-40'}`}
                      />
                    ) : (
                      <div
                        className={`w-full h-full flex items-center justify-center ${
                          isEarned ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-600'
                        }`}
                      >
                        <Award className="h-7 w-7" />
                      </div>
                    )}
                  </div>

                  <h4 className="text-xs font-bold text-white line-clamp-1 font-heading">{badge.name}</h4>
                  <p className="text-[10px] text-zinc-400 mt-1 line-clamp-2">{badge.description}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-800 w-full text-[10px] font-mono">
                  {isEarned ? (
                    <span className="text-white font-bold flex items-center justify-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Earned {badge.earnedAt}
                    </span>
                  ) : (
                    <span className="text-zinc-600">Locked (+{badge.xpBonus} XP)</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Official Certificate Modal (Print / View) */}
      {selectedCert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn print:p-0 print:bg-white">
          <div className="relative w-full max-w-3xl bg-black border-2 border-white rounded-3xl p-8 sm:p-12 shadow-[0_0_60px_rgba(255,255,255,0.15)] text-center print:border-4 print:border-black print:text-black print:bg-white print:rounded-none">
            {/* Modal Actions */}
            <div className="absolute top-6 right-6 flex items-center gap-2 print:hidden">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handlePrintCert}
                className="px-3 py-1.5 bg-white text-black font-extrabold rounded-xl text-xs flex items-center gap-1.5 hover:bg-zinc-200 transition-colors font-mono"
              >
                <Printer className="h-4 w-4" />
                <span>Print / Save PDF</span>
              </motion.button>
              <button
                onClick={() => setSelectedCert(null)}
                className="p-2 text-zinc-400 hover:text-white bg-zinc-900 rounded-xl"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Issued certificate rendered from the design (image, not canvas) */}
            <div className="pt-4">
              <CertificatePreview
                design={selectedCert.design}
                studentName={selectedCert.studentName}
                labTitle={selectedCert.labTitle}
                issuedAt={selectedCert.issuedAt}
                certNumber={selectedCert.certificateNumber}
              />
              <div className="flex items-center justify-center gap-2 mt-4 text-[11px] font-mono text-zinc-500">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Verification ID: {selectedCert.certificateNumber}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

