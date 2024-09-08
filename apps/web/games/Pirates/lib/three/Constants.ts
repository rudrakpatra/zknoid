import { Vector3 } from 'three';
import { Size2 } from './Utils';
export { PiratesConstants } from 'zknoid-chain-dev';

export const INITIAL_HEALTH = 10;
export const INITIAL_TURN_RATE = 0;
export const SHIP_RANGE = 40;
export const TURN_RATE_OPTIONS = [0, 5, 10, 15, 20, 25, 30];
//   PiratesConstants.WORLD_SIZE / 10 ** PiratesConstants.DECIMALS;
export const ACTUAL_WORLD_SIZE = new Size2(1e3, 1e3);
export const CAMERA_OFFSET = new Vector3(0, 60, 40);
export const CAMERA_LOOK_AT_OFFSET = new Vector3(0, 0, 0);
