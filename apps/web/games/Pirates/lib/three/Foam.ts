import * as THREE from 'three';
import { Sea } from './Sea';
import { lerp } from 'three/src/math/MathUtils.js';

export class Foam {
    particles: THREE.Points;
    private geometry: THREE.BufferGeometry;
    private material: THREE.PointsMaterial;
    private initialPositions: Float32Array;
    private positions: Float32Array;
    private colors: Float32Array;
    private seaRef: Sea;
    private particleCount: number;
    private lightColor: THREE.Color;
    private darkColor: THREE.Color;
    private gridSize:number;

    constructor(seaRef: Sea, particleCount: number) {
        this.seaRef = seaRef;
        this.gridSize= 10;
        this.particleCount = particleCount;
        this.lightColor = new THREE.Color(1, 1, 1); // White
        this.darkColor = new THREE.Color(0.7, 0.9, 1); // Light blue

        this.geometry = new THREE.BufferGeometry();
        this.initialPositions= new Float32Array(particleCount * 3);
        this.positions = new Float32Array(particleCount * 3);
        this.colors = new Float32Array(particleCount * 3);

        this.initParticles();

        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

        this.material = new THREE.PointsMaterial({
            size: .5,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
        });
        this.particles = new THREE.Points(this.geometry, this.material);
    }

    private initParticles() {
        const seaSize = this.seaRef.getSize();
        for (let i = 0; i < this.particleCount; i++) {
            const x = (Math.random() - 0.5) * seaSize.w;
            const z = (Math.random() - 0.5) * seaSize.h;
            const y = this.seaRef.getHeightAt(new THREE.Vector3(x, 0, z));

            this.initialPositions[i * 3] = x;
            this.initialPositions[i * 3 + 1] = y;
            this.initialPositions[i * 3 + 2] = z;
            this.positions[i * 3] = x;
            this.positions[i * 3 + 1] = y;
            this.positions[i * 3 + 2] = z;

            this.updateParticleColor(i, y);
        }
    }

    private updateParticleColor(index: number, height: number) {
        const t = (height / this.seaRef.getScaleHeight()) * 0.5 + 0.5; // Normalize height
        const color = new THREE.Color().copy(this.darkColor).lerp(this.lightColor, t);
        this.colors[index * 3] = color.r;
        this.colors[index * 3 + 1] = color.g;
        this.colors[index * 3 + 2] = color.b;
    }

    update(weightMask: boolean[][]) {
        const displacementFactor = 2;
        const heightDisplacementFactor = 1;
        const gridSize = this.gridSize;

        for (let i = 0; i < this.particleCount; i++) {
            const x = this.initialPositions[i * 3];
            const z = this.initialPositions[i * 3 + 2];

            const gridX = Math.floor((x + this.seaRef.getSize().w / 2) / gridSize);
            const gridZ = Math.floor((z + this.seaRef.getSize().h / 2) / gridSize);

            let displacementX = 0;
            let displacementZ = 0;

            // Check neighboring cells for weights and heights
            for (let dx = -1; dx <= 1; dx++) {
                for (let dz = -1; dz <= 1; dz++) {
                    const neighborX = gridX + dx;
                    const neighborZ = gridZ + dz;

                    if (neighborX >= 0 && neighborX < weightMask.length && 
                        neighborZ >= 0 && neighborZ < weightMask[0].length) {
                        
                        // Displacement based on weight
                        if (weightMask[neighborX][neighborZ]) {
                            displacementX -= dx * displacementFactor;
                            displacementZ -= dz * displacementFactor;
                        }

                        // Displacement based on height difference
                        const neighborPos = new THREE.Vector3(
                            (neighborX * gridSize) - (this.seaRef.getSize().w / 2),
                            0,
                            (neighborZ * gridSize) - (this.seaRef.getSize().h / 2)
                        );
                        const heightDiff = this.seaRef.getHeightAt(new THREE.Vector3(x, 0, z)) - this.seaRef.getHeightAt(neighborPos);
                        displacementX += dx * heightDiff * heightDisplacementFactor;
                        displacementZ += dz * heightDiff * heightDisplacementFactor;
                    }
                }
            }
            // Apply displacement
            this.positions[i * 3] = lerp(this.positions[i * 3],this.initialPositions[i* 3]+displacementX,0.01);
            this.positions[i * 3 + 2] = lerp(this.positions[i * 3+2],this.initialPositions[i*3+2]+displacementZ,0.01);

            // Update Y position based on sea height
            const newY = this.seaRef.getHeightAt(new THREE.Vector3(this.positions[i * 3], 0, this.positions[i * 3 + 2]));
            this.positions[i * 3 + 1] = newY + 1;

            // Update color
            this.updateParticleColor(i, newY);
        }

        // Update BufferGeometry attributes
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;
    }
}