import { useState } from 'react';
import {
  Eye, EyeOff, ShieldCheck, Globe, Building2, Check, X, Info, AlertTriangle,
} from 'lucide-react';
import { DENOMINATION_XLM } from '../../api/privacyPool';

type PrivacyMode = 'shielded' | 'transparent';

type Disclosure = {
  label: string;
  public: string;
  private: string;
  onExplorer: boolean;
  inZexvro: boolean;
  note?: string;
};

function buildDisclosure(mode: PrivacyMode): Disclosure[] {
  const unit = DENOMINATION_XLM;
  const isShielded = mode === 'shielded';

  if (isShielded) {
    return [
      {
        label: 'Company → employee link',
        public: 'Broken — money goes through the shared privacy pool first',
        private: 'Full link: who was paid, why, and for how much',
        onExplorer: false,
        inZexvro: true,
        note: 'Explorers do not show “Acme paid Alice $4,500 salary” as one fact.',
      },
      {
        label: 'Payroll amount (true salary)',
        public: `Not shown as one amount. Split into fixed ${unit} XLM pool units`,
        private: 'Exact amount, currency, and internal memo',
        onExplorer: false,
        inZexvro: true,
        note: `A $4,500-style pay becomes multiple ${unit} XLM notes so no single public transfer equals salary.`,
      },
      {
        label: 'Employee name & role',
        public: 'Not on the blockchain',
        private: 'Name, department, email, pay type',
        onExplorer: false,
        inZexvro: true,
      },
      {
        label: 'Employee wallet address',
        public: 'Visible only as the withdraw destination of a pool payout',
        private: 'Stored with the payee record',
        onExplorer: true,
        inZexvro: true,
        note: 'Someone can see a wallet received unit-sized XLM from the pool — not who the employer is or the full salary.',
      },
      {
        label: 'Company funding wallet',
        public: 'Visible when depositing into the pool (unit-sized transfers in)',
        private: 'Your connected funding wallet',
        onExplorer: true,
        inZexvro: true,
        note: 'Deposit side shows company wallet → pool. Withdraw side shows pool → payee. Linking them requires guessing among all pool users.',
      },
      {
        label: 'Privacy pool contract',
        public: 'Public contract address, deposit count, Merkle root',
        private: 'Same, plus your deposit notes (secrets) in app storage',
        onExplorer: true,
        inZexvro: true,
      },
      {
        label: 'Each on-chain transfer amount',
        public: `Yes — always ${unit} XLM per pool unit (ledger rule: amounts are not secret)`,
        private: 'Sum of units = your payroll total',
        onExplorer: true,
        inZexvro: true,
        note: 'Blockchains always show transfer sizes. Privacy comes from fixed units + mixing, not from hiding the number field.',
      },
      {
        label: 'Zero-knowledge proof',
        public: 'Proof is verified on-chain (valid / invalid). Contents of the proof do not reveal which deposit',
        private: 'Proof metadata + payment ID for audit trail',
        onExplorer: true,
        inZexvro: true,
      },
      {
        label: 'Internal memo / invoice notes',
        public: 'Not written on-chain for shielded pays',
        private: 'Full memo in payment history',
        onExplorer: false,
        inZexvro: true,
      },
      {
        label: 'Nullifier (spent marker)',
        public: 'Hash only — proves a deposit was spent once, not which one',
        private: 'Linked to your deposit note in the app',
        onExplorer: true,
        inZexvro: true,
      },
    ];
  }

  return [
    {
      label: 'Company → employee link',
      public: 'Fully visible — direct wallet-to-wallet payment',
      private: 'Same as public, plus HR labels',
      onExplorer: true,
      inZexvro: true,
    },
    {
      label: 'Payroll amount',
      public: 'Exact amount on the ledger',
      private: 'Exact amount + internal classification',
      onExplorer: true,
      inZexvro: true,
    },
    {
      label: 'Employee name',
      public: 'Not on-chain (names are off-chain)',
      private: 'Name and role in ZEXVRO',
      onExplorer: false,
      inZexvro: true,
    },
    {
      label: 'Employee wallet',
      public: 'Yes — destination of the payment',
      private: 'Yes',
      onExplorer: true,
      inZexvro: true,
    },
    {
      label: 'Company wallet',
      public: 'Yes — source of the payment',
      private: 'Yes',
      onExplorer: true,
      inZexvro: true,
    },
    {
      label: 'Memo',
      public: 'If you attach one (up to 28 chars on Stellar)',
      private: 'Full notes in app',
      onExplorer: true,
      inZexvro: true,
    },
    {
      label: 'ZK proof',
      public: 'None',
      private: 'N/A',
      onExplorer: false,
      inZexvro: false,
    },
  ];
}

export default function Zer0DataPreview() {
  const [mode, setMode] = useState<PrivacyMode>('shielded');
  const unit = DENOMINATION_XLM;
  const rows = buildDisclosure(mode);
  const isShielded = mode === 'shielded';

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-lg font-bold text-zinc-900 dark:text-white">What stays private?</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Plain-language disclosure of what Stellar explorers show vs what only your finance team sees in ZEXVRO.
          No marketing claims — this matches how the live privacy pool works today.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setMode('shielded')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
            isShielded
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'
          }`}>
          <EyeOff className="h-3.5 w-3.5" />
          Private payroll (shielded)
        </button>
        <button type="button" onClick={() => setMode('transparent')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
            !isShielded
              ? 'bg-zinc-800 text-white dark:bg-white dark:text-zinc-900 shadow-sm'
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'
          }`}>
          <Eye className="h-3.5 w-3.5" />
          Public transfer (transparent)
        </button>
      </div>

      {/* How it helps */}
      <div className={`rounded-xl border p-4 ${
        isShielded ? 'border-blue-200 bg-blue-50/50 dark:border-blue-500/20 dark:bg-blue-950/20' : 'border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/40'
      }`}>
        <div className="flex items-start gap-3">
          <Info className={`h-5 w-5 shrink-0 mt-0.5 ${isShielded ? 'text-blue-500' : 'text-zinc-500'}`} />
          <div className="space-y-2 text-[12px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
              {isShielded ? 'How private payroll helps finance teams' : 'When public transfers make sense'}
            </h3>
            {isShielded ? (
              <ul className="list-disc pl-4 space-y-1.5">
                <li><strong className="text-zinc-800 dark:text-zinc-200">Salary confidentiality</strong> — competitors and public explorers cannot read exact compensation from a single payment graph.</li>
                <li><strong className="text-zinc-800 dark:text-zinc-200">Still auditable internally</strong> — ZEXVRO keeps employee, amount, type, timestamps, and tx references for your books.</li>
                <li><strong className="text-zinc-800 dark:text-zinc-200">On-chain integrity</strong> — the pool verifies a real zero-knowledge proof before releasing funds; double-spend is blocked by nullifiers.</li>
                <li><strong className="text-zinc-800 dark:text-zinc-200">Fixed units ({unit} XLM)</strong> — every pool move looks the same size, so amount is not a fingerprint of one salary.</li>
              </ul>
            ) : (
              <ul className="list-disc pl-4 space-y-1.5">
                <li>Use for public grants, vendor invoices that must be fully open, or demo transfers.</li>
                <li>Source wallet, destination wallet, and amount are all visible on Stellar Expert.</li>
                <li>No privacy pool steps — one direct transfer and one wallet signature.</li>
              </ul>
            )}
          </div>
        </div>
      </div>

      {isShielded && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 dark:border-amber-800/40 dark:bg-amber-950/20 p-4 flex gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-[11px] text-amber-900/80 dark:text-amber-200/80 space-y-1">
            <p className="font-bold text-amber-800 dark:text-amber-300">Honest limits (read this)</p>
            <p>Ledger software always displays the numeric amount of each transfer. We do <em>not</em> claim explorers show “hidden” or “Pedersen commitment” amounts. Privacy is <strong>unlinkability</strong>: unit-sized pool deposits and withdrawals mixed with everyone else using the same pool — not invisible numbers.</p>
          </div>
        </div>
      )}

      {/* Two columns: public vs internal */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-4 py-3">
            <Globe className="h-4 w-4 text-amber-500" />
            <div>
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider block">Public (Stellar explorers)</span>
              <span className="text-[10px] text-zinc-400">Anyone with a block explorer</span>
            </div>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60 bg-white dark:bg-[#0A0A0B]">
            {rows.map(r => (
              <div key={r.label} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">{r.label}</span>
                  {r.onExplorer ? (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase text-amber-600 dark:text-amber-400">
                      <Check className="h-2.5 w-2.5" /> Visible
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase text-zinc-400">
                      <X className="h-2.5 w-2.5" /> Not public
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">{r.public}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-4 py-3">
            <Building2 className="h-4 w-4 text-blue-500" />
            <div>
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider block">Your books (ZEXVRO)</span>
              <span className="text-[10px] text-zinc-400">Finance, HR, auditors with app access</span>
            </div>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60 bg-white dark:bg-[#0A0A0B]">
            {rows.map(r => (
              <div key={r.label} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">{r.label}</span>
                  {r.inZexvro ? (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                      <Check className="h-2.5 w-2.5" /> In app
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase text-zinc-400">
                      <X className="h-2.5 w-2.5" /> N/A
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">{r.private}</p>
                {r.note && (
                  <p className="text-[10px] text-zinc-400 mt-1.5 italic leading-snug">{r.note}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Simple flow */}
      {isShielded && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
          <h3 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-blue-500" /> What happens when you run a private payment
          </h3>
          <ol className="grid sm:grid-cols-3 gap-3 text-[11px] text-zinc-600 dark:text-zinc-400">
            <li className="rounded-lg border border-zinc-100 dark:border-zinc-800 p-3">
              <span className="font-bold text-zinc-800 dark:text-zinc-200 block mb-1">1. Fund the pool</span>
              Company wallet sends {unit} XLM unit(s) into the shared pool. Explorer: company → pool.
            </li>
            <li className="rounded-lg border border-zinc-100 dark:border-zinc-800 p-3">
              <span className="font-bold text-zinc-800 dark:text-zinc-200 block mb-1">2. Register deposit</span>
              A cryptographic commitment is stored (not the salary). Secrets stay in the browser / your notes.
            </li>
            <li className="rounded-lg border border-zinc-100 dark:border-zinc-800 p-3">
              <span className="font-bold text-zinc-800 dark:text-zinc-200 block mb-1">3. Pay the person</span>
              A ZK proof unlocks a unit payout to the employee wallet. Explorer: pool → employee (unit size).
            </li>
          </ol>
          <p className="text-[10px] text-zinc-400 mt-3">
            Larger payroll amounts use multiple units. Each unit needs its own deposit + withdraw (and Freighter signatures).
          </p>
        </div>
      )}

      {/* Quick matrix */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Quick reference</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 text-left text-zinc-400">
                <th className="px-4 py-2 font-semibold">Question</th>
                <th className="px-4 py-2 font-semibold">Private payroll</th>
                <th className="px-4 py-2 font-semibold">Public transfer</th>
              </tr>
            </thead>
            <tbody className="text-zinc-600 dark:text-zinc-400">
              {[
                ['Can a stranger see exact salary?', 'No (split into units + mixed)', 'Yes'],
                ['Can a stranger see employee wallet got paid?', 'Yes, unit-sized from pool', 'Yes, full amount from company'],
                ['Can a stranger link company to that salary?', 'Hard — pool mixes users', 'Easy — direct payment'],
                ['Can finance export a full ledger?', 'Yes, from ZEXVRO', 'Yes'],
                ['Proof of payment integrity?', 'On-chain ZK verify', 'Standard Stellar tx'],
              ].map(([q, a, b]) => (
                <tr key={q} className="border-b border-zinc-50 dark:border-zinc-800/60">
                  <td className="px-4 py-2.5 font-medium text-zinc-800 dark:text-zinc-200">{q}</td>
                  <td className="px-4 py-2.5">{a}</td>
                  <td className="px-4 py-2.5">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
