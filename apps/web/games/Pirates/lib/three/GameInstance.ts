import {
  Scene,
  WebGLRenderer,
  OrthographicCamera,
  Clock,
  Color,
  FogExp2,
  Vector3,
  AmbientLight,
  DirectionalLight,
  PCFSoftShadowMap,
  Object3D,
  Mesh,
  BoxGeometry,
  MeshBasicMaterial,
} from 'three';
import { Sea } from './Sea';
import { UIManager } from './UIManager';
import { LootManager } from './LootManager';
import { PlayerManager } from './PlayerManager';
import { CAMERA_OFFSET, CAMERA_LOOK_AT_OFFSET, SHIP_RANGE } from './Constants';
import { Size2 } from './Utils';
import { load, loadProxy } from './Load';
import { PirateState } from '../../stores/PiratesStore';
import { PiratesConstants } from 'zknoid-chain-dev';

export class GameInstance {
  scene: Scene;
  renderer: WebGLRenderer;
  camera: OrthographicCamera;
  sea: Sea;
  clock: Clock;

  uiManager: UIManager;
  lootManager: LootManager;
  playerManager: PlayerManager;
  loadedAssetLevel = 0;
  frustrumSize = SHIP_RANGE * 3;

  constructor(
    private canvas: HTMLCanvasElement,
    private size: Size2,
    private playerPubKeyBase58: string
  ) {
    // Initialize scene
    this.scene = new Scene();
    //add boxes to 0,0,0 0,0,WORLD_SIZE
    // this.scene.add(
    //   new Mesh(
    //     new BoxGeometry(10, 100, 10).translate(0, 0, 0),
    //     new MeshBasicMaterial({ color: 0xffaa00 })
    //   )
    // );
    // this.scene.add(
    //   new Mesh(
    //     new BoxGeometry(10, 100, 10).translate(size.w, 0, 0),
    //     new MeshBasicMaterial({ color: 0x00aaff })
    //   )
    // );
    // this.scene.add(
    //   new Mesh(
    //     new BoxGeometry(10, 100, 10).translate(0, 0, size.h),
    //     new MeshBasicMaterial({ color: 0xffff00 })
    //   )
    // );
    // this.scene.add(
    //   new Mesh(
    //     new BoxGeometry(10, 100, 10).translate(size.w, 0, size.h),
    //     new MeshBasicMaterial({ color: 0x00ff00 })
    //   )
    // );
    this.scene.background = new Color(0x00284a);
    // this.scene.fog = new FogExp2(0x00284a, 0.002);

    // Initialize renderer
    this.renderer = new WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(this.size.w, this.size.h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.setAnimationLoop(this.loop.bind(this));

    // Initialize camera
    const aspect = this.size.w / this.size.h;
    this.camera = new OrthographicCamera(
      (this.frustrumSize * aspect) / -2,
      (this.frustrumSize * aspect) / 2,
      this.frustrumSize / 2,
      this.frustrumSize / -2,
      0.1,
      1000
    );
    this.camera.position.set(CAMERA_OFFSET.x, CAMERA_OFFSET.y, CAMERA_OFFSET.z);
    this.camera.lookAt(new Vector3(0, 0, 0).add(CAMERA_LOOK_AT_OFFSET));

    // Initialize sea
    this.sea = new Sea(this.size);
    this.scene.add(this.sea.getMesh());
    this.scene.add(this.sea.getFoamParticles());

    // Initialize managers
    this.uiManager = new UIManager(
      this.size,
      this.scene,
      this.camera,
      this.canvas,
      this.playerPubKeyBase58
    );
    this.lootManager = new LootManager(this.scene);
    this.playerManager = new PlayerManager(this.scene, this.playerPubKeyBase58);

    // Initialize clock
    this.clock = new Clock(true);

    // Add lights
    this.addLights();

    // Add event listener for resize
    // window.addEventListener('resize', this.resize.bind(this));
  }

  private addLights() {
    const dirLight = new DirectionalLight(0xffffff, 10);
    dirLight.position.set(50, 200, 50);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 500;
    dirLight.shadow.bias = -0.001;
    this.scene.add(dirLight);

    const ambientLight = new AmbientLight(0x554433, 10);
    this.scene.add(ambientLight);

    const { ship, loot, cannonball } = loadProxy();
    this.playerManager.setShipModel(ship);
    this.playerManager.setCannonBallModel(cannonball);
    this.lootManager.setLootModel(loot);
    this.loadedAssetLevel = 1;
  }

  async loadAssets() {
    const { ship, loot, cannonball } = await load();
    this.playerManager.setShipModel(ship);
    this.playerManager.setCannonBallModel(cannonball);
    this.lootManager.setLootModel(loot);
    this.loadedAssetLevel = 2;
    console.log('loaded');
  }

  update() {
    const delta = this.clock.getDelta();
    this.playerManager.update(delta);
    this.lootManager.update(delta);
    this.checkLootCollection();
    this.sea.update(delta);
    this.updateSceneObjects();
    this.uiManager.update();
  }

  private checkLootCollection() {
    const playerShip = this.scene.getObjectByName(this.playerPubKeyBase58);
    if (!playerShip) return;

    const playerPosition = new Vector3();
    playerShip.getWorldPosition(playerPosition);

    const loots: Object3D[] = [];
    this.scene.traverse((child) => {
      if (child.name === 'loot') {
        loots.push(child);
      }
    });

    for (let i = loots.length - 1; i >= 0; i--) {
      const loot = loots[i];
      const lootPosition = new Vector3();
      loot.getWorldPosition(lootPosition);

      const player = this.playerManager.getPlayer(this.playerPubKeyBase58);
      if (
        player &&
        lootPosition.distanceTo(playerPosition) <
          player.ship.circle.r + PiratesConstants.LOOT_SIZE
      ) {
        loot.removeFromParent();
        this.onLootCollection(loot.id);
        loots.splice(i, 1);
      }
    }
  }

  onLootCollection = async (id: number) => {
    // Implement your loot collection logic here
    console.log(`Loot collected: ${id}`);
    // You can emit an event or call a callback function here
  };

  private updateSceneObjects() {
    this.scene.traverse((child) => {
      if (child.userData.type === 'ship' || child.userData.type === 'loot') {
        this.sea.addWeight(child);
        this.sea.align(child);
      }
    });
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  loop() {
    this.update();
    this.resize();
    this.render();
  }

  setFromPiratesState(state: PirateState) {
    this.playerManager.syncState(state.players);
    this.lootManager.syncState(state.loots);
  }

  resize() {
    const parentElement = this.canvas.parentElement;
    if (!parentElement) return;
    const rect = parentElement.getBoundingClientRect();
    if (this.canvas.width === rect.width && this.canvas.height === rect.height)
      return;
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;

    const aspect = this.canvas.width / this.canvas.height;
    this.camera.left = (this.frustrumSize * aspect) / -2;
    this.camera.right = (this.frustrumSize * aspect) / 2;
    this.camera.top = this.frustrumSize / 2;
    this.camera.bottom = this.frustrumSize / -2;

    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.canvas.width, this.canvas.height);
  }

  cleanup() {
    this.uiManager.cleanup();
    this.playerManager.cleanup();
    this.lootManager.cleanup();
    this.renderer.dispose();
    // window.removeEventListener('resize', this.resize.bind(this));
  }
}
