import { createZkNoidGameConfig } from '@/lib/createConfig';
import { ZkNoidGameType } from '@/lib/platform/game_types';
import { ZkNoidGameFeature, ZkNoidGameGenre } from '@/lib/platform/game_tags';
import { LogoMode } from '@/app/constants/games';
import PiratesPage from './PiratesPage';
import PiratesLobby from './PiratesLobby';
import { PiratesLogic } from 'zknoid-chain-dev';

export const piratesConfig = createZkNoidGameConfig({
  id: 'Pirates',
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
  rules: '',
  runtimeModules: {PiratesLogic},
  page: PiratesPage,
  lobby: PiratesLobby,
  externalUrl: 'https://proto.zknoid.io/games/poker/global'
});

export const piratesRedirectConfig = createZkNoidGameConfig({
  id: 'Pirates',
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
  rules:
    '1. Two players participate in each round of the game. Each player starts with a ship spawning from a port. The player either sail in the vast ocean looking for gold, or try shooting down other players to get their loot.',
  runtimeModules: {},
  page: undefined as any,
  lobby: undefined as any,
  externalUrl: 'https://proto.zknoid.io/games/pirates/global'
});