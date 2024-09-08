import * as THREE from 'three';
import { Foam } from './Foam';
import type { Size2 } from './Utils';

export class Sea {
  private size: Size2;
  private geometry: THREE.PlaneGeometry;
  private material: THREE.MeshStandardMaterial;
  private mesh: THREE.Mesh;
  private clock: THREE.Clock;
  private uniforms: {
    time: { value: number };
    grid: { value: number };
  };
  private scaleHeight = 0.4;
  private foam: Foam;
  private weightMask: boolean[][];

  constructor(size: Size2) {
    this.size = size;
    this.clock = new THREE.Clock();
    this.geometry = new THREE.PlaneGeometry(
      this.size.w,
      this.size.h,
      200,
      200
    ).rotateX(-Math.PI * 0.5);

    this.uniforms = {
      time: { value: 0 },
      grid: { value: this.size.w / 5 },
    };
    this.material = this.createSeaMaterial();
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.translateX(this.size.w / 2);
    this.mesh.translateZ(this.size.h / 2);
    this.mesh.scale.setY(this.scaleHeight);

    this.foam = new Foam(this, 5000); // Create 5,000 foam particles
    this.getFoamParticles().translateX(this.size.w / 2);
    this.getFoamParticles().translateZ(this.size.h / 2);
    this.weightMask = Array(Math.ceil(size.w / 10))
      .fill(null)
      .map(() => Array(Math.ceil(size.h / 10)).fill(false));
  }

  private createSeaMaterial(): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({
      color: 0x0088aa,
      roughness: 1,
    });

    material.onBeforeCompile = (shader) => {
      shader.uniforms.time = this.uniforms.time;
      shader.uniforms.grid = this.uniforms.grid;

      shader.vertexShader = `
                uniform float time;
                uniform float grid;  
                varying float vHeight;
                vec3 moveWave(vec3 p){
                    vec3 retVal = p;
                    float ang;
                    float kzx = 360.0/grid;
                    // Wave1 (135 degrees)
                    ang = 50.0*time + -1.0*p.x*kzx + -2.0*p.z*kzx;
                    ang = mod(ang, 360.0) * 3.14159265/180.0;
                    retVal.y = 3.0*sin(ang);
                    // Wave2 (090)
                    ang = 25.0*time + -3.0*p.x*kzx;
                    ang = mod(ang, 360.0) * 3.14159265/180.0;
                    retVal.y = retVal.y + 2.0*sin(ang);
                    // Wave3 (180 degrees)
                    ang = 15.0*time - 3.0*p.z*kzx;
                    ang = mod(ang, 360.0) * 3.14159265/180.0;
                    retVal.y = retVal.y + 2.0*sin(ang);
                    // Wave4 (225 degrees)
                    ang = 50.0*time + 4.0*p.x*kzx + 8.0*p.z*kzx;
                    ang = mod(ang, 360.0) * 3.14159265/180.0;
                    retVal.y = retVal.y + 0.5*sin(ang);
                    // Wave5 (270 degrees)
                    ang = 50.0*time + 8.0*p.x*kzx;
                    ang = mod(ang, 360.0) * 3.14159265/180.0;
                    retVal.y = retVal.y + 0.5*sin(ang);
                    return retVal;
                }					
                ${shader.vertexShader}
            `
        .replace(
          `#include <beginnormal_vertex>`,
          `#include <beginnormal_vertex>
                    vec3 p = position;
                    vec2 move = vec2(1, 0);
                    vec3 pos = moveWave(p);
                    vec3 pos2 = moveWave(p + move.xyy);
                    vec3 pos3 = moveWave(p + move.yyx);
                    objectNormal = normalize(cross(normalize(pos2-pos), normalize(pos3-pos)));
                `
        )
        .replace(
          `#include <begin_vertex>`,
          `#include <begin_vertex>
                    transformed = pos;
                    vHeight = pos.y;
                `
        );
      shader.fragmentShader = `
				varying float vHeight;
				${shader.fragmentShader}
			  `.replace(
        `#include <color_fragment>`,
        `#include <color_fragment>
				  diffuseColor.rgb = mix(vec3(0.0,0.3,0.7), vec3(0.05,0.4,0.65), smoothstep(0.0, 6.0, vHeight));
				`
      );
    };

    return material;
  }

  align(obj: THREE.Object3D) {
    // 3 points pinning method
    const offsetX = 1;
    const offsetY = 1;
    const offsetZ = 1;
    const v = new THREE.Vector3();
    this.mesh.getWorldPosition(v);
    // Sample heights at three points

    const sample = obj.position.clone().sub(v);
    const centerHeight = this.getHeightAt(sample) + offsetY;
    const forwardHeight =
      this.getHeightAt(sample.clone().add(new THREE.Vector3(0, 0, offsetZ))) +
      offsetY;
    const rightHeight =
      this.getHeightAt(sample.clone().add(new THREE.Vector3(offsetX, 0, 0))) +
      offsetY;

    // Create three points in local space
    const p0 = new THREE.Vector3(0, 0, 0);
    const p1 = new THREE.Vector3(0, forwardHeight - centerHeight, offsetZ);
    const p2 = new THREE.Vector3(offsetX, rightHeight - centerHeight, 0);

    // Calculate normal
    const normal = new THREE.Vector3()
      .crossVectors(p1.clone().sub(p0), p2.clone().sub(p0))
      .normalize();

    // Ensure normal points upwards
    if (normal.y < 0) normal.negate();

    // Create rotation to align up vector with normal
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      normal
    );

    // Apply rotation
    obj.quaternion.copy(quaternion);

    // Move chd to correct height
    obj.position.y = centerHeight + 2;

    // Update chd's matrix
    obj.updateMatrix();
  }

  getHeightAt(pos: THREE.Vector3) {
    const grid = this.uniforms.grid.value;
    const time = this.uniforms.time.value;

    let retVal = pos.clone();
    let ang;
    const kzx = 360.0 / grid;

    // Wave1 (135 degrees)
    ang = 50.0 * time + -1.0 * pos.x * kzx + -2.0 * pos.z * kzx;
    ang = ((ang % 360.0) * Math.PI) / 180.0;
    retVal.y = 3.0 * Math.sin(ang);

    // Wave2 (090 degrees)
    ang = 25.0 * time + -3.0 * pos.x * kzx;
    ang = ((ang % 360.0) * Math.PI) / 180.0;
    retVal.y += 2.0 * Math.sin(ang);

    // Wave3 (180 degrees)
    ang = 15.0 * time - 3.0 * pos.z * kzx;
    ang = ((ang % 360.0) * Math.PI) / 180.0;
    retVal.y += 2.0 * Math.sin(ang);

    // Wave4 (225 degrees)
    ang = 50.0 * time + 4.0 * pos.x * kzx + 8.0 * pos.z * kzx;
    ang = ((ang % 360.0) * Math.PI) / 180.0;
    retVal.y += 0.5 * Math.sin(ang);

    // Wave5 (270 degrees)
    ang = 50.0 * time + 8.0 * pos.x * kzx;
    ang = ((ang % 360.0) * Math.PI) / 180.0;
    retVal.y += 0.5 * Math.sin(ang);

    return retVal.y * this.scaleHeight;
  }

  addWeight(obj: THREE.Object3D) {
    const gridX = Math.floor((obj.position.x + this.size.w / 2) / 10);
    const gridZ = Math.floor((obj.position.z + this.size.h / 2) / 10);

    if (
      gridX >= 0 &&
      gridX < this.weightMask.length &&
      gridZ >= 0 &&
      gridZ < this.weightMask[0].length
    ) {
      this.weightMask[gridX][gridZ] = true;
    }
  }

  getScaleHeight(): number {
    return this.scaleHeight;
  }

  getSize(): Size2 {
    return this.size;
  }

  update(delta: number): void {
    const elapsedTime = this.clock.getElapsedTime();
    this.uniforms.time.value = elapsedTime;
    this.foam.update(this.weightMask);
  }

  getMesh(): THREE.Mesh {
    return this.mesh;
  }

  getFoamParticles(): THREE.Points {
    return this.foam.particles;
  }
}
