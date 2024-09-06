import * as THREE from 'three';
import type { Size2 } from './Utils';

export class Sea {
	private size: Size2;
	private geometry: THREE.PlaneGeometry;
	private material: THREE.MeshStandardMaterial;
	private seaMesh: THREE.Mesh;
	private waterNormalMap: THREE.Texture | null;
	private clock: THREE.Clock;
	private uniforms: {
		time: { value: number };
		grid: { value: number };
	};
	private scaleHeight = .8;

	constructor(size: Size2) {
		this.size = size;
		this.waterNormalMap = null;
		this.clock = new THREE.Clock();
		this.geometry = new THREE.PlaneGeometry(this.size.w, this.size.h, 200, 200);
		this.geometry.rotateX(-Math.PI * 0.5);
		this.uniforms = {
			time: { value: 0 },
			grid: { value: this.size.w / 2 }
		};
		this.material = this.createSeaMaterial();
		this.seaMesh = new THREE.Mesh(this.geometry, this.material);
		this.seaMesh.scale.setY(this.scaleHeight);
	}
	private createSeaMaterial(): THREE.MeshStandardMaterial {
		const material = new THREE.MeshStandardMaterial({
			color: 0x0088aa,
			roughness: 1
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

		// Sample heights at three points
		const centerHeight = this.getHeightAt(obj.position) + offsetY;
		const forwardHeight =
			this.getHeightAt(obj.position.clone().add(new THREE.Vector3(0, 0, offsetZ))) + offsetY;
		const rightHeight =
			this.getHeightAt(obj.position.clone().add(new THREE.Vector3(offsetX, 0, 0))) + offsetY;

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
		obj.position.y = centerHeight;

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

	mesh(): THREE.Mesh {
		return this.seaMesh;
	}

	update(): void {
		const elapsedTime = this.clock.getElapsedTime();
		this.uniforms.time.value = elapsedTime;

		// if (this.waterNormalMap) {
		// 	this.waterNormalMap.offset.x -= 0.0005;
		// 	this.waterNormalMap.offset.y += 0.00025;
		// }
	}
}
