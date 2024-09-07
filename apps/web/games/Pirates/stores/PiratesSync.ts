import { PublicKey } from 'o1js';
import { UInt64 } from '@proto-kit/library';
import {
  PiratesLogic,
  Player,
  Loot,
  PiratesLogicProxy,
} from 'zknoid-chain-dev';
import ZkNoidGameContext from '@/lib/contexts/ZkNoidGameContext';
import { useContext } from 'react';
import { Option } from '@proto-kit/protocol';
import { useProtokitChainStore } from '@/lib/stores/protokitChain';
import { Draft } from 'immer';

// Global functions for fetching players and loot
export async function fetchPlayer(
  client: any,
  key: PublicKey
): Promise<Option<Player>> {
  const piratesLogic = client.runtime.resolve('PiratesLogic') as PiratesLogic;
  const player = await piratesLogic.players.get(key);
  return player;
}

export async function fetchLoot(
  client: any,
  key: UInt64
): Promise<Option<Loot>> {
  const piratesLogic = client.runtime.resolve('PiratesLogic') as PiratesLogic;
  const loot = await piratesLogic.loots.get(key);
  return loot;
}

export async function sync(
  client: any,
  startPubKey: PublicKey
): Promise<{ players: Player[]; loots: Loot[] }> {
  const players: Player[] = [];
  const loots: Loot[] = [];
  const visitedPlayers = new Set<string>();

  // Fetch players
  let currentKey = startPubKey;
  while (!currentKey.equals(PublicKey.empty())) {
    const { isSome, value: player } = await fetchPlayer(client, currentKey);
    if (isSome.not().toBoolean()) break;

    players.push(player);
    visitedPlayers.add(currentKey.toBase58());

    // Check next player
    if (!visitedPlayers.has(player.next.toBase58())) {
      currentKey = player.next;
    }
    // If next is visited, check prev
    else if (!visitedPlayers.has(player.prev.toBase58())) {
      currentKey = player.prev;
    }
    // If both are visited, we've completed the circle
    else {
      break;
    }
  }

  // Fetch loots
  let currentLootKey = UInt64.from(0);
  while (true) {
    const { isSome, value: loot } = await fetchLoot(client, currentLootKey);
    if (isSome.not().toBoolean()) break;

    loots.push(loot);
    currentLootKey = currentLootKey.add(1);
  }

  return { players, loots };
}

export async function syncChainState(
  game: PiratesLogicProxy | Draft<PiratesLogicProxy>,
  pubKey: PublicKey
) {
  const protokitChain = useProtokitChainStore();
  const height = protokitChain.block?.height ?? NaN;
  const { client } = useContext(ZkNoidGameContext);
  const { players, loots } = await sync(client, pubKey);
  if (players && loots && height) return game.sync(players, loots, height);
  throw new Error('Failed to sync chain state');
}
