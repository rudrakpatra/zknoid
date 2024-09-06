import { state, runtimeMethod, runtimeModule, Runtime, RuntimeModule } from '@proto-kit/module';
import { StateMap, assert } from '@proto-kit/protocol';
import {
  PublicKey,
  Struct,
  UInt64,
  Provable,
  Bool,
  UInt32,
  Poseidon,
  Field,
} from 'o1js';
import { RandomGenerator } from '../engine';
import { CANNON_DAMAGE, CANNON_RANGE, CANNON_WAIT_TIME, INITIAL_CANNONBALLS, INITIAL_GOLD, INITIAL_SHIP_HEALTH, LOOT_SIZE, MAX_LOOT, MAX_TURN_RATE, MIN_LOOT, SHIP_SIZE, WORLD_SIZE } from './constants';

export class Circle extends Struct({
  x: UInt64,
  y: UInt64,
  r: UInt64
}) {
  static zero() {
    return new Circle({ x: UInt64.from(0), y: UInt64.from(0), r: UInt64.from(0) })
  }
}

export class Ship extends Struct({
  health: UInt64,
  circle: Circle,
  turnRate: UInt64,
  phase: UInt64,
  sailing:Bool,
}) {
  static spawnAt(x:UInt64,y:UInt64) {
    return new Ship({
      health: UInt64.from(INITIAL_SHIP_HEALTH),
      circle: new Circle({x,y,r:UInt64.from(SHIP_SIZE)}),
      turnRate: UInt64.from(MAX_TURN_RATE),
      phase: UInt64.from(0),
      sailing:Bool(true)
    });
  }
}

export class Player extends Struct({
  pubKey: PublicKey,
  ship: Ship,
  gold: UInt64,
  cannonBalls: UInt64,
}) {

  static init(pubKey: PublicKey, ship: Ship) {
    return new Player({
      pubKey,
      ship,
      gold: UInt64.from(INITIAL_GOLD),
      cannonBalls: UInt64.from(INITIAL_CANNONBALLS),
    });
  }
}

export class CannonBall extends Struct({
  circle: Circle,
  spawnBlockHeight: UInt64,
}) { }

export class Loot extends Struct({
  circle: Circle,
}) { 
}

interface PiratesLogicConfig {}

@runtimeModule()
export class PiratesLogic extends RuntimeModule<PiratesLogicConfig> {
  @state() public players = StateMap.from<PublicKey, Player>(PublicKey, Player);
  @state() public cannonballs = StateMap.from<PublicKey, CannonBall>(PublicKey, CannonBall);
  @state() public loots = StateMap.from<UInt64, Loot>(UInt64, Loot);
  @state() public lootCount = UInt64.from(0);
  @runtimeMethod()
  public async spawn() {
    for(const [a,b,c,d] of this.forRandomValuesInRange(0,WORLD_SIZE,1))
    {
      await this.players.set(this.transaction.sender.value, Player.init(this.transaction.sender.value, Ship.spawnAt(a,b)));
    }
    //spawn loots
    for(const [a,b,c,d] of this.forRandomValuesInRange(0,WORLD_SIZE,4))
    {
      await this.loots.set(this.lootCount,new Loot({circle:new Circle({x:a,y:b,r:UInt64.from(LOOT_SIZE)})}));
      this.lootCount=this.lootCount.add(1);
      await this.loots.set(this.lootCount,new Loot({circle:new Circle({x:c,y:d,r:UInt64.from(LOOT_SIZE)})}));
    }
  }
  @runtimeMethod()
  public async leave(): Promise<void> {
    const { isSome, value: player } = await this.players.get(this.transaction.sender.value);
    assert(isSome, "Player does not exist");
    assert(player.ship.sailing,"Player is not sailing");
    player.ship.sailing=Bool(false);
    await this.players.set(this.transaction.sender.value,player);
  }

  @runtimeMethod()
  public async changeTurnRate(newTurnRate: UInt64): Promise<void> {
    const { isSome, value: player } = await this.players.get(this.transaction.sender.value)
    assert(isSome, "Player does not exist");
    assert(player.ship.sailing,"Player is not sailing");
    //integer multiple of K
    player.ship.turnRate = newTurnRate;
    await this.players.set(this.transaction.sender.value, player);
  }

  @runtimeMethod()
  public async shoot(offsetX: UInt64, offsetY: UInt64): Promise<void> {
    const { isSome, value: player } = await this.players.get(this.transaction.sender.value)
    assert(isSome, "Player does not exist");
    assert(player.ship.sailing,"Player is not sailing");
    assert(player.cannonBalls.equals(UInt64.from(0)).not(),"Player does not have cannonballs");

    const currentBlockHeight = this.network.block.height;
    const { isSome: isSomePrevCannonBall, value: prevCannonBall } = await this.cannonballs.get(this.transaction.sender.value);
    const canShoot = isSomePrevCannonBall.and(prevCannonBall.spawnBlockHeight.add(CANNON_WAIT_TIME).lessThan(currentBlockHeight)).or(isSomePrevCannonBall.not());
    assert(canShoot, "Cannot shoot");

    const distanceSqr = offsetX.mul(offsetX).add(offsetY.mul(offsetY));
    const isAtRange = distanceSqr.lessThanOrEqual(UInt64.from(CANNON_RANGE * CANNON_RANGE));
    assert(isAtRange, "Offset is not inside range");

    const cannonBall = new CannonBall({ circle: new Circle({ x: offsetX, y: offsetY, r: UInt64.from(1) }), spawnBlockHeight: currentBlockHeight });
    await this.cannonballs.set(this.transaction.sender.value, cannonBall);
  }

  /**
   * use this to prove that A has shot B 
   * @param A pubkey of player A
   * @param B pubkey of player B
   */
  @runtimeMethod()
  public async hit(A: PublicKey, B: PublicKey): Promise<void> {
    const { isSome: isSomeA, value: playerA } = await this.players.get(A)
    assert(isSomeA, "Player A does not exist");
    assert(playerA.ship.sailing,"PlayerA is not sailing");
    const { isSome: isSomeB, value: playerB } = await this.players.get(B)
    assert(isSomeB, "Player B does not exist");
    assert(playerB.ship.sailing,"PlayerB is not sailing");

    const { isSome: isSomePrevCannonBall, value: prevCannonBall } = await this.cannonballs.get(A);
    assert(isSomePrevCannonBall, "Player A never shot a cannonball");
    const cannonBallTriggerBlockHeight = prevCannonBall.spawnBlockHeight.add(CANNON_WAIT_TIME);
    assert(cannonBallTriggerBlockHeight.equals(this.network.block.height), "Cannonball is not shot at this blockHeight");

    //TODO: collision check
    const isHit = Bool(true);
    assert(isHit, "Cannonball did not hit the target");

    //update player B's health
    playerB.ship.health = playerB.ship.health.sub(UInt64.from(CANNON_DAMAGE));
    await this.players.set(B, playerB);
  }
  @runtimeMethod()
  public async pickupLoot(lootId: UInt64): Promise<void> {
    const { isSome, value: player } = await this.players.get(this.transaction.sender.value);
    assert(isSome, "Player does not exist");
    assert(player.ship.sailing,"Player is not sailing");

    const { isSome: isSomeLoot, value: loot } = await this.loots.get(lootId);
    //TODO: collision check
    const isHit = Bool(true);
    assert(isHit, "Cannonball did not hit the target");

    //update player's gold
    const reward = this.getRandomInRange(MIN_LOOT, MAX_LOOT);
    player.gold = player.gold.add(reward);
    await this.players.set(this.transaction.sender.value, player);
    for(const [a,b,c,d] of this.forRandomValuesInRange(0,WORLD_SIZE,1))
    {
      await this.loots.set(lootId, new Loot({circle:new Circle({ x: a, y: b ,r:UInt64.from(LOOT_SIZE)})}));
    }
  }
  /**
   * uses network hash as seed
   * @param A a +ve integer
   * @param B a +ve integer
   * @returns gives a random number in range A to B
   */
  private getRandomInRange(A: number, B: number): UInt64 {
    const seed = Poseidon.hash([this.network.hash(), this.transaction.hash()]);
    return RandomGenerator.from(seed).getNumber((B - A)).magnitude.add(A);
  }
  /**
   * uses network hash as seed
   * @param A a +ve integer
   * @param B a +ve integer
   * @returns gives random numbers in range A to B
   */
  private forRandomValuesInRange(A: number, B: number,count:number):[UInt64,UInt64,UInt64,UInt64][] {
    return Array(count).fill(0).map((_,i)=>{
      const seed = Poseidon.hash([this.network.hash(), this.transaction.hash(),Field(i)]);
      return RandomGenerator.from(seed).getNumbers(([B - A,B-A,B-A,B-A])).map((x)=>x.magnitude.add(A)) as [UInt64,UInt64,UInt64,UInt64];
    });
  }
}


