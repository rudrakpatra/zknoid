export const DECIMALS = 5; // for world coordinates
export const WORLD_SIZE = 1e3 * 10 ** DECIMALS;
export const INITIAL_SHIP_HEALTH = 10;
export const SHIP_SIZE = 10 * 10 ** DECIMALS;
export const SHIP_SPEED = 30 * 10 ** DECIMALS;
// direction
export const QUANISATION_LEVEL = 72; // 1 quantum = 5 degree
export const MAX_TURN_RATE = 6; // in quanta per second, +- 30 degrees

export const INITIAL_GOLD = 0;
export const INITIAL_CANNONBALLS = 10;
export const CANNON_DAMAGE = 3;
export const CANNON_RANGE = 3000 * SHIP_SIZE;
export const CANNON_COST = 1;
export const CANNON_WAIT_TIME = 5;
export const MIN_LOOT = 1;
export const MAX_LOOT = 10;
export const LOOT_SIZE = 10;
