import { Scene, Object3D, Vector3, Euler } from 'three';
import { Explosion } from './Explosion';
import { PiratesConstants } from './Constants';
import { PiratesProxy } from 'zknoid-chain-dev';

export class PlayerManager {
  private players: Map<string, PiratesProxy.ProxyPlayer> = new Map();
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
  }
  setShipModel(model: Object3D) {
    this.shipModel = model;
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
      shipInstance.userData.lastX = playerData.ship.circle.x;
      shipInstance.userData.lastY = playerData.ship.circle.y;
      shipInstance.userData.phase = playerData.ship.phase;
      shipInstance.userData.turnRate = playerData.ship.turnRate;
      shipInstance.userData.delta = 0;

      //transform ship
      shipInstance.position.set(
        playerData.ship.circle.x,
        0,
        playerData.ship.circle.y
      );
      shipInstance.rotation.y = playerData.ship.phase;
      shipInstance.updateMatrixWorld();
      this.scene.add(shipInstance);
    }
    this.players.set(pubKey, playerData);
  }

  private updatePlayer(pubKey: string, playerData: PiratesProxy.ProxyPlayer) {
    const ship = this.scene.getObjectByName(pubKey);
    if (ship) {
      // Update ship position, rotation, etc. based on playerData.ship
      // ship.userData.phase = playerData.ship.phase;
      // ship.userData.lastX = playerData.ship.circle.x;
      // ship.userData.lastY = playerData.ship.circle.y;
      // ship.userData.turnRate = playerData.ship.turnRate;
      // ship.userData.delta = 0;

      //transform ship
      ship.position.set(playerData.ship.circle.x, 0, playerData.ship.circle.y);
      ship.rotation.y = playerData.ship.phase;
      ship.updateMatrixWorld();
    }
    this.players.set(pubKey, playerData);
  }

  private removePlayer(pubKey: string) {
    const ship = this.scene.getObjectByName(pubKey);
    if (ship) {
      this.scene.remove(ship);
    }
    this.players.delete(pubKey);
  }

  update(delta: number) {
    this.updateShip(delta);
    this.updateCannonballs();
    this.updateExplosions(delta);
  }

  // private updateShip(delta: number) {
  //   for (const [pubKey, player] of this.players) {
  //     const ship = this.scene.getObjectByName(pubKey);
  //     if (ship) {
  //       const lastPosition = {
  //         x: ship.userData.lastX,
  //         y: ship.userData.lastY,
  //       };
  //       ship.userData.delta += delta;
  //       const newPosition = getCurrentPosition(
  //         lastPosition,
  //         ship.userData.phase,
  //         ship.userData.turnRate,
  //         ship.userData.delta / 1000
  //       );

  //       const newPhase =
  //         ship.userData.phase +
  //         (ship.userData.turnRate *
  //           (2 * Math.PI * BLOCK_FREQ) *
  //           ship.userData.delta) /
  //           100;
  //       console.log(newPosition);
  //       ship.position.setX(newPosition.x);
  //       ship.position.setZ(newPosition.y);
  //       ship.rotation.set(0, newPhase, 0);
  //       ship.updateMatrixWorld();
  //     }
  //   }
  // }

  private updateShip(delta: number) {
    for (const [pubKey, player] of this.players) {
      const ship = this.scene.getObjectByName(pubKey);
      if (ship) {
        // Update direction based on turn rate
        ship.rotateY(player.ship.turnRate * delta);
        // Calculate speed (you might want to adjust this based on your game's scale)
        const speed =
          ((PiratesConstants.SHIP_SPEED / 10 ** PiratesConstants.DECIMALS) *
            delta) /
          5;
        // Update ship's position
        ship.translateOnAxis(new Vector3(0, 0, -1), speed);
      }
    }
  }
  private updateCannonballs() {
    // For each player, update their cannonball if needed
    for (const [pubKey, player] of this.players) {
      const ship = this.scene.getObjectByName(pubKey);
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
  }
}
const BLOCK_FREQ = 1; //1 BLOCK HEIGHT PER SECOND
// Constants (you may need to adjust these based on your game's scale)
const SHIP_SPEED =
  PiratesConstants.SHIP_SPEED / 10 ** PiratesConstants.DECIMALS; // Adjust this value as needed

// function getCurrentPosition(
//   lastPosition: { x: number; y: number },
//   p: number,
//   w: number,
//   dt: number
// ) {
//   // Adjust turnRate to avoid division by zero
//   const w1 = w === 0 ? 1 : w;

//   let dx, dy;

//   if (w === 0) {
//     // Straight line motion
//     dx = Math.sin(p) * SHIP_SPEED * dt;
//     dy = Math.cos(p) * SHIP_SPEED * dt;
//   } else {
//     // Circular motion
//     dx =
//       (Math.cos(p - 2 * Math.PI * BLOCK_FREQ * w * dt) - Math.cos(p)) *
//       (SHIP_SPEED / w1);
//     dy =
//       (Math.sin(p - 2 * Math.PI * BLOCK_FREQ * w * dt) - Math.cos(p)) *
//       (SHIP_SPEED / w1);
//   }

//   // Calculate new position
//   const newX = lastPosition.x + dx * 5;
//   const newY = lastPosition.y + dy * 5;

//   return { x: newX, y: newY };
// }
