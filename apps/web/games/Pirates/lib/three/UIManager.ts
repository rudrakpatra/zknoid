import {
  Scene,
  Raycaster,
  Vector2,
  Mesh,
  PlaneGeometry,
  MeshBasicMaterial,
  Vector3,
  Color,
  Object3D,
  OrthographicCamera,
} from 'three';
import { Gizmo } from './Gizmo';
import { SHIP_RANGE, CAMERA_OFFSET, CAMERA_LOOK_AT_OFFSET } from './Constants';
import { Size2 } from './Utils';

export class UIManager {
  private raycaster: Raycaster;
  private mouse: Vector2;
  private plane: Mesh;
  private gizmo: Gizmo;

  constructor(
    private size: Size2,
    private scene: Scene,
    private camera: OrthographicCamera,
    private canvas: HTMLCanvasElement,
    private playerPubKeyBase58: string
  ) {
    this.raycaster = new Raycaster();
    this.mouse = new Vector2();

    // Initialize plane
    this.plane = new Mesh(
      new PlaneGeometry(this.size.w, this.size.h)
        .rotateX(-Math.PI * 0.5)
        .translate(this.size.w / 2, 0, this.size.h / 2),
      new MeshBasicMaterial({ visible: false })
    );
    this.scene.add(this.plane);

    // Initialize gizmo
    this.gizmo = new Gizmo(
      SHIP_RANGE,
      new Color(0xffffff),
      new Color(0xff0000)
    );
    this.scene.add(this.gizmo.circle);

    // Add event listeners
    this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.addEventListener('click', this.onClick.bind(this));
  }

  cleanup() {
    this.canvas.removeEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.removeEventListener('click', this.onClick.bind(this));
  }

  private onMouseMove(event: MouseEvent) {
    this.updateMousePosition(event);
    this.raycaster.setFromCamera(this.mouse, this.camera);
    this.gizmo.update(this.raycaster);
    const intersection = this.getIntersection();
    if (intersection) {
      this.onOffsetMove(intersection);
    }
  }

  private onClick(event: MouseEvent) {
    this.updateMousePosition(event);
    const intersection = this.getIntersection();
    if (intersection) {
      this.onOffsetClick(intersection);
    }
  }

  private onOffsetMove(intersectionPoint: Vector3) {
    const playerShip = this.findPlayerShip();
    if (playerShip) {
      const playerPosition = new Vector3();
      playerShip.getWorldPosition(playerPosition);
      const offset = intersectionPoint.sub(playerPosition);
      // Emit event or callback with offset
      this.onNewOffset(offset.x, offset.z);
    }
  }

  private onOffsetClick(intersectionPoint: Vector3) {
    const playerShip = this.findPlayerShip();
    if (playerShip) {
      const playerPosition = new Vector3();
      playerShip.getWorldPosition(playerPosition);
      const offset = intersectionPoint.sub(playerPosition);
      // Emit event or callback with offset
      this.onNewOffsetFinal(offset.x, offset.z);
    }
  }

  public onNewOffset(x: number, y: number) {
    // to be implemented by user
  }
  public onNewOffsetFinal(x: number, y: number) {
    // to be implemented by user
  }

  private updateMousePosition(event: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private getIntersection(): Vector3 | null {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.plane);
    return intersects.length > 0 ? intersects[0].point : null;
  }

  private findPlayerShip(): Object3D | null {
    return this.scene.getObjectByName(this.playerPubKeyBase58) || null;
  }

  public updateCameraPosition() {
    const playerShip = this.findPlayerShip();
    if (playerShip) {
      const playerPosition = new Vector3();
      playerShip.getWorldPosition(playerPosition);
      // Update camera position
      this.camera.position.copy(playerPosition).add(CAMERA_OFFSET);

      // Update camera look at
      const lookAtPosition = playerPosition.clone().add(CAMERA_LOOK_AT_OFFSET);
      this.camera.lookAt(lookAtPosition);
    }
  }

  // This method should be called by your game loop
  public update() {
    this.gizmo.updatePosition(this.findPlayerShip()?.position || new Vector3());
    this.updateCameraPosition();
  }
}
