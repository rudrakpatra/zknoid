import {
  ComputedBlockJSON,
  useProtokitChainStore,
} from '@/lib/stores/protokitChain';
import { useSessionKeyStore } from '@/lib/stores/sessionKeyStorage';
import { UInt64 } from '@proto-kit/library';
import { stringToField } from '@proto-kit/protocol';
import { Field, Poseidon, PublicKey } from 'o1js';
import { useContext, useEffect, useState } from 'react';
import {
  ClientAppChain,
  PiratesProxy,
  PiratesLogic,
  PiratesConstants,
} from 'zknoid-chain-dev';
import { create } from 'zustand';
import * as R from 'ramda';
import { useNetworkStore } from '@/lib/stores/network';
import ZkNoidGameContext from '@/lib/contexts/ZkNoidGameContext';
import { piratesConfig } from '../config';
import { useNotificationStore } from '@/components/shared/Notification/lib/notificationStore';
import { formatPubkey } from '@/lib/utils';

const { ProxyPlayer, ProxyLoot, ProxyShip, ProxyCircle, ProxyCannonBall } =
  PiratesProxy;

type PiratesClient = ClientAppChain<
  typeof piratesConfig.runtimeModules,
  any,
  any,
  any
>;

export interface PirateState {
  isPlaying: boolean;
  players: Record<string, PiratesProxy.ProxyPlayer>;
  loots: Record<string, PiratesProxy.ProxyLoot>;
  lootTop: number;
  onNewBlock: (
    client: PiratesClient,
    block: ComputedBlockJSON,
    notify: (msg: string, ...args: any) => void
  ) => void;
  syncPlayers: (
    client: PiratesClient,
    notify: (msg: string, ...args: any) => void
  ) => Promise<void>;
  syncLoots: (
    client: PiratesClient,
    notify: (msg: string, ...args: any) => void
  ) => Promise<void>;
}

export const usePiratesStore = create<PirateState>((set, get) => ({
  isPlaying: false,
  players: {},
  loots: {},
  lootTop: 0,
  onNewBlock: async (
    client: PiratesClient,
    block: ComputedBlockJSON,
    notify: (msg: string, ...args: any[]) => void
  ) => {
    function getMethodId(moduleName: string, methodName: string): string {
      return Poseidon.hash([
        stringToField(moduleName),
        stringToField(methodName),
      ])
        .toBigInt()
        .toString();
    }
    if (!block.txs) return;

    for (const txData of block.txs) {
      if (!txData.status) continue; // Skip failed transactions
      const tx = txData.tx;
      const sender = PublicKey.fromBase58(tx.sender);
      const senderBase58 = sender.toBase58();

      switch (tx.methodId) {
        case getMethodId('PiratesLogic', 'spawn'):
          notify('spawn ', formatPubkey(sender));
          const player =
            await client.query.runtime.PiratesLogic.players.get(sender);
          if (player) {
            set(
              R.assocPath(['players', senderBase58], ProxyPlayer.from(player))
            );
          }
          await get().syncLoots(client, notify);
          break;

        case getMethodId('PiratesLogic', 'leave'):
          notify('leave ', formatPubkey(sender));
          set(R.dissocPath(['players', senderBase58]));
          break;

        case getMethodId('PiratesLogic', 'changeTurnRate'):
          notify('changeTurnRate ', formatPubkey(sender));
          const [newTurnRate] = tx.argsFields.map(Number);
          set(
            R.over(
              R.lensPath(['players', senderBase58, 'ship']),
              R.assoc('turnRate', newTurnRate)
            )
          );
          break;

        case getMethodId('PiratesLogic', 'shoot'):
          notify('shoot ', formatPubkey(sender));
          const [offsetX, offsetY] = tx.argsFields.map(Number);
          set(
            R.assocPath(['players', senderBase58, 'lastShot'], {
              x: offsetX / 10 ** PiratesConstants.DECIMALS,
              y: offsetY / 10 ** PiratesConstants.DECIMALS,
            })
          );
          break;

        case getMethodId('PiratesLogic', 'hit'):
          const [a, b, c, d] = tx.argsFields;
          const keyA = PublicKey.fromFields([Field(a), Field(b)]);
          const keyB = PublicKey.fromFields([Field(c), Field(d)]);
          notify('hit', formatPubkey(keyA), formatPubkey(keyB));
          set(
            R.pipe(
              R.over(
                R.lensPath(['players', keyA.toBase58(), 'ship', 'health']),
                R.dec
              ),
              R.over(
                R.lensPath(['players', keyB.toBase58(), 'ship', 'health']),
                R.dec
              )
            )
          );
          break;

        case getMethodId('PiratesLogic', 'pickupLoot'):
          notify('pickupLoot ', formatPubkey(sender));
          const [lootId] = tx.argsFields.map(Number);
          const updatedPlayer =
            await client.query.runtime.PiratesLogic.players.get(sender);
          const updatedLoot = await client.query.runtime.PiratesLogic.loots.get(
            UInt64.from(lootId)
          );
          if (!updatedPlayer) break;
          if (!updatedLoot) break;
          set(
            R.pipe(
              R.when(
                () => !!updatedPlayer,
                R.assocPath(
                  ['players', senderBase58],
                  ProxyPlayer.from(updatedPlayer)
                )
              ),
              R.when(
                () => !!updatedLoot,
                R.assocPath(
                  ['loots', lootId.toString()],
                  ProxyLoot.from(updatedLoot)
                )
              )
            )
          );
          break;

        default:
          throw Error('Unknown method: ' + tx.methodId);
      }
    }
  },
  syncPlayers: async (
    client: PiratesClient,
    notify: (msg: string, ...args: any[]) => void
  ) => {
    notify('syncPlayers');
    const pubKey = useSessionKeyStore
      .getState()
      .getSessionKey()
      .toPublicKey()
      .toBase58();
    let currentKey = pubKey;
    const newPlayers: Record<string, PiratesProxy.ProxyPlayer> = {};

    const addPlayer = async (key: string): Promise<boolean> => {
      const pKey = PublicKey.fromBase58(key);
      const pKeyBase58 = pKey.toBase58();
      const player = await client.query.runtime.PiratesLogic.players.get(pKey);
      if (!player) return false;
      newPlayers[pKeyBase58] = ProxyPlayer.from(player);
      notify('added Player:', formatPubkey(pKey));
      if (pubKey === pKeyBase58) set(R.assoc('isPlaying', true));
      return true;
    };

    while (await addPlayer(currentKey)) {
      if (currentKey === PublicKey.empty().toBase58()) break;
      currentKey = newPlayers[currentKey].next;
    }

    currentKey = pubKey;
    while (await addPlayer(currentKey)) {
      if (currentKey === PublicKey.empty().toBase58()) break;
      currentKey = newPlayers[currentKey].prev;
    }

    set(R.assoc('players', newPlayers));
  },
  syncLoots: async (
    client: PiratesClient,
    notify: (msg: string, ...args: any[]) => void
  ) => {
    notify('syncLoots');
    let currentLootKey = get().lootTop;
    const newLoots: Record<string, PiratesProxy.ProxyLoot> = R.clone(
      get().loots
    );

    const addLoot = async (key: number): Promise<boolean> => {
      const loot = await client.query.runtime.PiratesLogic.loots.get(
        UInt64.from(key)
      );
      if (!loot) return false;
      notify('added Loot:', currentLootKey.toString());
      newLoots[currentLootKey.toString()] = ProxyLoot.from(loot);
      return true;
    };

    while (await addLoot(currentLootKey)) {
      if (currentLootKey === 0) break;
      currentLootKey++;
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
  const notificationStore = useNotificationStore();
  const notify = (msg: string, ...args: any) => {
    notificationStore.create({
      type: 'success',
      message: msg + args,
    });
  };
  useEffect(() => {
    if (!network.protokitClientStarted) return;
    if (!network.walletConnected) return;
    if (!network.address) return;
    pirateStore.syncLoots(client as PiratesClient, notify);
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
    pirateStore.syncPlayers(client as PiratesClient, notify);
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
    pirateStore.onNewBlock(client as PiratesClient, newBlock, notify);
  }, [newBlock]);
};
