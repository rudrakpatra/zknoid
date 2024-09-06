'use client';
import { Game } from '../lib/three/Game'; // Import the Game component and useGameReady hook

interface IGameViewProps {
  loading: boolean;
}

export const GameView = (props: IGameViewProps) => {
  return <Game />;
};
