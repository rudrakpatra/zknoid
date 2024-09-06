import { Vector3 } from 'three';
import { Size2 } from './Utils';

export const INITIAL_HEALTH = 10;
export const INITIAL_CANNONBALLS = 10;
export const INITIAL_GOLD = 0;
export const INITIAL_TURN_RATE = 0;
export const MAX_TURN_RATE = 180;
export const SHIP_RANGE = 40;
export const TURN_RATE_OPTIONS = [-30, -20, -10, 0, 10, 20, 30];
export const CANVAS_SIZE = new Size2(1000, 1000);
export const CAMERA_OFFSET = new Vector3(0, 80, 60);
export const CAMERA_LOOK_AT_OFFSET = new Vector3(0, 0, 0);
export const MAX_SIMULATE_TIME = 1000; // 1 second in milliseconds
export const CANNON_WAIT_TIME = 3000; // 3 seconds in milliseconds