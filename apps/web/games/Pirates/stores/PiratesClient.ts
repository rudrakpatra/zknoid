import { PublicKey } from 'o1js';
import { UInt64 } from '@proto-kit/library';
import { client, PiratesLogic } from 'zknoid-chain-dev';
import { useSessionKeyStore } from '@/lib/stores/sessionKeyStorage';

// const logTxns = (...data: any[]) => data;
const logTxns = console.log;

// Helper function to create and send a transaction
async function createAndSendTransaction(
  action: (piratesLogic: PiratesLogic) => void
) {
  const sessionPrivateKey = useSessionKeyStore().getSessionKey();
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

export const PiratesClient = {
  spawn: async () => {
    await createAndSendTransaction((piratesLogic) => {
      piratesLogic.spawn();
    });
  },

  leave: async () => {
    await createAndSendTransaction((piratesLogic) => {
      piratesLogic.leave();
    });
  },

  changeTurnRate: async (newTurnRate: number) => {
    await createAndSendTransaction((piratesLogic) => {
      piratesLogic.changeTurnRate(UInt64.from(newTurnRate));
    });
  },

  shoot: async (offsetX: number, offsetY: number) => {
    await createAndSendTransaction((piratesLogic) => {
      piratesLogic.shoot(UInt64.from(offsetX), UInt64.from(offsetY));
    });
  },

  hit: async (playerA: PublicKey, playerB: PublicKey) => {
    await createAndSendTransaction((piratesLogic) => {
      piratesLogic.hit(playerA, playerB);
    });
  },

  pickupLoot: async (lootId: number) => {
    await createAndSendTransaction((piratesLogic) => {
      piratesLogic.pickupLoot(UInt64.from(lootId));
    });
  },
};
