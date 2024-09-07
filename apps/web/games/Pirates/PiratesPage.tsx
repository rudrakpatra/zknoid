'use client';

import { useContext, useEffect, useState } from 'react';
import { useNetworkStore } from '@/lib/stores/network';
import { useSessionKeyStore } from '@/lib/stores/sessionKeyStorage';
import GamePage from '@/components/framework/GamePage';
import { piratesConfig } from './config';
import ZkNoidGameContext from '@/lib/contexts/ZkNoidGameContext';
import { useProtokitChainStore } from '@/lib/stores/protokitChain';
import PiratesCoverSVG from '@/public/games/Pirates/cover.jpeg';
import PiratesCoverMobileSVG from '@/public/games/Pirates/cover.jpeg';
import GameWidget from '@/components/framework/GameWidget';
import { Currency } from '@/constants/currency';
import { formatUnits } from '@/lib/unit';
import znakesImg from '@/public/image/tokens/znakes.svg';
import Image from 'next/image';
import { walletInstalled } from '@/lib/helpers';
import { ConnectWallet } from '@/components/framework/GameWidget/ui/popups/ConnectWallet';
import { InstallWallet } from '@/components/framework/GameWidget/ui/popups/InstallWallet';
import { GameWrap } from '@/components/framework/GamePage/GameWrap';
import { Game } from './lib/three/UI';
import { usePiratesClient } from './stores/PiratesClient';
import { useNotificationStore } from '@/components/shared/Notification/lib/notificationStore';
import {
  stringifyFull,
  useObservePiratesState,
  usePiratesStore,
} from './stores/PiratesStore';

export default function PiratesPage() {
  const { client } = useContext(ZkNoidGameContext);

  if (!client) {
    throw Error('Context app chain client is not set');
  }

  useObservePiratesState();
  const pirates = usePiratesStore();
  const piratesClient = usePiratesClient();
  const networkStore = useNetworkStore();
  const notificationStore = useNotificationStore();
  const sessionKey = useSessionKeyStore();
  const sessionPrivateKey = sessionKey.getSessionKey();
  console.log('PLAYERS\n', pirates);
  const readyToPlay =
    networkStore.address &&
    walletInstalled() &&
    pirates.players.has(sessionPrivateKey.toPublicKey().toBase58());

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

  const showWalletOptions = () => {
    if (networkStore.address) return null;
    if (walletInstalled()) return connectWalletBtn();
    return installWalletBtn();
  };

  const showSpawnShipOptions = () => {
    if (!networkStore.address) return null;
    if (pirates.players.has(sessionPrivateKey.toPublicKey().toBase58()))
      return null;
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
          () => piratesClient.spawn(),
          'Game started',
          'Could not start game'
        )}
      </div>
    );
  };
  const showGame = () => {
    if (readyToPlay) return <Game />;
    return null;
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
      <GameWidget
        author={piratesConfig.author}
        isPvp
        playersCount={5}
        gameId="pirates"
      >
        {showGame()}
        {showSpawnShipOptions()}
        {showWalletOptions()}
      </GameWidget>
    </GamePage>
  );
}
