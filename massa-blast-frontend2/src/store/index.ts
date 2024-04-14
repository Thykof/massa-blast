import accountStore, { AccountStoreState } from './accountStore';
import { _getFromStorage } from '../utils/storage';
import { LAST_USED_ACCOUNT } from '../const/const';
import {
  providers as getProviders,
  ProvidersListener,
} from '@massalabs/wallet-provider';
import { create } from 'zustand';

export const useAccountStore = create<AccountStoreState>((set, get) => ({
  ...accountStore(set, get),
}));

async function updateProviders() {
  const { setProviders } = useAccountStore.getState();
  const providers = await getProviders();
  setProviders(providers);
  return providers;
}

async function initAccountStore() {
  const providers = await updateProviders();

  const storedAccount = _getFromStorage(LAST_USED_ACCOUNT);
  if (storedAccount) {
    const { provider: lastUsedProvider } = JSON.parse(storedAccount);
    const provider = providers.find((p) => p.name() === lastUsedProvider);
    if (provider) {
      useAccountStore.getState().setCurrentProvider(provider);
    }
  }

  new ProvidersListener(2000).subscribe((providers) => {
    useAccountStore.getState().setProviders(providers);
  });
}

async function initializeStores() {
  await initAccountStore();
}

initializeStores();
