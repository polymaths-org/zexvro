const LEGACY_KEYS=['zexvro_zer0','zexvro_zk_notes','zexvro_user_treasury_v1','zexvro_stealth','zexvro_stealth_claims','zexvro_payment_session'];
/** Preserve recovery access without silently assigning older browser wallets to
 * whichever app account logs in next. This export is local and user initiated. */
export default function LegacyLocalRecovery(){
 const keys=LEGACY_KEYS.filter(key=>localStorage.getItem(key)!==null);
 if(!keys.length)return null;
 const download=()=>{
  const data=Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)]));
  const url=URL.createObjectURL(new Blob([JSON.stringify({format:'zexvro-legacy-local-recovery-v1',data},null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='zexvro-local-recovery.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 return <section aria-label="Older browser wallet recovery" className="rounded-md border border-amber-500/30 p-3 text-sm">
  <p>Older wallet data is preserved separately in this browser. Download a recovery copy before clearing browser storage.</p>
  <p className="mt-1 text-xs text-zinc-500">The file can contain private keys and notes. Keep it private; it is never uploaded.</p>
  <button type="button" onClick={download} className="mt-2 rounded-md border px-3 py-1.5">Download older wallet data</button>
 </section>;
}
