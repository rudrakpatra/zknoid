import {
  state,
  runtimeMethod,
  runtimeModule,
  RuntimeModule,
} from '@proto-kit/module';
import { State, StateMap, assert } from '@proto-kit/protocol';
import {
  PublicKey,
  Struct,
  Provable,
  Bool,
  Poseidon,
  Field,
  Int64,
} from 'o1js';
import { RandomGenerator } from '../engine';
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
import { cos, sin } from './utils';
import { UInt64 } from '@proto-kit/library';

export class Circle extends Struct({
  x: UInt64,
  y: UInt64,
  r: UInt64,
}) {
  static zero() {
    return new Circle({
      x: UInt64.from(0),
      y: UInt64.from(0),
      r: UInt64.from(0),
    });
  }
  public distanceSquared(other: Circle) {
    const dx = this.x.sub(other.x);
    const dy = this.y.sub(other.y);
    return dx.mul(dx).add(dy.mul(dy));
  }
  public collidesWith(other: Circle) {
    const s = this.r.add(other.r);
    const d = this.distanceSquared(other);
    return d.lessThanOrEqual(s.mul(s));
  }
}

export class Ship extends Struct({
  health: UInt64,
  circle: Circle,
  turnRate: UInt64,
  phase: UInt64,
  lastUpdatedAt: UInt64,
}) {
  static spawnAt(x: UInt64, y: UInt64, time: UInt64) {
    return new Ship({
      health: UInt64.from(INITIAL_SHIP_HEALTH),
      circle: new Circle({ x, y, r: UInt64.from(SHIP_SIZE) }),
      turnRate: UInt64.from(MAX_TURN_RATE),
      phase: UInt64.from(0),
      lastUpdatedAt: time,
    });
  }
  public hits(other: Circle, time: UInt64) {
    const currentPosition = getCurrentPosition(
      this.circle,
      this.phase,
      this.turnRate,
      time.sub(this.lastUpdatedAt),
    );
    return other.collidesWith(
      new Circle({
        x: currentPosition.x,
        y: currentPosition.y,
        r: UInt64.from(1),
      }),
    );
  }
}

export class CannonBall extends Struct({
  circle: Circle,
  spawnBlockHeight: UInt64,
}) {
  public static null() {
    return new CannonBall({
      circle: Circle.zero(),
      spawnBlockHeight: UInt64.from(0),
    });
  }
  public isNull() {
    return this.spawnBlockHeight.equals(UInt64.from(0));
  }
}

export class Player extends Struct({
  next: PublicKey,
  prev: PublicKey,
  ship: Ship,
  gold: UInt64,
  cannonBalls: UInt64,
  prevCannonBall: CannonBall,
  sailing: Bool,
}) {
  static startSailing(next: PublicKey, prev: PublicKey, ship: Ship) {
    return new Player({
      next,
      prev,
      ship,
      gold: UInt64.from(INITIAL_GOLD),
      cannonBalls: UInt64.from(INITIAL_CANNONBALLS),
      prevCannonBall: CannonBall.null(),
      sailing: Bool(true),
    });
  }
}

export class Loot extends Struct({
  circle: Circle,
}) {}

interface PiratesLogicConfig {}

@runtimeModule()
export class PiratesLogic extends RuntimeModule<PiratesLogicConfig> {
  @state() public players = StateMap.from<PublicKey, Player>(PublicKey, Player);
  @state() public loots = StateMap.from<UInt64, Loot>(UInt64, Loot);
  @state() public lootTop = State.from<UInt64>(UInt64);

  @runtimeMethod()
  public async spawn() {
    const senderPubKey = this.transaction.sender.value;
    const player = (await this.players.get(senderPubKey)).value;
    assert(player.sailing.not(), 'Player must not be sailing');
    const s = this.seed([Field(-1)]);
    const [a, b, c, d] = this.getRandomsInRange(0, WORLD_SIZE, s);

    const insertPlayer = async (curr: PublicKey, x: UInt64, y: UInt64) => {
      const blockHeight = new UInt64(this.network.block.height);
      const head = PublicKey.empty();
      const headV = (await this.players.get(PublicKey.empty())).value;
      const next = headV.next;
      const nextV = (await this.players.get(headV.next)).value;
      //insert between head and next
      await this.players.set(
        head,
        new Player({
          ...headV,
          next: curr,
        }),
      );
      await this.players.set(
        curr,
        Player.startSailing(next, head, Ship.spawnAt(x, y, blockHeight)),
      );
      await this.players.set(
        next,
        new Player({
          ...nextV,
          prev: curr,
        }),
      );
    };

    const insertLoot = async (x: UInt64, y: UInt64) => {
      const curr = (await this.lootTop.get()).value;
      await this.loots.set(
        curr,
        new Loot({
          circle: new Circle({
            x,
            y,
            r: UInt64.from(LOOT_SIZE),
          }),
        }),
      );
      await this.lootTop.set(curr.add(1));
    };

    await insertPlayer(senderPubKey, a, b);
    for (let i = 0; i < 5; i++) {
      const s = this.seed([Field(i)]);
      const [a, b, c, d] = this.getRandomsInRange(0, WORLD_SIZE, s);
      await insertLoot(a, b);
      await insertLoot(c, d);
    }
  }

  @runtimeMethod()
  public async leave(): Promise<void> {
    const senderPubKey = this.transaction.sender.value;
    const player = (await this.players.get(senderPubKey)).value;
    assert(player.sailing, 'Player is not sailing');

    const removePlayer = async (curr: PublicKey) => {
      const currV = (await this.players.get(curr)).value;
      const prev = currV.prev;
      const next = currV.next;
      const nextV = (await this.players.get(next)).value;
      const prevV = (await this.players.get(prev)).value;
      await this.players.set(
        prev,
        new Player({
          ...prevV,
          next: next,
        }),
      );
      await this.players.set(curr, Player.empty());
      await this.players.set(
        next,
        new Player({
          ...nextV,
          prev: prev,
        }),
      );
    };

    await removePlayer(senderPubKey);
  }
  @runtimeMethod()
  public async changeTurnRate(newTurnRate: UInt64): Promise<void> {
    const senderPubKey = this.transaction.sender.value;
    const blockHeight = new UInt64(this.network.block.height);
    const player = (await this.players.get(senderPubKey)).value;
    assert(player.sailing, 'Player is not sailing');
    // calculate current position
    const { x, y } = getCurrentPosition(
      player.ship.circle,
      player.ship.phase,
      player.ship.turnRate,
      blockHeight.sub(player.ship.lastUpdatedAt),
    );
    const { quotient, rest: phase } = player.ship.phase
      .add(player.ship.turnRate.mul(blockHeight.sub(player.ship.lastUpdatedAt)))
      .divMod(QUANISATION_LEVEL);

    await this.players.set(senderPubKey, {
      ...player,
      ship: new Ship({
        ...player.ship,
        turnRate: newTurnRate,
        circle: new Circle({
          x,
          y,
          r: player.ship.circle.r,
        }),
        lastUpdatedAt: blockHeight,
        phase,
      }),
    });
  }

  @runtimeMethod()
  public async shoot(offsetX: UInt64, offsetY: UInt64): Promise<void> {
    const senderPubKey = this.transaction.sender.value;
    const { isSome, value: player } = await this.players.get(senderPubKey);
    assert(isSome, 'Player does not exist');
    assert(player.sailing, 'Player is not sailing');
    assert(
      player.cannonBalls.equals(UInt64.from(0)).not(),
      'Player does not have cannonballs',
    );

    const blockHeight = new UInt64(this.network.block.height);
    const canShoot =
      // if (the player has not shot)
      player.prevCannonBall.isNull().or(
        //else if (it's cooldown is over)
        player.prevCannonBall.spawnBlockHeight
          .add(CANNON_WAIT_TIME)
          .lessThan(blockHeight),
      );
    assert(canShoot, 'Cannot shoot');

    const distanceSqr = offsetX.mul(offsetX).add(offsetY.mul(offsetY));
    const isAtRange = distanceSqr.lessThanOrEqual(
      UInt64.from(CANNON_RANGE * CANNON_RANGE),
    );
    assert(isAtRange, 'Offset is not inside range');

    //TODO: use commit reveal for the circle position
    await this.players.set(
      senderPubKey,
      new Player({
        ...player,
        prevCannonBall: new CannonBall({
          circle: new Circle({ x: offsetX, y: offsetY, r: UInt64.from(1) }),
          spawnBlockHeight: blockHeight,
        }),
        cannonBalls: player.cannonBalls.sub(1),
      }),
    );
  }

  /**
   * use this to prove that A has shot B
   * @param A pubkey of player A
   * @param B pubkey of player B
   */
  @runtimeMethod()
  public async hit(A: PublicKey, B: PublicKey): Promise<void> {
    const { value: playerA } = await this.players.get(A);
    assert(playerA.sailing, 'PlayerA is not sailing');
    const { value: playerB } = await this.players.get(B);
    assert(playerB.sailing, 'PlayerB is not sailing');

    const prevCannonBall = playerA.prevCannonBall;
    assert(prevCannonBall.isNull().not(), 'Player A never shot a cannonball');
    const cannonBallTriggerBlockHeight =
      prevCannonBall.spawnBlockHeight.add(CANNON_WAIT_TIME);
    const blockHeight = new UInt64(this.network.block.height);
    assert(
      cannonBallTriggerBlockHeight.equals(blockHeight),
      'Cannonball is not shot at this blockHeight',
    );

    //TODO: collision check
    const isHit = playerB.ship.hits(prevCannonBall.circle, blockHeight);
    assert(isHit, 'Cannonball did not hit the target');

    //update player B's health
    playerB.ship.health = playerB.ship.health.sub(UInt64.from(CANNON_DAMAGE));
    await this.players.set(B, playerB);
  }
  @runtimeMethod()
  public async pickupLoot(loot: UInt64): Promise<void> {
    const senderPubKey = this.transaction.sender.value;
    const blockHeight = new UInt64(this.network.block.height);
    const { value: player } = await this.players.get(senderPubKey);
    assert(player.sailing, 'Player is not sailing');

    const { isSome: isSomeLoot, value: lootV } = await this.loots.get(loot);
    // assert(isSomeLoot, 'Loot does not exist');

    assert(
      player.ship.hits(lootV.circle, blockHeight),
      'Ship does not hit the loot',
    );

    //update player's gold
    const reward = this.getRandomInRange(MIN_LOOT, MAX_LOOT);
    player.gold = player.gold.add(reward);
    await this.players.set(senderPubKey, player);
    const s = this.seed([Field(2)]);
    const [a, b, c, d] = this.getRandomsInRange(0, WORLD_SIZE, s);
    await this.loots.set(
      loot,
      new Loot({
        circle: new Circle({ x: a, y: b, r: UInt64.from(LOOT_SIZE) }),
      }),
    );
  }

  private seed = (fields: Field[]) =>
    Poseidon.hash([this.network.hash(), this.transaction.hash(), ...fields]);
  /**
   * uses network hash as seed
   * @param A a +ve integer
   * @param B a +ve integer
   * @returns gives a random number in range A to B
   */
  private getRandomInRange(A: number, B: number, seed = this.seed([])): UInt64 {
    return new UInt64(
      RandomGenerator.from(seed)
        .getNumber(B - A)
        .magnitude.add(A),
    );
  }
  /**
   * uses network hash as seed
   * @param A a +ve integer
   * @param B a +ve integer
   * @returns gives random numbers in range A to B
   */
  private getRandomsInRange(
    A: number,
    B: number,
    seed = this.seed([]),
  ): [UInt64, UInt64, UInt64, UInt64] {
    return RandomGenerator.from(seed)
      .getNumbers([B - A, B - A, B - A, B - A])
      .map((x) => x.magnitude.add(A))
      .map((x) => new UInt64(x)) as [UInt64, UInt64, UInt64, UInt64];
  }
}

export function getCurrentPosition(
  lastPosition: { x: UInt64; y: UInt64 },
  phase: UInt64,
  turnRate: UInt64,
  timePassed: UInt64,
): {
  x: UInt64;
  y: UInt64;
} {
  const turnRate_Adjusted = new UInt64(
    Provable.if(turnRate.equals(UInt64.zero), UInt64, UInt64.from(1), turnRate),
  );
  // dx = v( cos(wt-p)-cos(p) ) / w
  const dx = Provable.if(
    turnRate.equals(UInt64.zero),
    // sin(p)*vt
    sin(phase).mul(
      Int64.from(UInt64.from(SHIP_SPEED).mul(timePassed).toO1UInt64()),
    ),
    // ( cos(wt + 2pi - p) - cos(p) ) * v / w
    cos(turnRate.mul(timePassed).add(UInt64.from(QUANISATION_LEVEL).sub(phase)))
      .sub(cos(phase))
      .mul(Int64.from(UInt64.from(SHIP_SPEED).mul(timePassed).toO1UInt64()))
      .div(turnRate_Adjusted.toO1UInt64()),
  );
  // dy = v( sin(wt - p + pi) - sin(p) ) / w
  const y = Provable.if(
    turnRate.equals(UInt64.zero),
    // cos(p)*vt
    cos(phase).mul(
      Int64.from(UInt64.from(SHIP_SPEED).mul(timePassed).toO1UInt64()),
    ),
    // ( sin(wt + 3pi - p) - sin(p) ) * v / w
    sin(
      turnRate
        .mul(timePassed)
        .add(UInt64.from(QUANISATION_LEVEL).sub(phase).add(UInt64.from(90))),
    )
      .sub(sin(phase))
      .mul(Int64.from(UInt64.from(SHIP_SPEED).mul(timePassed).toO1UInt64()))
      .div(turnRate_Adjusted.toO1UInt64()),
  );

  // assuming x+dx, y+dy is positive, TODO do wrap arounds??
  return {
    x: new UInt64(dx.add(lastPosition.x.toO1UInt64()).magnitude),
    y: new UInt64(y.add(lastPosition.y.toO1UInt64()).magnitude),
  };
}
