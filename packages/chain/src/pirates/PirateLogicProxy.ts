import { Bool, PublicKey, Struct } from 'o1js';
import {
  CANNON_DAMAGE,
  CANNON_RANGE,
  CANNON_WAIT_TIME,
  INITIAL_CANNONBALLS,
  INITIAL_GOLD,
  INITIAL_SHIP_HEALTH,
  LOOT_SIZE,
  MAX_LOOT,
  MAX_TURN_RATE,
  MIN_LOOT,
  QUANISATION_LEVEL,
  SHIP_SIZE,
  SHIP_SPEED,
  WORLD_SIZE,
} from './constants';
import { UInt64 } from '@proto-kit/library';
import { Loot, Player } from './PiratesLogic';

export function toProxy<T>(original: T): any {
  if (original instanceof UInt64) {
    return Number(original.toBigInt());
  } else if (original instanceof Bool) {
    return original.toBoolean();
  } else if (original instanceof PublicKey) {
    return original; // Keep PublicKey as is
  } else if (typeof original === 'object' && original !== null) {
    const result: any = {};
    for (const key in original) {
      if (Object.prototype.hasOwnProperty.call(original, key)) {
        result[key] = toProxy((original as any)[key]);
      }
    }
    return result;
  }
  return original;
}

export function toOriginal<T>(
  proxy: any,
  OriginalClass: new (props: any) => T,
): T {
  if (typeof proxy === 'number') {
    return UInt64.from(proxy) as any;
  } else if (typeof proxy === 'boolean') {
    return Bool(proxy) as any;
  } else if (proxy instanceof PublicKey) {
    return proxy as any; // Keep PublicKey as is
  } else if (typeof proxy === 'object' && proxy !== null) {
    const result: any = {};
    for (const key in proxy) {
      if (Object.prototype.hasOwnProperty.call(proxy, key)) {
        const FieldType = (OriginalClass as any).prototype[key].constructor;
        result[key] = toOriginal(proxy[key], FieldType);
      }
    }
    return new OriginalClass(result);
  }
  return proxy;
}

class CircleProxy {
  constructor(
    public x: number,
    public y: number,
    public r: number,
  ) {}

  static zero() {
    return new CircleProxy(0, 0, 0);
  }

  distanceSquared(other: CircleProxy): number {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return dx * dx + dy * dy;
  }

  collidesWith(other: CircleProxy): boolean {
    const s = this.r + other.r;
    const d = this.distanceSquared(other);
    return d <= s * s;
  }
}

class ShipProxy {
  constructor(
    public health: number,
    public circle: CircleProxy,
    public turnRate: number,
    public phase: number,
    public lastUpdatedAt: number,
  ) {}

  static spawnAt(x: number, y: number, time: number): ShipProxy {
    return new ShipProxy(
      INITIAL_SHIP_HEALTH,
      new CircleProxy(x, y, SHIP_SIZE),
      MAX_TURN_RATE,
      0,
      time,
    );
  }

  hits(other: CircleProxy, time: number): boolean {
    const currentPosition = getCurrentPosition(
      this.circle,
      this.phase,
      this.turnRate,
      time - this.lastUpdatedAt,
    );
    return other.collidesWith(
      new CircleProxy(currentPosition.x, currentPosition.y, 1),
    );
  }
}

class CannonBallProxy {
  constructor(
    public circle: CircleProxy,
    public spawnBlockHeight: number,
  ) {}

  static null(): CannonBallProxy {
    return new CannonBallProxy(CircleProxy.zero(), 0);
  }

  isNull(): boolean {
    return this.spawnBlockHeight === 0;
  }
}

export class PlayerProxy {
  constructor(
    public next: PublicKey,
    public prev: PublicKey,
    public ship: ShipProxy,
    public gold: number,
    public cannonBalls: number,
    public prevCannonBall: CannonBallProxy,
    public sailing: boolean,
  ) {}

  static startSailing(
    next: PublicKey,
    prev: PublicKey,
    ship: ShipProxy,
  ): PlayerProxy {
    return new PlayerProxy(
      next,
      prev,
      ship,
      INITIAL_GOLD,
      INITIAL_CANNONBALLS,
      CannonBallProxy.null(),
      true,
    );
  }
}

export class LootProxy {
  constructor(public circle: CircleProxy) {}
}

export class PiratesLogicProxy {
  private players: Map<string, PlayerProxy> = new Map();
  private loots: Map<number, LootProxy> = new Map();
  private lootTop: number = 0;
  private blockHeight: number = 0;

  public sync(players: Player[], loots: Loot[], blockHeight: number) {
    this.blockHeight = blockHeight;
    this.players = new Map(players.map((p) => toProxy(p)));
    this.loots = new Map(loots.map((l) => toProxy(l)));
  }
  private getRandomInRange(A: number, B: number): number {
    return Math.floor(Math.random() * (B - A + 1)) + A;
  }

  private getRandomsInRange(
    A: number,
    B: number,
  ): [number, number, number, number] {
    return [
      this.getRandomInRange(A, B),
      this.getRandomInRange(A, B),
      this.getRandomInRange(A, B),
      this.getRandomInRange(A, B),
    ];
  }

  private async insertPlayer(curr: PublicKey, x: number, y: number) {
    const head = PublicKey.empty();
    const headV = this.players.get(head.toString())!;
    const next = headV.next;
    const nextV = this.players.get(next.toString())!;

    this.players.set(head.toString(), {
      ...headV,
      next: curr,
    });
    this.players.set(
      curr.toString(),
      PlayerProxy.startSailing(
        curr,
        next,
        ShipProxy.spawnAt(x, y, this.blockHeight),
      ),
    );
    this.players.set(next.toString(), {
      ...nextV,
      prev: curr,
    });
  }

  private async removePlayer(curr: PublicKey) {
    const currV = this.players.get(curr.toString())!;
    const prev = currV.prev;
    const next = currV.next;
    const nextV = this.players.get(next.toString())!;
    const prevV = this.players.get(prev.toString())!;

    this.players.set(prev.toString(), {
      ...prevV,
      next: next,
    });
    this.players.delete(curr.toString());
    this.players.set(next.toString(), {
      ...nextV,
      prev: prev,
    });
  }

  private async insertLoot(x: number, y: number) {
    this.loots.set(
      this.lootTop,
      new LootProxy(new CircleProxy(x, y, LOOT_SIZE)),
    );
    this.lootTop++;
  }

  public async spawn(senderPubKey: PublicKey) {
    const [a, b] = this.getRandomsInRange(0, WORLD_SIZE);
    await this.insertPlayer(senderPubKey, a, b);
    for (let i = 0; i < 5; i++) {
      const [a, b, c, d] = this.getRandomsInRange(0, WORLD_SIZE);
      await this.insertLoot(a, b);
      await this.insertLoot(c, d);
    }
  }

  public async leave(senderPubKey: PublicKey): Promise<void> {
    const player = this.players.get(senderPubKey.toString());
    if (!player) throw new Error('Player does not exist');
    if (!player.sailing) throw new Error('Player is not sailing');
    await this.removePlayer(senderPubKey);
  }

  public async changeTurnRate(senderPubKey: PublicKey, newTurnRate: number) {
    const player = this.players.get(senderPubKey.toString());
    if (!player) throw new Error('Player does not exist');
    if (!player.sailing) throw new Error('Player is not sailing');

    const { x, y } = getCurrentPosition(
      player.ship.circle,
      player.ship.phase,
      player.ship.turnRate,
      this.blockHeight - player.ship.lastUpdatedAt,
    );
    const phase =
      (player.ship.phase +
        player.ship.turnRate * (this.blockHeight - player.ship.lastUpdatedAt)) %
      QUANISATION_LEVEL;

    this.players.set(senderPubKey.toString(), {
      ...player,
      ship: new ShipProxy(
        player.ship.health,
        new CircleProxy(x, y, player.ship.circle.r),
        newTurnRate,
        phase,
        this.blockHeight,
      ),
    });
  }

  public async shoot(
    senderPubKey: PublicKey,
    offsetX: number,
    offsetY: number,
  ) {
    const player = this.players.get(senderPubKey.toString());
    if (!player) throw new Error('Player does not exist');
    if (!player.sailing) throw new Error('Player is not sailing');
    if (player.cannonBalls === 0)
      throw new Error('Player does not have cannonballs');

    const canShoot =
      player.prevCannonBall.isNull() ||
      player.prevCannonBall.spawnBlockHeight + CANNON_WAIT_TIME <
        this.blockHeight;
    if (!canShoot) throw new Error('Cannot shoot');

    const distanceSqr = offsetX * offsetX + offsetY * offsetY;
    if (distanceSqr > CANNON_RANGE * CANNON_RANGE)
      throw new Error('Offset is not inside range');

    this.players.set(senderPubKey.toString(), {
      ...player,
      prevCannonBall: new CannonBallProxy(
        new CircleProxy(offsetX, offsetY, 1),
        this.blockHeight,
      ),
      cannonBalls: player.cannonBalls - 1,
    });
  }

  public async hit(A: PublicKey, B: PublicKey) {
    const playerA = this.players.get(A.toString());
    const playerB = this.players.get(B.toString());
    if (!playerA) throw new Error('Player A does not exist');
    if (!playerB) throw new Error('Player B does not exist');
    if (!playerA.sailing) throw new Error('Player A is not sailing');
    if (!playerB.sailing) throw new Error('Player B is not sailing');

    const prevCannonBall = playerA.prevCannonBall;
    if (prevCannonBall.isNull())
      throw new Error('Player A never shot a cannonball');

    const cannonBallTriggerBlockHeight =
      prevCannonBall.spawnBlockHeight + CANNON_WAIT_TIME;
    if (cannonBallTriggerBlockHeight !== this.blockHeight)
      throw new Error('Cannonball is not shot at this blockHeight');

    const isHit = playerB.ship.hits(prevCannonBall.circle, this.blockHeight);
    if (!isHit) throw new Error('Cannonball did not hit the target');

    playerB.ship.health -= CANNON_DAMAGE;
    this.players.set(B.toString(), playerB);
  }

  public async pickupLoot(senderPubKey: PublicKey, loot: number) {
    const player = this.players.get(senderPubKey.toString());
    if (!player) throw new Error('Player does not exist');
    if (!player.sailing) throw new Error('Player is not sailing');

    const lootV = this.loots.get(loot);
    if (!lootV) throw new Error('Loot does not exist');

    if (!player.ship.hits(lootV.circle, this.blockHeight))
      throw new Error('Ship does not hit the loot');

    const reward = this.getRandomInRange(MIN_LOOT, MAX_LOOT);
    player.gold += reward;
    this.players.set(senderPubKey.toString(), player);

    const [a, b] = this.getRandomsInRange(0, WORLD_SIZE);
    this.loots.set(loot, new LootProxy(new CircleProxy(a, b, LOOT_SIZE)));
  }

  public getBlockHeight() {
    return this.blockHeight;
  }
  // Simulate block progression
  public incrementBlockHeight() {
    this.blockHeight++;
  }
}

function getCurrentPosition(
  lastPosition: CircleProxy,
  phase: number,
  turnRate: number,
  timePassed: number,
): { x: number; y: number } {
  if (turnRate === 0) {
    const dx = Math.sin(phase) * SHIP_SPEED * timePassed;
    const dy = Math.cos(phase) * SHIP_SPEED * timePassed;
    return {
      x: lastPosition.x + dx,
      y: lastPosition.y + dy,
    };
  } else {
    const dx =
      ((Math.cos(turnRate * timePassed + QUANISATION_LEVEL - phase) -
        Math.cos(phase)) *
        (SHIP_SPEED * timePassed)) /
      turnRate;
    const dy =
      ((Math.sin(turnRate * timePassed + QUANISATION_LEVEL + 90 - phase) -
        Math.sin(phase)) *
        (SHIP_SPEED * timePassed)) /
      turnRate;
    return {
      x: lastPosition.x + dx,
      y: lastPosition.y + dy,
    };
  }
}
