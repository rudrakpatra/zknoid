import { PrivateKey, PublicKey, UInt32, UInt64 } from 'o1js';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SessionKeyStorageState {
  sessionKeyBase58: any;
  getSessionKey: () => PrivateKey;
  newSessionKey: () => PrivateKey;
}

export const useSessionKeyStore = create<SessionKeyStorageState>(
  (set, get) => ({
    sessionKeyBase58: PrivateKey.random().toBase58(),

    getSessionKey() {
      return PrivateKey.fromBase58(get().sessionKeyBase58);
    },

    newSessionKey() {
      const newPK = PrivateKey.random();
      set({ sessionKeyBase58: newPK.toBase58() });
      return newPK;
    },
  })
);
