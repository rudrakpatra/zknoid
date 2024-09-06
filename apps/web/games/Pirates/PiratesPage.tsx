'use client';

import { useContext, useEffect, useState } from 'react';
import { GameView } from './components/GameView';
import { Int64, PublicKey, UInt32, UInt64 } from 'o1js';
import { useNetworkStore } from '@/lib/stores/network';
import { useStore } from 'zustand';
import { useSessionKeyStore } from '@/lib/stores/sessionKeyStorage';
import { ClientAppChain, PiratesLogic } from 'zknoid-chain-dev';
import GamePage from '@/components/framework/GamePage';
import { piratesConfig } from './config';
import ZkNoidGameContext from '@/lib/contexts/ZkNoidGameContext';
import { useProtokitChainStore } from '@/lib/stores/protokitChain';
import { MainButtonState } from '@/components/framework/GamePage/PvPGameView';
import PiratesCoverSVG from '@/public/games/Pirates/cover.jpeg';
import { api } from '@/trpc/react';
import { getEnvContext } from '@/lib/envContext';
import PiratesCoverMobileSVG from '@/public/games/Pirates/cover.jpeg';
import GameWidget from '@/components/framework/GameWidget';
import { motion } from 'framer-motion';
import { formatPubkey } from '@/lib/utils';
import Button from '@/components/shared/Button';
import { Currency } from '@/constants/currency';
import { formatUnits } from '@/lib/unit';
import znakesImg from '@/public/image/tokens/znakes.svg';
import Image from 'next/image';
import { walletInstalled } from '@/lib/helpers';
import { ConnectWallet } from '@/components/framework/GameWidget/ui/popups/ConnectWallet';
import { InstallWallet } from '@/components/framework/GameWidget/ui/popups/InstallWallet';
import { GameWrap } from '@/components/framework/GamePage/GameWrap';
import toast from '@/components/shared/Toast';
import { useToasterStore } from '@/lib/stores/toasterStore';
import { GameState } from './lib/gameState';
import { Game } from './lib/three/UI';
import { Txns } from './stores/PiratesLogicClient';
import { useNotificationStore } from '@/components/shared/Notification/lib/notificationStore';

export default function PiratesPage() {
  const [gameState, setGameState] = useState(GameState.NotStarted);
  const [loading, setLoading] = useState(true);
  const { client } = useContext(ZkNoidGameContext);

  if (!client) {
    throw Error('Context app chain client is not set');
  }
  const networkStore = useNetworkStore();
  const toasterStore = useToasterStore();

  useEffect(() => {
    switch (gameState) {
      case GameState.Sailing:
      case GameState.Cutscene:
        setLoading(false);
        break;
    }
  }, [gameState]);

  useEffect(() => {
    if (!walletInstalled()) setGameState(GameState.WalletNotInstalled);
    else if (!networkStore.address) setGameState(GameState.WalletNotConnected);
    else setGameState(GameState.NotStarted);
  }, [networkStore.address]);

  const statuses = {
    [GameState.WalletNotInstalled]: 'WALLET NOT INSTALLED',
    [GameState.WalletNotConnected]: 'WALLET NOT CONNECTED',
    [GameState.NotStarted]: 'NOT STARTED',
  } as Record<GameState, string>;

  useEffect(() => {
    if (gameState == GameState.Ended)
      toast.success(
        toasterStore,
        `You received: ${formatUnits(100)} ${Currency.ZNAKES}`,
        true
      );
  }, [gameState]);

  const notificationStore = useNotificationStore();

  const sessionPrivateKey = useStore(useSessionKeyStore, (state) =>
    state.getSessionKey()
  );

  const buttonComponent = (
    label: string,
    action: () => Promise<void>,
    success: string | null = null,
    failed: string | null = null
  ) => {
    const y = () => {
      success &&
        notificationStore.create({
          type: 'success',
          message: success,
        });
    };
    const n = () => {
      failed &&
        notificationStore.create({
          type: 'error',
          message: failed,
        });
    };
    return (
      <button
        className={`rounded-xl bg-left-accent p-2 text-black`}
        onClick={() => {
          console.log('clicked');
          action().then(y).catch(n);
        }}
      >
        {label}
      </button>
    );
  };

  const connectWalletBtn = () => (
    <GameWrap>
      <ConnectWallet connectWallet={() => networkStore.connectWallet(false)} />
    </GameWrap>
  );
  const installWalletBtn = () => (
    <GameWrap>
      <InstallWallet />
    </GameWrap>
  );

  const promptWalletOptions = () => {
    if (networkStore.address) return null;
    if (walletInstalled()) return connectWalletBtn();
    return installWalletBtn();
  };

  const promptToSpawn = () => {
    if (!networkStore.address) return null;
    return (
      <div
        className={
          'grid h-[80vh] place-content-center gap-4 rounded-lg bg-zinc-900'
        }
      >
        <span className={'text-center text-headline-1 text-left-accent'}>
          you must buy a ship to start the game
        </span>
        {buttonComponent(
          'BUY SHIP',
          () => Txns.spawn(sessionPrivateKey),
          'Game started',
          'Could not start game'
        )}
      </div>
    );
  };
  return (
    <GamePage
      gameConfig={piratesConfig}
      image={PiratesCoverSVG}
      mobileImage={PiratesCoverMobileSVG}
      defaultPage={'Game'}
    >
      <div className={'flex flex-col gap-4'}>
        <span className={'w-full text-headline-2 font-bold'}>Rules</span>
        <span className={'font-plexsans text-buttons-menu font-normal'}>
          {piratesConfig.rules}
        </span>
      </div>
      <div
        className={
          'flex w-full gap-2 font-plexsans text-[20px]/[20px] uppercase text-left-accent'
        }
      >
        <span>Game status:</span>
        <span>{statuses[gameState]}</span>
      </div>
      <GameWidget
        author={piratesConfig.author}
        isPvp
        playersCount={5}
        gameId="pirates"
      >
        {/* <Game /> */}
        {promptToSpawn()}
        {promptWalletOptions()}
      </GameWidget>
    </GamePage>
  );
}
