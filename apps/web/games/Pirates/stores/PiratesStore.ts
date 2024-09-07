import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';
import { PublicKey, Poseidon } from 'o1js';
import {
  ComputedBlockJSON,
  useProtokitChainStore,
} from '@/lib/stores/protokitChain';
import { PiratesLogicProxy } from 'zknoid-chain-dev';
import { stringToField } from '@proto-kit/protocol';
import { Draft } from 'immer';
import { syncChainState } from './PiratesSync';

// const logUpdates = (...data: any[]) => data;
const logUpdates = console.log;

export function getMethodId(moduleName: string, methodName: string): string {
  return Poseidon.hash([stringToField(moduleName), stringToField(methodName)])
    .toBigInt()
    .toString();
}

// STATE HANDLERS

export function onBlockUpdate(
  game: PiratesLogicProxy | Draft<PiratesLogicProxy>,
  block: ComputedBlockJSON
) {
  if (!block.txs) return;
  for (const txData of block.txs) {
    if (!txData.status) continue; // Skip failed transactions

    const tx = txData.tx;
    const sender = PublicKey.fromBase58(tx.sender);
    switch (tx.methodId) {
      case getMethodId('PiratesLogic', 'spawn'):
        game.spawn(sender);
        logUpdates('spawn');
        break;
      case getMethodId('PiratesLogic', 'leave'):
        game.leave(sender);
        logUpdates('leave');
        break;
      case getMethodId('PiratesLogic', 'changeTurnRate'):
        const [newTurnRate] = tx.argsJSON.map((arg) => parseInt(arg));
        game.changeTurnRate(sender, newTurnRate);
        logUpdates('changeTurnRate');
        break;
      case getMethodId('PiratesLogic', 'shoot'):
        const [offsetX, offsetY] = tx.argsJSON.map((arg) => parseInt(arg));
        game.shoot(sender, offsetX, offsetY);
        logUpdates('shoot');
        break;
      case getMethodId('PiratesLogic', 'hit'):
        const [targetKey] = tx.argsJSON.map((arg) => PublicKey.fromBase58(arg));
        game.hit(sender, targetKey);
        logUpdates('hit');
        break;
      case getMethodId('PiratesLogic', 'pickupLoot'):
        const [lootId] = tx.argsJSON.map((arg) => parseInt(arg));
        game.pickupLoot(sender, lootId);
        logUpdates('pickupLoot');
        break;
      default:
        logUpdates('Unknown method:', tx.methodId);
        break;
    }
  }
  // Increment block height in the game
  game.incrementBlockHeight();
}

interface PiratesState {
  game: PiratesLogicProxy;
  updateBlock: (block: ComputedBlockJSON) => void;
}

export const usePiratesStore = create<PiratesState>()(
  persist(
    immer((set) => ({
      game: new PiratesLogicProxy(),
      updateBlock: (block: ComputedBlockJSON) =>
        set((state) => {
          onBlockUpdate(state.game, block);
        }),
      syncChainState: (pubKey: PublicKey) => {
        set((state) => {
          state.game = new PiratesLogicProxy();
          syncChainState(state.game, pubKey);
        });
      },
    })),
    {
      name: 'pirates-storage',
      serialize: (state) => JSON.stringify(state),
      deserialize: (str) => {
        const parsed = JSON.parse(str);
        return {
          ...parsed,
          game: Object.assign(new PiratesLogicProxy(), parsed.game),
        };
      },
    }
  )
);

export const usePirates = () => {
  const { game, updateBlock } = usePiratesStore();
  const protokitChain = useProtokitChainStore();
  const height = protokitChain.block?.height ?? NaN;
  const block = protokitChain.block;

  if (game.getBlockHeight() < height && block) {
    updateBlock(block);
  }

  return game;
};
