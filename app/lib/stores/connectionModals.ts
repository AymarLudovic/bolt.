// ~/lib/stores/connectionModals.ts
import { atom } from 'nanostores';

export type ProviderType = 'netlify' | 'vercel' | null;

export const activeConnectionModalAtom = atom<ProviderType>(null);
export const modalTokenInputAtom = atom<string>('');
export const triggerConnectAtom = atom<ProviderType>(null);
