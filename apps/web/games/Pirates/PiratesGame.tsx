import React, { useEffect, useRef, useState } from 'react';
import { GameInstance } from './lib/three/GameInstance';
import {
  ACTUAL_WORLD_SIZE,
  TURN_RATE_OPTIONS,
  INITIAL_TURN_RATE,
} from './lib/three/Constants';
import { usePiratesStore } from './stores/PiratesStore';
import { usePiratesClient } from './stores/PiratesClient';
import { useSessionKeyStore } from '@/lib/stores/sessionKeyStorage';
import { PiratesProxy } from 'zknoid-chain-dev';
import { useNetworkStore } from '@/lib/stores/network';
import { useProtokitChainStore } from '@/lib/stores/protokitChain';
import { formatPubkey } from '@/lib/utils';
import { useNotificationStore } from '@/components/shared/Notification/lib/notificationStore';
export const Game: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameInstanceRef = useRef<GameInstance | null>(null);
  const networkStore = useNetworkStore();
  const chain = useProtokitChainStore();
  const pirates = usePiratesStore();
  const piratesClient = usePiratesClient();
  const sessionKey = useSessionKeyStore();
  const sessionPrivateKey = sessionKey.getSessionKey();
  const sessionPublicKey = sessionPrivateKey.toPublicKey();
  const player = pirates.players[sessionPublicKey.toBase58()];
  const playerCount = Object.keys(pirates.players).length;
  const lootCount = Object.keys(pirates.loots).length;
  const [turnrate, setTurnRate] = useState(INITIAL_TURN_RATE);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);

  const notificationStore = useNotificationStore();
  useEffect(() => {
    if (gameInstanceRef.current) {
      const gameInstance = gameInstanceRef.current;
      const UI = gameInstance.uiManager;
      gameInstance.onLootCollection = async (id) => {
        //cons
      };
      UI.onNewOffset = async (x, y) => {
        setOffsetX(x);
        setOffsetY(y);
      };
      UI.onNewOffsetFinal = async (x, y) => {
        piratesClient.shoot(x, y);
      };
    }
  }, [gameInstanceRef.current]);

  useEffect(() => {
    if (canvasRef.current) {
      gameInstanceRef.current = new GameInstance(
        canvasRef.current,
        ACTUAL_WORLD_SIZE,
        sessionPublicKey.toBase58()
      );
      gameInstanceRef.current.render();
      gameInstanceRef.current.loadAssets();
    }
    return () => {
      if (gameInstanceRef.current) {
        gameInstanceRef.current.cleanup();
      }
    };
  }, []);
  useEffect(() => {
    if (gameInstanceRef.current && chain.block?.height)
      gameInstanceRef.current.scene.userData.blockHeight = chain.block?.height;
  }, [chain.block?.height]);

  useEffect(() => {
    const player = pirates.players[sessionPublicKey.toBase58()];
    if (player) {
      if (player.ship.turnRate !== turnrate) {
        setTurnRate(player.ship.turnRate);
        notificationStore.create({
          type: 'success',
          message: `Your turn rate has been changed to ${player.ship.turnRate}`,
        });
      }
    }
    if (gameInstanceRef.current) {
      gameInstanceRef.current.setFromPiratesState(pirates);
    }
  }, [pirates, gameInstanceRef.current]);

  const turnRateChoice = (t: number) => (
    <button
      key={t}
      className={`w-[50px] rounded-xl ${turnrate === t ? 'bg-left-accent' : ' bg-zinc-400'} p-2 text-black`}
      onClick={() => piratesClient.changeTurnRate(t)}
    >
      {t}
    </button>
  );

  const turnRateChoiceMenu = () => TURN_RATE_OPTIONS.map(turnRateChoice);

  const showStats = (player: PiratesProxy.ProxyPlayer) => {
    const item = (k: string, v: string) => {
      return (
        <div>
          <div className="rounded-lg bg-zinc-900 bg-opacity-80 p-2">
            <span>{k}</span>
            {' ' + v}
          </div>
        </div>
      );
    };
    return (
      <div className="pointer-events-none absolute inset-4 flex flex-row justify-center text-center">
        <div className="pointer-events-auto absolute top-0 flex flex-row gap-4">
          {item('❤️', `${player.ship.health}`)}
          {item('💣', `${player.cannonBalls}`)}
          {item('🪙', `${player.gold}`)}
        </div>
        <div className="pointer-events-auto absolute bottom-0">
          <div>Set Turn Rate:</div>
          <div className="flex flex-row gap-2">{turnRateChoiceMenu()}</div>
        </div>
      </div>
    );
  };

  const showDebugInfo = () => {
    if (!networkStore.address) return null;
    if (!pirates.players[sessionPrivateKey.toPublicKey().toBase58()])
      return null;
    const block = chain.block?.height;
    return (
      <div className="fixed bottom-3 right-3 z-50 bg-black p-4">
        <div>{formatPubkey(sessionPublicKey)}</div>
        <div>{player ? 'playing' : 'inactive'}</div>
        <div>{block} Blocks</div>
        <div>{playerCount} Players</div>
        <div>{lootCount} Loots</div>
      </div>
    );
  };

  return (
    <>
      {showDebugInfo()}
      <div id="game" className={`absolute inset-0 ${player ? '' : 'hidden'}`}>
        <canvas ref={canvasRef} className={`absolute inset-0 mx-auto`} />
        {player && showStats(player)}
      </div>
    </>
  );
};
