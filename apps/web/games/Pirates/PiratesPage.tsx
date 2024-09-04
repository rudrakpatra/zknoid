'use client';

import { useContext, useEffect, useState } from 'react';
import { GameView } from './components/GameView';
import { Int64, PublicKey, UInt32, UInt64 } from 'o1js';
import { useNetworkStore } from '@/lib/stores/network';
// import {
//   useObservePiratesMatchQueue,
//   usePiratesMatchQueueStore,
// } from './stores/matchQueue';
import { useStore } from 'zustand';
import { useSessionKeyStore } from '@/lib/stores/sessionKeyStorage';
import {
  ClientAppChain,
  PENDING_BLOCKS_NUM_CONST,
  RandzuField,
  WinWitness,
} from 'zknoid-chain-dev';
import GamePage from '@/components/framework/GamePage';
import { piratesConfig } from './config';
import ZkNoidGameContext from '@/lib/contexts/ZkNoidGameContext';
import { useProtokitChainStore } from '@/lib/stores/protokitChain';
import { MainButtonState } from '@/components/framework/GamePage/PvPGameView';
import PiratesCoverSVG from '@/public/image/games/soon.svg';
import { api } from '@/trpc/react';
import { getEnvContext } from '@/lib/envContext';
// import { DEFAULT_PARTICIPATION_FEE } from 'zknoid-chain-dev/dist/src/engine/LobbyManager';
import { MOVE_TIMEOUT_IN_BLOCKS } from 'zknoid-chain-dev/dist/src/engine/MatchMaker';
import PiratesCoverMobileSVG from '@/public/image/games/soon.svg';
import GameWidget from '@/components/framework/GameWidget';
import { motion } from 'framer-motion';
import { formatPubkey } from '@/lib/utils';
import Button from '@/components/shared/Button';
import { Competition } from '@/components/framework/GameWidget/ui/Competition';
import { Currency } from '@/constants/currency';
import { formatUnits } from '@/lib/unit';
import znakesImg from '@/public/image/tokens/znakes.svg';
import Image from 'next/image';
import { UnsetCompetitionPopup } from '@/components/framework/GameWidget/ui/popups/UnsetCompetitionPopup';
import { Win } from '@/components/framework/GameWidget/ui/popups/Win';
import { Lost } from '@/components/framework/GameWidget/ui/popups/Lost';
import { walletInstalled } from '@/lib/helpers';
import { ConnectWallet } from '@/components/framework/GameWidget/ui/popups/ConnectWallet';
import { InstallWallet } from '@/components/framework/GameWidget/ui/popups/InstallWallet';
import { GameWrap } from '@/components/framework/GamePage/GameWrap';
import { RateGame } from '@/components/framework/GameWidget/ui/popups/RateGame';
import toast from '@/components/shared/Toast';
import { useToasterStore } from '@/lib/stores/toasterStore';
// import { useRateGameStore } from '@/lib/stores/rateGameStore';
import { GameState } from './lib/gameState';
import { useStartGame } from '@/games/randzu/features/startGame';
import {
  useLobbiesStore,
  useObserveLobbiesStore,
} from '@/lib/stores/lobbiesStore';
import { type PendingTransaction } from '@proto-kit/sequencer';

export default function PiratesPage({
  params,
}: {
  params: { competitionId: string };
}) {
  const [gameState, setGameState] = useState(GameState.NotStarted);
  const [isRateGame, setIsRateGame] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [loadingElement, setLoadingElement] = useState<
    { x: number; y: number } | undefined
  >({ x: 0, y: 0 });
  const { client } = useContext(ZkNoidGameContext);

  if (!client) {
    throw Error('Context app chain client is not set');
  }

  const networkStore = useNetworkStore();
  const toasterStore = useToasterStore();
  // const rateGameStore = useRateGameStore();
  const protokitChain = useProtokitChainStore();
  const sessionPrivateKey = useStore(useSessionKeyStore, (state) =>
    state.getSessionKey()
  );
  const progress = api.progress.setSolvedQuests.useMutation();
  // const getRatingQuery = api.ratings.getGameRating.useQuery({
  //   gameId: 'pirates',
  // });

  const client_ = client as ClientAppChain<
    typeof piratesConfig.runtimeModules,
    any,
    any,
    any
  >;

  const query = networkStore.protokitClientStarted
    ? client_.query.runtime.PiratesLogic
    : undefined;
  console.log('query=\n', query);
  const restart = () => {
    // matchQueue.resetLastGameState();
    setGameState(GameState.NotStarted);
  };

  useEffect(() => {
    switch (gameState) {
      case GameState.Sailing:
      case GameState.Cutscene:
        setLoading(false);
        setLoadingElement(undefined);
        break;
    }
  }, [gameState]);

  useEffect(() => {
    if (!walletInstalled()) setGameState(GameState.WalletNotInstalled);
    else if (!networkStore.address) setGameState(GameState.WalletNotConnected);
    else setGameState(GameState.NotStarted);
  }, [networkStore.address]);

  const mainButtonState = loading
    ? MainButtonState.TransactionExecution
    : (
        {
          [GameState.NotStarted]: MainButtonState.NotStarted,
          [GameState.WalletNotInstalled]: MainButtonState.WalletNotInstalled,
          [GameState.WalletNotConnected]: MainButtonState.WalletNotConnected,
        } as Record<GameState, MainButtonState>
      )[gameState] || MainButtonState.None;

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

  const buttonComponent = (label: string) => (
    <>
      <Button
        startContent={
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M12.5134 10.5851L1.476 0L0.00136988 1.41421L11.0387 11.9994L0 22.5858L1.47463 24L12.5134 13.4136L22.5242 23.0143L23.9989 21.6001L13.988 11.9994L23.9975 2.39996L22.5229 0.98575L12.5134 10.5851Z"
              fill="#252525"
            />
          </svg>
        }
        label={label}
        isReadonly
      />
    </>
  );

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

  return (
    <GamePage
      gameConfig={piratesConfig}
      image={PiratesCoverSVG}
      mobileImage={PiratesCoverMobileSVG}
      defaultPage={'Game'}
    >
      <motion.div
        className={
          'flex grid-cols-4 flex-col-reverse gap-4 pt-10 lg:grid lg:pt-0'
        }
        animate={'windowed'}
      >
        <div className={'flex flex-col gap-4 lg:hidden'}>
          <span className={'w-full text-headline-2 font-bold'}>Rules</span>
          <span className={'font-plexsans text-buttons-menu font-normal'}>
            {piratesConfig.rules}
          </span>
        </div>
        <div className={'hidden h-full w-full flex-col gap-4 lg:flex'}>
          <div
            className={
              'flex w-full gap-2 font-plexsans text-[20px]/[20px] uppercase text-left-accent'
            }
          >
            <span>Game status:</span>
            <span>{statuses[gameState]}</span>
          </div>
          <div
            className={
              'flex w-full gap-2 font-plexsans text-[20px]/[20px] text-foreground'
            }
          >
            <span>Your opponent:</span>
            <span>{formatPubkey(undefined)}</span>
          </div>
        </div>
        <GameWidget
          author={piratesConfig.author}
          isPvp
          playersCount={5}
          gameId="pirates"
        >
          {walletInstalled() ? connectWalletBtn() : installWalletBtn()}
          {<GameView loading={loading} />}
        </GameWidget>
        <div className={'flex flex-col lg:hidden'}>
          {"iv className={'flex flex-col lg:hidden'}"}
        </div>
        <div
          className={
            'flex flex-row gap-4 font-plexsans text-[14px]/[14px] text-left-accent lg:hidden lg:text-[20px]/[20px]'
          }
        >
          <span className={'uppercase'}>Players in queue: {2}</span>
        </div>
      </motion.div>
    </GamePage>
  );
}
