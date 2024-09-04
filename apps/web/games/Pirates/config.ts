import { createZkNoidGameConfig } from '@/lib/createConfig';
import { ZkNoidGameType } from '@/lib/platform/game_types';
import { ZkNoidGameFeature, ZkNoidGameGenre } from '@/lib/platform/game_tags';
import { LogoMode } from '@/app/constants/games';
import PiratesPage from './PiratesPage';
import { PiratesLogic } from 'zknoid-chain-dev';

export const piratesConfig = createZkNoidGameConfig({
  id: 'pirates',
  type: ZkNoidGameType.PVP,
  name: 'Pirates',
  description:
    'Players navigate ships, collect gold, and engage in naval combat in a vast oceanic world.',
  image: '/image/games/soon.svg',
  logoMode: LogoMode.CENTER,
  genre: ZkNoidGameGenre.Arcade,
  features: [ZkNoidGameFeature.Multiplayer],
  isReleased: true,
  releaseDate: new Date(2024, 9, 5),
  popularity: 0,
  author: 'Rudrak Patra',
  rules: '1. Players participate in each round of the game. Each player starts with a ship spawning from a port. The player either sail in the vast ocean looking for gold, or try shooting down other players to get their gold.',
  runtimeModules: {PiratesLogic},
  page: PiratesPage,
  // externalUrl: 'https://prPoto.zknoid.io/games/pirates/global'
});