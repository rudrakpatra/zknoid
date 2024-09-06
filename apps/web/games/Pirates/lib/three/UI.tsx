import React, { useEffect, useRef } from 'react';
import { create, useStore } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { Vector2 } from 'three';
import { useNotificationStore } from '@/components/shared/Notification/lib/notificationStore';
import { GameInstance, GameState } from './Game';
import {
  CANVAS_SIZE,
  TURN_RATE_OPTIONS,
  MAX_SIMULATE_TIME,
  INITIAL_HEALTH,
  INITIAL_CANNONBALLS,
  INITIAL_GOLD,
  INITIAL_TURN_RATE,
} from './Constants';
import { formatUnits } from '@/lib/unit';
import { Currency } from '@/constants/currency';
import { useSessionKeyStore } from '@/lib/stores/sessionKeyStorage';

export const useGameStore = create<GameState>()(
  immer((set) => ({
    turnRate: INITIAL_TURN_RATE,
    health: INITIAL_HEALTH,
    cannonballs: INITIAL_CANNONBALLS,
    gold: INITIAL_GOLD,
    offsetX: 0,
    offsetY: 0,
    setHealth: (health) =>
      set((state) => {
        state.health = health;
      }),
    setCannonballs: (cannonballs) =>
      set((state) => {
        state.cannonballs = cannonballs;
      }),
    setGold: (gold) =>
      set((state) => {
        state.gold = gold;
      }),
    setOffset: (x, y) =>
      set((state) => {
        state.offsetX = x;
        state.offsetY = y;
      }),
    setTurnRate: (rate) =>
      set((state) => {
        state.turnRate = rate;
      }),
  }))
);

const simulate = () => {
  return new Promise<void>((resolve) => {
    const delay = Math.random() * MAX_SIMULATE_TIME;
    setTimeout(resolve, delay);
  });
};

export const Game: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameInstanceRef = useRef<GameInstance | null>(null);
  const notificationStore = useNotificationStore();
  const gameState = useGameStore();
  const { health, cannonballs, gold, offsetX, offsetY, turnRate, setTurnRate } =
    gameState;

  if (gameInstanceRef.current) {
    gameInstanceRef.current.gameState = gameState;
    gameInstanceRef.current.onLootCollection = async (id) => {
      await simulate();
      const reward = Math.floor(Math.random() * 10) + 1;
      gameState.setGold(gameState.gold + reward);
      notificationStore.create({
        type: 'success',
        message: `You collected loot${id}: ${reward} gold`,
      });
    };
  }

  useEffect(() => {
    if (canvasRef.current) {
      gameInstanceRef.current = new GameInstance(
        CANVAS_SIZE,
        canvasRef.current,
        gameState
      );
      gameInstanceRef.current.init();
    }
    return () => {
      if (gameInstanceRef.current) {
        gameInstanceRef.current.cleanup();
      }
    };
  }, []);

  const postTurnRate = async (x: number) => {
    if (!gameInstanceRef.current) return;
    await simulate();
    setTurnRate(x);
  };

  useEffect(() => {
    if (gameInstanceRef.current) {
      gameInstanceRef.current.player.setTurnRate(turnRate);
      notificationStore.create({
        type: 'success',
        message: `Turn rate changed to ${turnRate}`,
      });
    }
  }, [turnRate]);

  const postOffset = async () => {
    if (!gameInstanceRef.current) return;
    await simulate();
    gameInstanceRef.current.player.setCannonball(new Vector2(offsetX, offsetY));
    notificationStore.create({
      type: 'success',
      message: `Cannonball aimed at (${offsetX.toFixed(2)}, ${offsetY.toFixed(2)})`,
    });
  };

  const handleCanvasClick = () => {
    postOffset();
  };

  const turnRateChoice = (t: number) => (
    <button
      key={t}
      className={`w-[50px] rounded-xl ${turnRate === t ? 'bg-left-accent' : ' bg-zinc-400'} p-2 text-black`}
      onClick={() => postTurnRate(t)}
    >
      {t}
    </button>
  );

  const turnRateChoiceMenu = () => TURN_RATE_OPTIONS.map(turnRateChoice);

  const sessionPrivateKey = useStore(useSessionKeyStore, (state) =>
    state.getSessionKey()
  );

  return (
    <div className="flex h-[90vh] flex-row gap-2">
      <canvas
        ref={canvasRef}
        height={CANVAS_SIZE.h}
        width={CANVAS_SIZE.w}
        className="aspect-square rounded-xl"
        onClick={handleCanvasClick}
      />
      <div className="flex flex-col gap-1">
        <span>Ship Health:</span>
        <span className="mb-2 rounded-xl bg-zinc-700 p-2">{health}</span>
        <span>Cannon Balls:</span>
        <span className="mb-2 rounded-xl bg-zinc-700 p-2">{cannonballs}</span>
        <span>Gold Collected:</span>
        <span className="mb-2 rounded-xl bg-zinc-700 p-2">{gold}</span>
        <span>Offset:</span>
        <span className="mb-2 rounded-xl bg-zinc-700 p-2">
          {offsetX.toFixed(2)} , {offsetY.toFixed(2)}
        </span>
        <span>Set Turn Rate:</span>
        <div className="flex flex-row gap-2">{turnRateChoiceMenu()}</div>
      </div>
    </div>
  );
};
