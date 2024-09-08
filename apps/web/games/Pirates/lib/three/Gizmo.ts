import * as THREE from 'three';

export class Gizmo {
  circle: THREE.Mesh;
  smallCircle: THREE.Mesh;
  range: number;
  highlightColor: THREE.Color;
  defaultColor: THREE.Color;
  isHovered: boolean;

  constructor(range: number, color: THREE.Color, highlightColor: THREE.Color) {
    this.range = range;
    this.defaultColor = color;
    this.highlightColor = highlightColor;
    this.isHovered = false;

    // Create the larger circle geometry
    let g = new THREE.CircleGeometry(this.range, 60);
    g.rotateX(-Math.PI / 2);

    // Create the material and mesh for the larger circle
    const material = new THREE.MeshBasicMaterial({
      color: this.defaultColor,
      opacity: 0.1,
      side: THREE.DoubleSide, // Make sure the circle is visible from both sides
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });
    this.circle = new THREE.Mesh(g, material);
    this.circle.renderOrder = 99;
    this.circle.onBeforeRender = function (renderer) {
      renderer.clearDepth();
    };

    // Create the smaller circle
    const smallG = new THREE.CircleGeometry(this.range * 0.1, 32);
    smallG.rotateX(-Math.PI / 2);

    const smallMaterial = new THREE.MeshBasicMaterial({
      color: this.highlightColor,
      opacity: 0.5,
      side: THREE.DoubleSide, // Make sure the small circle is visible from both sides
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });
    this.smallCircle = new THREE.Mesh(smallG, smallMaterial);
    this.smallCircle.visible = false; // Initially hidden
    this.smallCircle.renderOrder = 100;
    this.smallCircle.onBeforeRender = function (renderer) {
      renderer.clearDepth();
    };

    // Add both circles to a group for easy management
    this.circle.add(this.smallCircle);
  }

  updatePosition(position: THREE.Vector3) {
    this.circle.position.copy(position);
  }

  update(raycaster: THREE.Raycaster) {
    const intersects = raycaster.intersectObject(this.circle, false);
    if (intersects.length > 0) {
      // Place the smaller circle at the intersection point
      const intersectionPoint = intersects[0].point;
      this.smallCircle.position.copy(
        this.circle.worldToLocal(intersectionPoint)
      );
      this.smallCircle.visible = true;
      this.isHovered = true;
    } else {
      this.smallCircle.visible = false;
      this.isHovered = false;
    }
  }
}
