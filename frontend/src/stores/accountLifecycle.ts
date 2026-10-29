import {useWorkspaceStore} from './workspace';
import {useProjectStore} from './project';
import {useZer0Store} from './zer0';
import {useStealthStore} from './stealth';
import {useStealthClaimsStore} from './stealthClaims';
import {usePaymentSession} from './paymentSession';
import {withoutAccountStorageWrites} from '../lib/accountStorage';

function resetStore<T>(store:{getInitialState():T;setState(state:T,replace:true):unknown;persist:{rehydrate():unknown}}) {
 store.setState(store.getInitialState(),true);
 void store.persist.rehydrate();
}

/** Run synchronously before the newly signed-in account can render old state. */
export function resetAccountStores() {
 useWorkspaceStore.setState({workspaces:[],currentWorkspaceId:null,isHydrated:false,lastError:null});
 useProjectStore.setState({projects:[],environments:[],serviceInstances:[],deployments:[],currentProjectId:null,lastError:null});
 withoutAccountStorageWrites(()=>{
  // Preserve each destination account's saved state while clearing live memory.
  resetStore(useZer0Store);
  resetStore(useStealthStore);
  resetStore(useStealthClaimsStore);
  resetStore(usePaymentSession);
 });
}
