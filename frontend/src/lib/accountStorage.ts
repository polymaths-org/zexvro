/** Account-scoped browser state. Legacy unscoped data is retained, never assigned
 * to whichever user happens to log in next. No private keys are sent to D1. */
let suspended = 0;
export function currentStorageAccount(): string {
  try {return JSON.parse(localStorage.getItem('zexvro_user_session') || '{}').username || 'signed-out'} catch {return 'signed-out'}
}
export function accountStorageKey(key: string): string {
  return `${key}:account:${encodeURIComponent(currentStorageAccount())}`;
}
export const accountStorage = {
  getItem: (key:string) => localStorage.getItem(accountStorageKey(key)),
  setItem: (key:string,value:string) => {if(!suspended)localStorage.setItem(accountStorageKey(key),value)},
  removeItem: (key:string) => {if(!suspended)localStorage.removeItem(accountStorageKey(key))},
};
export function withoutAccountStorageWrites(callback:()=>void) {
  suspended++;try {callback()} finally {suspended--}
}
export function notifyAccountChanged(previous:string) {
 if(typeof window!=='undefined' && previous!==currentStorageAccount())window.dispatchEvent(new Event('zexvro:account-changed'));
}
