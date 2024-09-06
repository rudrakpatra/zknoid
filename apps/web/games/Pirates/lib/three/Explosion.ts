import {
    BufferGeometry,
    Color,
    Float32BufferAttribute,
    Points,
    PointsMaterial,
    Vector3
  } from 'three';
  
  export class Explosion {
    particles: Points;
    velocities: Vector3[];
    geometry: BufferGeometry;
    material: PointsMaterial;
    lifespan: number;
  
    constructor(position: Vector3, particleCount: number = 1000,spread: number = 5, size: number = .3, lifespan: number = 2) {
      this.lifespan = lifespan;
      this.geometry = new BufferGeometry();
      this.material = new PointsMaterial({
        color: 0xffaa00,
        size: size,
        transparent: true,
        blending: 1,
        depthWrite: false
      });
  
      const positions = new Float32Array(particleCount * 3);
      const colors = new Float32Array(particleCount * 3);
      this.velocities = [];
      
      const spreadVector=new Vector3(spread,spread,spread);

      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        const radius = (Math.random()*.5+0.5);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
  
        positions[i3] = position.x + radius * Math.sin(phi) * Math.cos(theta);
        positions[i3 + 1] = position.y + radius * Math.sin(phi) * Math.sin(theta);
        positions[i3 + 2] = position.z + radius * Math.cos(phi);
  
        colors[i3] = 1;
        colors[i3 + 1] = 0.5 + 0.5 * Math.random();
        colors[i3 + 2] = 0.5 * Math.random();
        this.velocities.push(new Vector3(
          (Math.random() - 0.5) ,
          (Math.random() - 0.5) ,
          (Math.random() - 0.5)
        ).normalize().multiply(spreadVector));
      }
  
      this.geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
      this.geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  
      this.particles = new Points(this.geometry, this.material);
    }
  
    update(delta: number) {
      const positions = this.geometry.attributes.position.array as Float32Array;
      const colors = this.geometry.attributes.color.array as Float32Array;
  
      for (let i = 0; i < positions.length; i += 3) {
        positions[i] += this.velocities[i/3].x * delta;
        positions[i + 1] += this.velocities[i/3].y * delta;
        positions[i + 2] += this.velocities[i/3].z * delta;
  
        colors[i + 1] *= 0.9;
        colors[i + 2] *= 0.9;
      }
  
      this.geometry.attributes.position.needsUpdate = true;
      this.geometry.attributes.color.needsUpdate = true;
  
      this.lifespan -= delta;
      this.material.opacity = Math.max(0, this.lifespan / 2);
  
      return this.lifespan > 0;
    }
  }