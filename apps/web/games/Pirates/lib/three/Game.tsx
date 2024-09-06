import {
  AmbientLight,
  Clock,
  Color,
  DirectionalLight,
  FogExp2,
  Intersection,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { Explosion } from './Explosion';
import { Sea } from './Sea';
import { Gizmo } from './Gizmo';
import { load } from './Load';
import { Size2 } from './Utils';
import {
  CAMERA_OFFSET,
  CAMERA_LOOK_AT_OFFSET,
  CANNON_WAIT_TIME,
  INITIAL_TURN_RATE,
  MAX_TURN_RATE,
  SHIP_RANGE,
  SHIP_SIZE,
} from './Constants';

export interface GameState {
  turnRate: number;
  health: number;
  cannonballs: number;
  gold: number;
  offsetX: number;
  offsetY: number;
  setHealth: (health: number) => void;
  setCannonballs: (cannonballs: number) => void;
  setGold: (gold: number) => void;
  setOffset: (x: number, y: number) => void;
  setTurnRate: (rate: number) => void;
}

class Ship {
  ref: number | null = null;
  cannonball: Cannonball | null = null;
  size = SHIP_SIZE;
  constructor(
    public turnRate = INITIAL_TURN_RATE,
    public maxTurnRate = MAX_TURN_RATE,
    public range = SHIP_RANGE
  ) {}
}

class Cannonball {
  spawnTime: number;
  constructor(
    public x: number,
    public y: number
  ) {
    this.spawnTime = performance.now();
  }
}

class Player {
  ship: Ship;
  constructor() {
    this.ship = new Ship();
  }
  setCannonball(offset: Vector2) {
    this.ship.cannonball = new Cannonball(offset.x, offset.y);
  }
  setTurnRate(t: number) {
    this.ship.turnRate = Math.max(-MAX_TURN_RATE, Math.min(MAX_TURN_RATE, t));
  }
}

export class GameInstance {
  scene: Scene;
  renderer: WebGLRenderer;
  camera: PerspectiveCamera;
  cameraOffset = CAMERA_OFFSET;
  cameraLookAtOffset = CAMERA_LOOK_AT_OFFSET;
  sea: Sea;
  gizmo: Gizmo;
  raycaster: Raycaster;
  mouse: Vector2;
  clock: Clock;
  player: Player;
  gameState: GameState;
  explosions: Explosion[] = [];
  plane: Mesh<PlaneGeometry, MeshBasicMaterial>;

  constructor(
    public size: Size2,
    private canvas: HTMLCanvasElement,
    initialGameState: GameState
  ) {
    this.gameState = initialGameState;
    this.player = new Player();
    this.clock = new Clock(true);
    this.scene = new Scene();
    this.scene.background = new Color(0xcccccc);
    this.scene.fog = new FogExp2(0xcccccc, 0.002);

    this.renderer = new WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.setAnimationLoop(this.animate.bind(this));

    this.camera = new PerspectiveCamera(
      60,
      this.canvas.width / this.canvas.height,
      1,
      1000
    );
    this.camera.position.set(
      this.cameraOffset.x,
      this.cameraOffset.y,
      this.cameraOffset.z
    );
    this.camera.lookAt(new Vector3(0, 0, 0).add(this.cameraLookAtOffset));

    this.sea = new Sea(this.size);
    this.scene.add(this.sea.mesh());

    this.gizmo = new Gizmo(
      this.player.ship.range,
      new Color(0xffffff),
      new Color(0xff0000)
    );
    this.scene.add(this.gizmo.circle);

    this.raycaster = new Raycaster();
    this.mouse = new Vector2();
    this.renderer = new WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.camera = new PerspectiveCamera(
      60,
      this.canvas.width / this.canvas.height,
      1,
      1000
    );
    this.plane = new Mesh(
      new PlaneGeometry(this.size.w, this.size.h).rotateX(-Math.PI / 2),
      new MeshBasicMaterial({ transparent: true, opacity: 0 })
    );
    this.scene.add(this.plane);
  }
  async init() {
    this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.addEventListener('click', this.onClick.bind(this));
    const { ship, loot } = await load();
    const playerShip = ship.scene.clone();
    this.player.ship.ref = playerShip.id;
    this.scene.add(playerShip);
    this.addLights();
    this.addRandomly(loot, 10, 10, 100);
  }

  cleanup() {
    this.canvas.removeEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.removeEventListener('click', this.onClick.bind(this));
    this.cleanupThreeJsResources();
  }

  private cleanupThreeJsResources() {
    this.scene.traverse((object) => {
      if (object instanceof Mesh) {
        object.geometry.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach((material) => material.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
    this.renderer.dispose();
  }

  onMouseMove(event: MouseEvent) {
    this.updateMousePosition(event);
    this.raycaster.setFromCamera(this.mouse.clone(), this.camera);
    const intersects = this.raycaster.intersectObject(this.plane, false);
    if (this.player.ship.ref) {
      const playerShip = this.scene.getObjectById(this.player.ship.ref);
      if (playerShip && intersects.length) {
        const player = new Vector3();
        playerShip.getWorldPosition(player);
        const offset = intersects[0].point.sub(player);
        intersects.length && this.gameState.setOffset(offset.x, offset.z);
      }
    }
    this.onChange(intersects);
  }

  onClick(event: MouseEvent) {
    this.updateMousePosition(event);
    this.raycaster.setFromCamera(this.mouse.clone(), this.camera);
    const intersects = this.raycaster.intersectObject(this.scene, false);
    if (this.player.ship.ref) {
      const playerShip = this.scene.getObjectById(this.player.ship.ref);
      if (playerShip && intersects.length) {
        const player = new Vector3();
        playerShip.getWorldPosition(player);
        const offset = intersects[0].point.sub(player);
        intersects.length && this.gameState.setOffset(offset.x, offset.z);
      }
    }
    this.onInput(intersects);
  }
  private updateMousePosition(event: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = (-(event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  onInput(intersects: Intersection[]) {
    // Implementation remains the same
  }

  onChange(intersects: Intersection[]) {
    // Implementation remains the same
  }
  onLootCollection(lootId: number) {
    // Implementation remains the same
  }

  addLights() {
    const dirLight1 = new DirectionalLight(0xffffff, 10);
    dirLight1.position.set(50, 200, 50);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 2048;
    dirLight1.shadow.mapSize.height = 2048;
    dirLight1.shadow.camera.near = 1;
    dirLight1.shadow.camera.far = 500;
    dirLight1.shadow.bias = -0.001;
    this.scene.add(dirLight1);

    const ambientLight = new AmbientLight(0x554433, 10);
    this.scene.add(ambientLight);
  }

  addRandomly(obj: Object3D, x: number, y: number, s = 20) {
    for (let i = 0; i < x; i++) {
      for (let j = 0; j < y; j++) {
        const clone = obj.clone();
        clone.position.set(
          s * (i - x / 2) + Math.random() * s,
          0,
          s * (j - y / 2) + Math.random() * s
        );
        this.scene.add(clone);
      }
    }
  }

  animate() {
    const delta = this.clock.getDelta();
    this.updatePlayerShip(delta);
    this.updateExplosions(delta);
    this.sea.update();
    this.updateSceneObjects();
    this.render();
  }

  private updatePlayerShip(delta: number) {
    if (!this.player.ship.ref) return;

    const playerShip = this.scene.getObjectById(this.player.ship.ref);
    if (!playerShip) return;

    this.updateShipTurnRate(playerShip);
    this.updateGizmo(playerShip);
    this.checkCannonballFiring(playerShip);

    const playerPosition = new Vector3();
    playerShip.getWorldPosition(playerPosition);

    // Maintain a separate array for loots
    const loots: Object3D[] = [];
    this.scene.traverse((child) => {
      if (child.name === 'loot') {
        loots.push(child);
      }
    });

    // Iterate through the loots array
    for (let i = loots.length - 1; i >= 0; i--) {
      const loot = loots[i];
      const lootPosition = new Vector3();
      loot.getWorldPosition(lootPosition);

      if (lootPosition.distanceTo(playerPosition) < this.player.ship.size) {
        loot.removeFromParent();
        this.onLootCollection(loot.id);
        loots.splice(i, 1);
      }
    }
  }

  private updateShipTurnRate(playerShip: Object3D) {
    playerShip.userData.turnRate = -this.player.ship.turnRate / (30 * 360);
  }

  private updateGizmo(playerShip: Object3D) {
    this.gizmo.updatePosition(playerShip.position);
    this.raycaster.setFromCamera(this.mouse.clone(), this.camera);
    this.gizmo.checkHover(this.raycaster);
  }

  private checkCannonballFiring(playerShip: Object3D) {
    if (this.player.ship.cannonball) {
      const currentTime = performance.now();
      if (
        currentTime - this.player.ship.cannonball.spawnTime >
        CANNON_WAIT_TIME
      ) {
        this.fireCannonball(playerShip);
      }
    }
  }

  private fireCannonball(playerShip: Object3D) {
    if (!this.player.ship.cannonball) return;
    const explosionPosition = playerShip.position
      .clone()
      .add(
        new Vector3(
          this.player.ship.cannonball.x,
          0,
          this.player.ship.cannonball.y
        )
      );
    const explosion = new Explosion(explosionPosition);
    this.explosions.push(explosion);
    this.scene.add(explosion.particles);
    this.player.ship.cannonball = null;
    this.gameState.setCannonballs(this.gameState.cannonballs - 1);
  }

  private updateExplosions(delta: number) {
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

  private updateSceneObjects() {
    this.scene.traverse((child) => {
      if (child.name === 'ship' || child.name === 'loot') {
        this.sea.align(child);
      }
      if (child.name === 'ship') {
        this.updateShipMovement(child);
      }
    });
  }

  private updateShipMovement(ship: Object3D) {
    ship.userData.direction = ship.userData.direction || Math.PI / 2;
    ship.userData.direction += ship.userData.turnRate;
    const speed = 0.1;

    ship.rotateY(ship.userData.direction);

    const forward = new Vector3(0, 0, -1);
    forward.applyQuaternion(ship.quaternion);

    ship.position.add(forward.multiplyScalar(speed));

    const cameraPosition = ship.position.clone().add(this.cameraOffset);
    this.camera.position.set(
      cameraPosition.x,
      cameraPosition.y,
      cameraPosition.z
    );
    this.camera.lookAt(ship.position.clone().add(this.cameraLookAtOffset));
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
