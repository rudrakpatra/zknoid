import { DECIMALS } from './constants';
import * as PiratesLogic from './PiratesLogic';
export class ProxyCircle {
  x: number;
  y: number;
  r: number;

  constructor(x: number, y: number, r: number) {
    this.x = x;
    this.y = y;
    this.r = r;
  }

  static from(circle: PiratesLogic.Circle): ProxyCircle {
    return new ProxyCircle(
      Number(circle.x.toString()) / 10 ** DECIMALS,
      Number(circle.y.toString()) / 10 ** DECIMALS,
      Number(circle.r.toString()) / 10 ** DECIMALS,
    );
  }
}

export class ProxyShip {
  health: number;
  circle: ProxyCircle;
  turnRate: number;
  phase: number;
  lastUpdatedAt: number;

  constructor(
    health: number,
    circle: ProxyCircle,
    turnRate: number,
    phase: number,
    lastUpdatedAt: number,
  ) {
    this.health = health;
    this.circle = circle;
    this.turnRate = turnRate;
    this.phase = phase;
    this.lastUpdatedAt = lastUpdatedAt;
  }

  static from(ship: PiratesLogic.Ship): ProxyShip {
    return new ProxyShip(
      Number(ship.health.toString()),
      ProxyCircle.from(ship.circle),
      Number(ship.turnRate.toString()),
      Number(ship.phase.toString()),
      Number(ship.lastUpdatedAt.toString()),
    );
  }
}

export class ProxyCannonBall {
  circle: ProxyCircle;
  spawnBlockHeight: number;

  constructor(circle: ProxyCircle, spawnBlockHeight: number) {
    this.circle = circle;
    this.spawnBlockHeight = spawnBlockHeight;
  }

  static from(cannonBall: PiratesLogic.CannonBall): ProxyCannonBall {
    return new ProxyCannonBall(
      ProxyCircle.from(cannonBall.circle),
      Number(cannonBall.spawnBlockHeight.toString()),
    );
  }
}

export class ProxyPlayer {
  next: string;
  prev: string;
  ship: ProxyShip;
  gold: number;
  cannonBalls: number;
  prevCannonBall: ProxyCannonBall;
  sailing: boolean;

  constructor(
    next: string,
    prev: string,
    ship: ProxyShip,
    gold: number,
    cannonBalls: number,
    prevCannonBall: ProxyCannonBall,
    sailing: boolean,
  ) {
    this.next = next;
    this.prev = prev;
    this.ship = ship;
    this.gold = gold;
    this.cannonBalls = cannonBalls;
    this.prevCannonBall = prevCannonBall;
    this.sailing = sailing;
  }

  static from(player: PiratesLogic.Player): ProxyPlayer {
    return new ProxyPlayer(
      player.next.toBase58(),
      player.prev.toBase58(),
      ProxyShip.from(player.ship),
      Number(player.gold.toString()),
      Number(player.cannonBalls.toString()),
      ProxyCannonBall.from(player.prevCannonBall),
      player.sailing.toBoolean(),
    );
  }
}

export class ProxyLoot {
  circle: ProxyCircle;

  constructor(circle: ProxyCircle) {
    this.circle = circle;
  }

  static from(loot: PiratesLogic.Loot): ProxyLoot {
    return new ProxyLoot(ProxyCircle.from(loot.circle));
  }
}
