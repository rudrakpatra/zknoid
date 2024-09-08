export class Vec2 {
  constructor(
    public x: number,
    public y: number
  ) {}

  add(other: Vec2): Vec2 {
    return new Vec2(this.x + other.x, this.y + other.y);
  }

  subtract(other: Vec2): Vec2 {
    return new Vec2(this.x - other.x, this.y - other.y);
  }

  mod(v: number): Vec2 {
    return new Vec2((this.x + v) % v, (this.y + v) % v);
  }

  scale(scalar: number): Vec2 {
    return new Vec2(this.x * scalar, this.y * scalar);
  }

  magnitude(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  normalize(): Vec2 {
    const mag = this.magnitude();
    return mag === 0 ? new Vec2(0, 0) : this.scale(1 / mag);
  }

  rotate(angle: number): Vec2 {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return new Vec2(this.x * cos - this.y * sin, this.x * sin + this.y * cos);
  }

  distanceTo(other: Vec2): number {
    return this.subtract(other).magnitude();
  }
}
export class Size2 {
  constructor(
    public w: number,
    public h: number
  ) {}
  contains(size: Size2) {
    return this.w <= size.w && this.h <= size.h;
  }
}
