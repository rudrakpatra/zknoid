import { PrivateKey, PublicKey } from 'o1js';
import { UInt64 } from '@proto-kit/library';
import { client, PiratesLogic } from 'zknoid-chain-dev';
import { useSessionKeyStore } from '@/lib/stores/sessionKeyStorage';

// const logTxns = (...data: any[]) => data;
const logTxns = console.log;

// Helper function to create and send a transaction
async function createAndSendTransaction(
  sessionPrivateKey: PrivateKey,
  action: (piratesLogic: PiratesLogic) => void
) {
  console.log('sessionKey', sessionPrivateKey.toBase58());
  const piratesLogic = client.runtime.resolve('PiratesLogic') as PiratesLogic;

  const tx = await client.transaction(
    sessionPrivateKey.toPublicKey(),
    async () => {
      action(piratesLogic);
    }
  );

  logTxns('Collect tx', tx);
  tx.transaction = tx.transaction?.sign(sessionPrivateKey);
  logTxns('Sending tx', tx);
  await tx.send();
  logTxns('Tx sent', tx);
}

export const usePiratesClient = () => {
  const sessionPrivateKey = useSessionKeyStore().getSessionKey();
  return {
    spawn: async () => {
      await createAndSendTransaction(sessionPrivateKey, (piratesLogic) => {
        piratesLogic.spawn();
      });
    },

    leave: async () => {
      await createAndSendTransaction(sessionPrivateKey, (piratesLogic) => {
        piratesLogic.leave();
      });
    },

    changeTurnRate: async (newTurnRate: number) => {
      await createAndSendTransaction(sessionPrivateKey, (piratesLogic) => {
        piratesLogic.changeTurnRate(UInt64.from(newTurnRate));
      });
    },

    shoot: async (offsetX: number, offsetY: number) => {
      await createAndSendTransaction(sessionPrivateKey, (piratesLogic) => {
        piratesLogic.shoot(UInt64.from(offsetX), UInt64.from(offsetY));
      });
    },

    hit: async (playerA: PublicKey, playerB: PublicKey) => {
      await createAndSendTransaction(sessionPrivateKey, (piratesLogic) => {
        piratesLogic.hit(playerA, playerB);
      });
    },

    pickupLoot: async (lootId: number) => {
      await createAndSendTransaction(sessionPrivateKey, (piratesLogic) => {
        piratesLogic.pickupLoot(UInt64.from(lootId));
      });
    },
  };
};
