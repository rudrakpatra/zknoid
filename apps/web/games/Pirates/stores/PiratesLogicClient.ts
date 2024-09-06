import { PrivateKey, UInt64, PublicKey } from "o1js";
import { client, PiratesLogic } from "zknoid-chain-dev";
import ZkNoidGameContext from "@/lib/contexts/ZkNoidGameContext";
import { useProtokitChainStore } from "@/lib/stores/protokitChain";
import { useContext, useEffect } from "react";
import { Poseidon } from "o1js";
import { stringToField } from "@proto-kit/protocol";
const log = (...data:any[])=>data;

// Helper function to create and send a transaction
async function createAndSendTransaction(
  sessionPrivateKey: PrivateKey,
  action: (piratesLogic: PiratesLogic) => void
) {
  const piratesLogic = client.runtime.resolve('PiratesLogic') as PiratesLogic;

  const tx = await client.transaction(
    sessionPrivateKey.toPublicKey(),
    async () => {
      action(piratesLogic);
    }
  );

  log('Collect tx', tx);
  tx.transaction = tx.transaction?.sign(sessionPrivateKey);
  log('Sending tx', tx);
  await tx.send();
  log('Tx sent', tx);
}

export const Txns = {
  spawn: async (sessionPrivateKey: PrivateKey) => {
    await createAndSendTransaction(sessionPrivateKey, (piratesLogic) => {
      piratesLogic.spawn();
    });
  },

  leave: async (sessionPrivateKey: PrivateKey) => {
    await createAndSendTransaction(sessionPrivateKey, (piratesLogic) => {
      piratesLogic.leave();
    });
  },

  changeTurnRate: async (sessionPrivateKey: PrivateKey, newTurnRate: number) => {
    await createAndSendTransaction(sessionPrivateKey, (piratesLogic) => {
      piratesLogic.changeTurnRate(UInt64.from(newTurnRate));
    });
  },

  shoot: async (sessionPrivateKey: PrivateKey, offsetX: number, offsetY: number) => {
    await createAndSendTransaction(sessionPrivateKey, (piratesLogic) => {
      piratesLogic.shoot(UInt64.from(offsetX), UInt64.from(offsetY));
    });
  },

  hit: async (sessionPrivateKey: PrivateKey, playerA: PublicKey, playerB: PublicKey) => {
    await createAndSendTransaction(sessionPrivateKey, (piratesLogic) => {
      piratesLogic.hit(playerA, playerB);
    });
  },

  pickupLoot: async (sessionPrivateKey: PrivateKey, lootId: number) => {
    await createAndSendTransaction(sessionPrivateKey, (piratesLogic) => {
      piratesLogic.pickupLoot(UInt64.from(lootId));
    });
  },
};


export function getMethodId(moduleName: string, methodName: string): string {
  return Poseidon.hash([stringToField(moduleName), stringToField(methodName)])
    .toBigInt()
    .toString();
}

export const usePirates=()=>{
  const protokitChain=useProtokitChainStore();
  const { client } = useContext(ZkNoidGameContext);
  if(protokitChain.block?.txs)
  protokitChain.block.txs.forEach(txn=>{
      switch(txn.tx.methodId){
        case getMethodId("PiratesLogic","spawn"):
          console.log("spawn");
          break;
        case getMethodId("PiratesLogic","leave"):
          console.log("leave");
          break;
        case getMethodId("PiratesLogic","changeTurnRate"):
          console.log("changeTurnRate");
          break;
        case getMethodId("PiratesLogic","shoot"):
            console.log("shoot");
          break;
        case getMethodId("PiratesLogic","hit"):
            console.log("hit");
          break;
        case getMethodId("PiratesLogic","pickupLoot"):
            console.log("pickupLoot");
          break;
        default:
          break;
      }
  })
  //
  // @state() public players = StateMap.from<PublicKey, Player>(PublicKey, Player);
  // @state() public cannonballs = StateMap.from<PublicKey, CannonBall>(PublicKey, CannonBall);
  // @state() public loots = StateMap.from<UInt64, Loot>(UInt64, Loot);
  // @state() public lootCount = UInt64.from(0);


  return {
    protokitChain,
    // players,
    // cannonballs,
    // loots,
    // lootCount
  }
}