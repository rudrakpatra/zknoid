import { Scene, Object3D } from 'three';
import { PiratesProxy } from 'zknoid-chain-dev';

export class LootManager {
  private lootModel: Object3D = new Object3D();
  private loots: Map<string, Object3D> = new Map();

  constructor(private scene: Scene) {}

  setLootModel(model: Object3D) {
    this.lootModel = model;
  }

  update(delta: number) {
    // Update loot objects if needed
  }

  syncState(loots: Record<string, PiratesProxy.ProxyLoot>) {
    // Remove loots that are no longer in the state
    for (const [id, lootObject] of this.loots) {
      if (!loots[id]) {
        this.scene.remove(lootObject);
        this.loots.delete(id);
      }
    }

    // Update or add loots
    for (const [id, lootData] of Object.entries(loots)) {
      if (this.loots.has(id)) {
        this.updateLoot(id, lootData);
      } else {
        this.addLoot(id, lootData);
      }
    }
  }

  private updateLoot(id: string, lootData: PiratesProxy.ProxyLoot) {
    const lootObject = this.loots.get(id);
    if (lootObject) {
      lootObject.position.set(lootData.circle.x, 0, lootData.circle.y);
    }
  }

  private addLoot(id: string, lootData: PiratesProxy.ProxyLoot) {
    if (!this.lootModel) {
      console.error('Loot model not set');
      return;
    }
    const newLoot = this.lootModel.clone();
    newLoot.position.set(lootData.circle.x, 0, lootData.circle.y);
    this.scene.add(newLoot);
    this.loots.set(id, newLoot);
  }

  cleanup() {
    for (const lootObject of this.loots.values()) {
      this.scene.remove(lootObject);
    }
    this.loots.clear();
  }
}
