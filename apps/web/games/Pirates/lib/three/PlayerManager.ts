import { Scene, Object3D, Vector3, Euler, Mesh } from 'three';
import { Explosion } from './Explosion';
import { PiratesConstants } from './Constants';
import { PiratesProxy } from 'zknoid-chain-dev';

export class PlayerManager {
  private players: Map<string, PiratesProxy.ProxyPlayer> = new Map();
  private ships: Map<string, Object3D> = new Map();
  private shipModel: Object3D = new Object3D();
  private cannonballs: Map<string, Object3D> = new Map();
  private cannonBall: Object3D = new Object3D();
  private cannonExplosions: Explosion[] = [];

  constructor(
    private scene: Scene,
    private currentPlayerPubKey: string
  ) {}

  setCannonBallModel(model: Object3D) {
    this.cannonBall = model;
    this.scene.traverse((child) => {
      if (child.userData.type == 'cannonball') {
        const parent = child.parent;
        if (parent) {
          child.removeFromParent();
          const instance = this.cannonBall.clone();
          instance.name = child.name;
          instance.position.copy(child.position);
          instance.rotation.copy(child.rotation);
          parent.add(instance);
        }
      }
    });
  }

  setShipModel(model: Object3D) {
    this.shipModel = model;
    this.scene.traverse((child) => {
      if (child.userData.type == 'ship') {
        const parent = child.parent;
        if (parent) {
          child.removeFromParent();
          const instance = this.shipModel.clone();
          instance.name = child.name;
          instance.position.copy(child.position);
          instance.rotation.copy(child.rotation);
          console.log('added', instance);
          parent.add(instance);
        }
      }
    });
  }

  syncState(players: { [key: string]: PiratesProxy.ProxyPlayer }) {
    for (const [pubKey, playerData] of Object.entries(players)) {
      if (!this.players.has(pubKey)) {
        this.addPlayer(pubKey, playerData);
      } else {
        this.updatePlayer(pubKey, playerData);
      }
    }

    for (const pubKey of this.players.keys()) {
      if (!(pubKey in players)) {
        this.removePlayer(pubKey);
      }
    }
  }

  private addPlayer(pubKey: string, playerData: PiratesProxy.ProxyPlayer) {
    if (this.shipModel) {
      const shipInstance = this.shipModel.clone();
      shipInstance.name = pubKey;

      shipInstance.position.set(
        playerData.ship.circle.x,
        0,
        playerData.ship.circle.y
      );
      shipInstance.rotation.y = playerData.ship.phase;
      shipInstance.updateMatrix();
      this.scene.add(shipInstance);

      this.ships.set(pubKey, shipInstance);
    }
    this.players.set(pubKey, playerData);
  }

  private updatePlayer(pubKey: string, playerData: PiratesProxy.ProxyPlayer) {
    const ship = this.ships.get(pubKey);
    if (ship) {
      ship.position.set(playerData.ship.circle.x, 0, playerData.ship.circle.y);
      ship.rotation.y = playerData.ship.phase;
      ship.updateMatrix();
    }
    this.players.set(pubKey, playerData);
  }

  private removePlayer(pubKey: string) {
    const ship = this.ships.get(pubKey);
    if (ship) {
      this.scene.remove(ship);
      this.ships.delete(pubKey);
    }
    this.players.delete(pubKey);
  }

  update(delta: number) {
    this.updateShips(delta);
    this.updateCannonballs();
    this.updateExplosions(delta);
  }

  private updateShips(delta: number) {
    // for (const [pubKey, ship] of this.ships) {
    // if (ship.userData.angle === undefined) ship.userData.angle = 0;
    // const dAngle =
    //   (this.getPlayer(pubKey)!.ship.turnRate /
    //     PiratesConstants.QUANISATION_LEVEL) *
    //   2 *
    //   Math.PI *
    //   delta;
    // ship.userData.angle += dAngle;
    // ship.rotation.y = ship.userData.angle;
    // console.log(ship);
    // const speed =
    //   (PiratesConstants.SHIP_SPEED / 10 ** PiratesConstants.DECIMALS) * delta;
    // ship.translateOnAxis(new Vector3(0, 0, -1), speed);
    // }
  }

  private updateCannonballs() {
    for (const [pubKey, player] of this.players) {
      const ship = this.ships.get(pubKey);
      if (ship && player.prevCannonBall) {
        const currentBlockHeight = this.scene.userData.blockHeight as number;
        if (
          currentBlockHeight ===
          player.prevCannonBall.spawnBlockHeight +
            PiratesConstants.CANNON_WAIT_TIME
        ) {
          this.fireCannonball(ship, player);
        }
      }
    }
  }

  private fireCannonball(ship: Object3D, player: PiratesProxy.ProxyPlayer) {
    if (player.prevCannonBall) {
      const explosionPosition = ship.position
        .clone()
        .add(
          new Vector3(
            player.prevCannonBall.circle.x,
            0,
            player.prevCannonBall.circle.y
          )
        );
      const explosion = new Explosion(explosionPosition);
      this.cannonExplosions.push(explosion);
      this.scene.add(explosion.particles);
    }
  }

  private updateExplosions(delta: number) {
    this.cannonExplosions = this.cannonExplosions.filter((explosion) => {
      const isAlive = explosion.update(delta);
      if (!isAlive) {
        this.scene.remove(explosion.particles);
        explosion.geometry.dispose();
        explosion.material.dispose();
      }
      return isAlive;
    });
  }

  getPlayer(pubKey: string): PiratesProxy.ProxyPlayer | undefined {
    return this.players.get(pubKey);
  }

  cleanup() {
    for (const pubKey of this.players.keys()) {
      this.removePlayer(pubKey);
    }
    for (const explosion of this.cannonExplosions) {
      this.scene.remove(explosion.particles);
      explosion.geometry.dispose();
      explosion.material.dispose();
    }
    this.ships.clear();
  }
}
