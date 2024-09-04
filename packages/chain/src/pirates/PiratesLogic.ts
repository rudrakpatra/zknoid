import { state, runtimeMethod, runtimeModule, Runtime, RuntimeModule } from '@proto-kit/module';
import type { Option } from '@proto-kit/protocol';
import { State, StateMap, assert } from '@proto-kit/protocol';
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
import { RandomGenerator } from 'src/engine';

export class Circle extends Struct({
  x:UInt64,
  y:UInt64,
  r:UInt64
}){
  static zero(){
    return new Circle({x:UInt64.from(0),y:UInt64.from(0),r:UInt64.from(0)})
  }
}

export class Ship extends Struct({
  health:UInt64,
  circle:Circle,
  turnRate:UInt64,
  phase:UInt64,
}){
  static random() {
    // const x=RandomGenerator.from(seed).getNumber(WORLD_SIZE);
    // const y=RandomGenerator.from(seed).getNumber(WORLD_SIZE);
    const randomUInt64=(max:number)=>
      Provable.witness(UInt64, () => UInt64.from(Math.random()*max));
    const x=randomUInt64(WORLD_SIZE);
    const y=randomUInt64(WORLD_SIZE);
    return new Ship({
      health:UInt64.from(INITIAL_SHIP_HEALTH),
      circle: new Circle({x,y,r:UInt64.from(SHIP_SIZE)}),
      turnRate:UInt64.from(MAX_TURN_RATE),
      phase:UInt64.from(0),
    });
  }
}

export class Player extends Struct({
  pubKey:PublicKey,
  ship:Ship,
  gold:UInt64,
  cannonBalls:UInt64
}){

  static init(pubKey: PublicKey,ship:Ship) {
    return new Player({
      pubKey,
      ship,
      gold: UInt64.from(0),
      cannonBalls: UInt64.from(INITIAL_CANNONBALLS),
    });
  }
}

export class CannonBall extends Struct({
  circle:Circle,
  spawnBlockHeight:UInt64,
}){}

export class Loot extends Struct({
  circle:Circle,
}){}

@runtimeModule()
export class PiratesLogic extends RuntimeModule<{}>{
  @state() public players = StateMap.from<PublicKey, Player>(PublicKey, Player);
  @state() public cannonballs = StateMap.from<PublicKey, CannonBall>(PublicKey, CannonBall);
  @state() public loots=StateMap.from<UInt64, Loot>(UInt64, Loot);
  @runtimeMethod()
  public async spawnShip(){
    this.players.set(this.transaction.sender.value, Player.init(this.transaction.sender.value, Ship.random()));
  }

  @runtimeMethod()
  public async changeTurnRate(newTurnRate: UInt64): Promise<void> {
    const {isSome,value:player}=await this.players.get(this.transaction.sender.value)
    assert(isSome, "Player does not exist");
    //integer multiple of K
    player.ship.turnRate=newTurnRate;
    this.players.set(this.transaction.sender.value,player);
  }
  
  @runtimeMethod()
  public async shoot(offsetX:UInt64,offsetY:UInt64): Promise<void> {
    const {isSome,value:player}=await this.players.get(this.transaction.sender.value)
    assert(isSome, "Player does not exist");
    const currentBlockHeight=this.network.block.height;
    const {isSome:isSomePrevCannonBall,value:prevCannonBall}=await this.cannonballs.get(this.transaction.sender.value);
    const canShoot=isSomePrevCannonBall.and(prevCannonBall.spawnBlockHeight.add(CANNON_WAIT_TIME).lessThan(currentBlockHeight)).or(isSomePrevCannonBall.not());
    assert(canShoot, "Cannot shoot");

    const distanceSqr=offsetX.mul(offsetX).add(offsetY.mul(offsetY));
    const isAtRange=distanceSqr.lessThanOrEqual(UInt64.from(CANNON_RANGE*CANNON_RANGE));
    assert(isAtRange, "Offset is not inside range");

    const cannonBall=new CannonBall({circle: new Circle({x:offsetX,y:offsetY,r:UInt64.from(1)}),spawnBlockHeight:currentBlockHeight});
    this.cannonballs.set(this.transaction.sender.value,cannonBall);
  }

  /**
   * use this to prove that A has shot B 
   * @param A pubkey of player A
   * @param B pubkey of player B
   */
  @runtimeMethod()
  public async hit(A:PublicKey,B:PublicKey): Promise<void> {
    const {isSome:isSomeA,value:playerA}=await this.players.get(A)
    assert(isSomeA, "Player A does not exist");
    const {isSome:isSomeB,value:playerB}=await this.players.get(B)
    assert(isSomeB, "Player B does not exist");

    const {isSome:isSomePrevCannonBall,value:prevCannonBall}=await this.cannonballs.get(A);
    assert(isSomePrevCannonBall, "Player A never shoot a cannonball");
    const cannonBallTriggerBlockHeight=prevCannonBall.spawnBlockHeight.add(CANNON_WAIT_TIME);
    assert(cannonBallTriggerBlockHeight.equals(this.network.block.height),"Cannonball is not shot at this blockHeight");

    //TODO: collision check
    const isHit=Bool(true);
    assert(isHit,"Cannonball did not hit the target");

    //update player B's health
    playerB.ship.health=playerB.ship.health.sub(UInt64.from(CANNON_DAMAGE));
    this.players.set(B,playerB);
  }
  @runtimeMethod()
  public async pickupLoot(lootId:UInt64): Promise<void> {
    const {isSome,value:player}=await this.players.get(this.transaction.sender.value);
    assert(isSome, "Player does not exist");

    const {isSome:isSomeLoot,value:loot}=await this.loots.get(lootId);
    //TODO: collision check
    const isHit=Bool(true);
    assert(isHit,"Cannonball did not hit the target");

    //update player's gold
    const reward=this.getRandomInRange(MIN_LOOT,MAX_LOOT);
    player.gold=player.gold.add(reward);
  }
  /**
   * uses network hash as seed
   * @param A a +ve integer
   * @param B a +ve integer
   * @returns gives a random number in range A to B
   */
  private getRandomInRange(A:number,B:number):UInt64{
    const seed=Poseidon.hash([this.network.hash(),this.transaction.hash()]);
    return RandomGenerator.from(seed).getNumber((B-A)).magnitude.add(A);
  }
}


