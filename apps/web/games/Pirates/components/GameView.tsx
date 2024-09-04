'use client';
import { useEffect, useRef, useState } from 'react';

interface IGameViewProps {
  loading: boolean;
}

export const GameView = (props: IGameViewProps) => {
 
  useEffect(() => {
    // addEventListener('resize', resizeField);
    return () => {
      // removeEventListener('resize', resizeField);
    };
  }, []);

  return (null);
};
