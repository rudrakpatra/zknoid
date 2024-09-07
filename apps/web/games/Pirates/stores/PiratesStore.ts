import {
  ComputedBlockJSON,
  useProtokitChainStore,
} from '@/lib/stores/protokitChain';
import { useSessionKeyStore } from '@/lib/stores/sessionKeyStorage';
import { UInt64 } from '@proto-kit/library';
import { stringToField } from '@proto-kit/protocol';
import { Bool, Field, Group, Int64, Poseidon, PublicKey, Scalar } from 'o1js';
import { useContext, useEffect, useState } from 'react';
import {
  client,
  ClientAppChain,
  Loot,
  PiratesLogic,
  Player,
} from 'zknoid-chain-dev';
import { create } from 'zustand';
import * as R from 'ramda';
import { useNetworkStore } from '@/lib/stores/network';
import ZkNoidGameContext from '@/lib/contexts/ZkNoidGameContext';
import { piratesConfig } from '../config';

function getMethodId(moduleName: string, methodName: string): string {
  return Poseidon.hash([stringToField(moduleName), stringToField(methodName)])
    .toBigInt()
    .toString();
}

type PiratesClient = ClientAppChain<
  typeof piratesConfig.runtimeModules,
  any,
  any,
  any
>;
interface PirateState {
  isPLaying: boolean;
  players: Map<string, Player>;
  loots: Map<string, Loot>;
  lootTop: UInt64;
  onNewBlock: (client: PiratesClient, block: ComputedBlockJSON) => void;
  syncPlayers: (client: PiratesClient) => Promise<void>;
  syncLoots: (client: PiratesClient) => Promise<void>;
}

export const usePiratesStore = create<PirateState>((set, get) => ({
  isPLaying: false,
  players: new Map<string, Player>(),
  loots: new Map<string, Loot>(),
  lootTop: UInt64.from(0),
  onNewBlock: async (client: PiratesClient, block: ComputedBlockJSON) => {
    if (!block.txs) return;
    for (const txData of block.txs) {
      if (!txData.status) continue; // Skip failed transactions
      const tx = txData.tx;
      const sender = PublicKey.fromBase58(tx.sender);
      switch (tx.methodId) {
        case getMethodId('PiratesLogic', 'spawn'):
          console.log('spawn', sender.toBase58());
          const player =
            await client.query.runtime.PiratesLogic.players.get(sender);
          if (player)
            set(
              R.over(R.lensProp('players'), (players: Map<string, Player>) =>
                new Map(players).set(sender.toBase58(), player)
              )
            );
          await get().syncLoots(client);
          break;
        case getMethodId('PiratesLogic', 'leave'):
          console.log('leave', sender.toBase58());
          set(
            R.over(R.lensProp('players'), (players: Map<string, Player>) => {
              const newPlayers = new Map(players);
              newPlayers.delete(sender.toBase58());
              return newPlayers;
            })
          );
          break;
        case getMethodId('PiratesLogic', 'changeTurnRate'):
          console.log('changeTurnRate', sender.toBase58());
          const [newTurnRate] = tx.argsJSON.map((arg) => parseInt(arg));
          set(
            R.over(
              R.lensPath(['players', sender.toBase58()]),
              R.assoc('turnRate', newTurnRate)
            )
          );
          break;
        case getMethodId('PiratesLogic', 'shoot'):
          console.log('shoot', sender.toBase58());
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
          console.log('hit', keyA.toBase58(), keyB.toBase58());
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
          console.log('pickupLoot', sender.toBase58());
          const [lootId] = tx.argsJSON.map((arg) => UInt64.from(arg));
          const updatedPlayer =
            await client.query.runtime.PiratesLogic.players.get(sender);
          const updatedLoot =
            await client.query.runtime.PiratesLogic.loots.get(lootId);
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
  syncPlayers: async (client: PiratesClient) => {
    console.log('syncPlayers');
    const pubKey = useSessionKeyStore.getState().getSessionKey().toPublicKey();
    let currentKey = pubKey;
    const newPlayers = new Map();

    const addPlayer = async (key: PublicKey) => {
      const player = await client.query.runtime.PiratesLogic.players.get(key);
      if (!player) return false;
      newPlayers.set(key.toBase58(), player);
      console.log('addPlayer:', key.toBase58(), player);
      if (key.equals(pubKey)) set(R.assoc('isPLaying', true));
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
  syncLoots: async (client: PiratesClient) => {
    console.log('syncLoots');
    let currentLootKey = get().lootTop;
    const newLoots = get().loots;
    const addLoot = async (key: UInt64) => {
      const loot = await client.query.runtime.PiratesLogic.loots.get(key);
      if (!loot) return false;
      console.log('addLoot:', currentLootKey, loot);
      newLoots.set(currentLootKey.toString(), loot);
      return true;
    };
    while (await addLoot(currentLootKey)) {
      if (currentLootKey.equals(UInt64.from(0))) break;
      currentLootKey = currentLootKey.add(1);
    }
    set(R.pipe(R.assoc('loots', newLoots), R.assoc('lootTop', currentLootKey)));
  },
}));

export const useObservePiratesState = () => {
  const chain = useProtokitChainStore();
  const network = useNetworkStore();
  const { client } = useContext(ZkNoidGameContext);
  const sessionKey = useSessionKeyStore();
  const pirateStore = usePiratesStore();
  const [blockHeight, setBlockHeight] = useState(0);
  const [newBlock, setNewBlock] = useState<ComputedBlockJSON | null>(null);
  useEffect(() => {
    if (!network.protokitClientStarted) return;
    if (!network.walletConnected) return;
    if (!network.address) return;
    pirateStore.syncLoots(client as PiratesClient);
  }, [network.protokitClientStarted, network.walletConnected, network.address]);

  useEffect(() => {
    if (!network.protokitClientStarted) return;
    if (!network.walletConnected) return;
    if (!network.address) return;
    pirateStore.syncPlayers(client as PiratesClient);
  }, [
    network.protokitClientStarted,
    network.walletConnected,
    network.address,
    sessionKey,
  ]);

  useEffect(() => {
    if (!network.protokitClientStarted) return;
    if (!network.walletConnected) return;
    if (!network.address) return;
    if (chain.loading) return;
    if (!chain.block) return;
    const height = chain.block.height;
    const block = chain.block;
    if (height > blockHeight) {
      setBlockHeight(height);
      setNewBlock(block);
    }
  }, [
    network.protokitClientStarted,
    network.walletConnected,
    network.address,
    chain.block?.height,
  ]);

  useEffect(() => {
    if (!newBlock) return;
    pirateStore.onNewBlock(client as PiratesClient, newBlock);
  }, [newBlock]);
};

export function stringifyFull(obj: any): string {
  const seen = new WeakSet();
  return JSON.stringify(
    obj,
    (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) return '[Circular]';
        seen.add(value);
        if (value instanceof Map) {
          return Object.fromEntries(value);
        }
        if (value instanceof Set) {
          return Array.from(value);
        }
        if (value.constructor !== Object) {
          return Object.fromEntries(Object.entries(value));
        }
      }
      if (
        value instanceof UInt64 ||
        value instanceof Int64 ||
        value instanceof Field ||
        value instanceof Scalar
      ) {
        return value.toString();
      }
      if (value instanceof Bool) {
        return value.toBoolean();
      }
      if (value instanceof Group || value instanceof PublicKey) {
        return value.toJSON();
      }
      return value;
    },
    2
  );
}
