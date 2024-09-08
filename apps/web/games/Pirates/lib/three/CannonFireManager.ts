import { Object3D, Vector3, Scene } from 'three';
import { Explosion } from './Explosion';
import { CANNON_WAIT_TIME } from './Constants';

export class CannonFireManager {
  private explosions: Explosion[] = [];

  constructor(private scene: Scene) {}

  checkCannonballFiring(playerShip: Object3D, cannonball: any) {
    if (cannonball) {
      const currentTime = performance.now();
      if (currentTime - cannonball.spawnTime > CANNON_WAIT_TIME) {
        this.fireCannonball(playerShip, cannonball);
        return null; // Return null to indicate the cannonball has been fired
      }
    }
    return cannonball; // Return the original cannonball if not fired
  }

  private fireCannonball(playerShip: Object3D, cannonball: any) {
    const explosionPosition = playerShip.position
      .clone()
      .add(new Vector3(cannonball.x, 0, cannonball.y));
    const explosion = new Explosion(explosionPosition);
    this.explosions.push(explosion);
    this.scene.add(explosion.particles);
  }

  updateExplosions(delta: number) {
    this.explosions = this.explosions.filter((explosion) => {
      const isAlive = explosion.update(delta);
      if (!isAlive) {
        this.scene.remove(explosion.particles);
        explosion.geometry.dispose();
        explosion.material.dispose();
      }
      return isAlive;
    });
  }
}
