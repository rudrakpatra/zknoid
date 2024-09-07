import {
  ComputedBlockJSON,
  useProtokitChainStore,
} from '@/lib/stores/protokitChain';
import { useSessionKeyStore } from '@/lib/stores/sessionKeyStorage';
import { UInt64 } from '@proto-kit/library';
import { stringToField } from '@proto-kit/protocol';
import { Poseidon, PublicKey } from 'o1js';
import { useEffect, useState } from 'react';
import { client, Loot, Player } from 'zknoid-chain-dev';
import { create } from 'zustand';
import * as R from 'ramda';

function getMethodId(moduleName: string, methodName: string): string {
  return Poseidon.hash([stringToField(moduleName), stringToField(methodName)])
    .toBigInt()
    .toString();
}

interface PirateState {
  players: Map<string, Player>;
  loots: Map<string, Loot>;
  lootTop: UInt64;
  onNewBlock: (block: ComputedBlockJSON) => void;
  syncPlayers: () => Promise<void>;
  syncLoots: () => Promise<void>;
}

const usePirateStore = create<PirateState>((set, get) => ({
  players: new Map<string, Player>(),
  loots: new Map<string, Loot>(),
  lootTop: UInt64.from(0),
  onNewBlock: async (block: ComputedBlockJSON) => {
    if (!block.txs) return;
    for (const txData of block.txs) {
      if (!txData.status) continue; // Skip failed transactions
      const tx = txData.tx;
      const sender = PublicKey.fromBase58(tx.sender);
      switch (tx.methodId) {
        case getMethodId('PiratesLogic', 'spawn'):
          const { value: player } = await client.runtime
            .resolve('PiratesLogic')
            .players.get(sender);
          set(
            R.over(R.lensProp('players'), (players: Map<string, Player>) =>
              new Map(players).set(sender.toBase58(), player)
            )
          );
          await get().syncLoots();
          break;
        case getMethodId('PiratesLogic', 'leave'):
          set(
            R.over(R.lensProp('players'), (players: Map<string, Player>) => {
              const newPlayers = new Map(players);
              newPlayers.delete(sender.toBase58());
              return newPlayers;
            })
          );
          break;
        case getMethodId('PiratesLogic', 'changeTurnRate'):
          const [newTurnRate] = tx.argsJSON.map((arg) => parseInt(arg));
          set(
            R.over(
              R.lensPath(['players', sender.toBase58()]),
              R.assoc('turnRate', newTurnRate)
            )
          );
          break;
        case getMethodId('PiratesLogic', 'shoot'):
          const [offsetX, offsetY] = tx.argsJSON.map((arg) => parseInt(arg));
          set(
            R.over(
              R.lensPath(['players', sender.toBase58()]),
              R.assoc('lastShot', { x: offsetX, y: offsetY })
            )
          );
          break;
        case getMethodId('PiratesLogic', 'hit'):
          const [keyA, keyB] = tx.argsJSON.map((arg) =>
            PublicKey.fromBase58(arg)
          );
          set(
            R.pipe(
              R.over(
                R.lensPath(['players', keyA.toBase58(), 'health']),
                (health: UInt64) => health.sub(1)
              ),
              R.over(
                R.lensPath(['players', keyB.toBase58(), 'health']),
                (health: UInt64) => health.sub(1)
              )
            )
          );
          break;
        case getMethodId('PiratesLogic', 'pickupLoot'):
          const [lootId] = tx.argsJSON.map((arg) => UInt64.from(arg));
          const { value: updatedPlayer } = await client.runtime
            .resolve('PiratesLogic')
            .players.get(sender);
          const { value: updatedLoot } = await client.runtime
            .resolve('PiratesLogic')
            .loots.get(lootId);
          set(
            R.pipe(
              R.assocPath(['players', sender.toBase58()], updatedPlayer),
              R.assocPath(['loots', lootId.toString()], updatedLoot)
            )
          );
          break;
        default:
          throw Error('Unknown method: ' + tx.methodId);
      }
    }
  },
  syncPlayers: async () => {
    const pubKey = useSessionKeyStore.getState().getSessionKey().toPublicKey();
    let currentKey = pubKey;
    const newPlayers = new Map();

    const addPlayer = async (key: PublicKey) => {
      const { isSome, value: player } = await client.runtime
        .resolve('PiratesLogic')
        .players.get(key);
      if (isSome.not().toBoolean()) return false;
      newPlayers.set(key.toBase58(), player);
      console.log('Pirates:', key.toBase58(), player);
      return true;
    };

    while (await addPlayer(currentKey)) {
      if (currentKey.equals(PublicKey.empty())) break;
      currentKey = newPlayers.get(currentKey.toBase58())!.next;
    }

    currentKey = pubKey;
    while (await addPlayer(currentKey)) {
      if (currentKey.equals(PublicKey.empty())) break;
      currentKey = newPlayers.get(currentKey.toBase58())!.prev;
    }

    set(R.assoc('players', newPlayers));
  },
  syncLoots: async () => {
    let currentLootKey = UInt64.from(0);
    const newLoots = new Map();
    while (true) {
      const { isSome, value: loot } = await client.runtime
        .resolve('PiratesLogic')
        .loots.get(currentLootKey);
      if (isSome.not().toBoolean()) break;
      console.log('Pirates:', currentLootKey, loot);
      newLoots.set(currentLootKey.toString(), loot);
      currentLootKey = currentLootKey.add(1);
    }
    set(
      R.pipe(
        R.assoc('loots', newLoots),
        R.assoc('lootTop', currentLootKey.sub(1))
      )
    );
  },
}));

export const usePirates = () => {
  const [blockHeight, setBlockHeight] = useState(0);
  const protokitChain = useProtokitChainStore();
  const sessionKey = useSessionKeyStore();
  const pirateStore = usePirateStore();

  useEffect(() => {
    pirateStore.syncLoots();
  }, []);

  useEffect(() => {
    pirateStore.syncPlayers();
  }, [sessionKey]);

  useEffect(() => {
    if (protokitChain.loading || !protokitChain.block) return;
    const block = protokitChain.block;
    const height = block.height;
    if (height > blockHeight) {
      setBlockHeight(height);
      pirateStore.onNewBlock(block);
    }
  }, [protokitChain, blockHeight]);

  return pirateStore;
};
