import {
  CylinderGeometry,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  BoxGeometry,
  Object3D,
  Group,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const loadProxy = () => {
  // Create a simple boat using primitives
  const boatGroup = new Group();

  // Hull
  const hull = new Mesh(
    new BoxGeometry(4, 1, 2),
    new MeshStandardMaterial({ color: 0x8b4513 })
  );
  hull.position.set(0, 0.5, 0);
  boatGroup.add(hull);

  // Mast
  const mast = new Mesh(
    new CylinderGeometry(0.1, 0.1, 3),
    new MeshStandardMaterial({ color: 0x8b4513 })
  );
  mast.position.set(0, 2, 0);
  boatGroup.add(mast);

  // Sail
  const sail = new Mesh(
    new BoxGeometry(0.1, 2, 1.5),
    new MeshStandardMaterial({ color: 0xffffff })
  );
  sail.position.set(0, 2, 0);
  boatGroup.add(sail);

  boatGroup.name = 'ship';
  boatGroup.userData.type = 'ship';
  boatGroup.scale.set(0.05, 0.05, 0.05);
  boatGroup.rotateY(Math.PI);
  boatGroup.translateX(1);
  boatGroup.updateMatrix();

  // Create a cuboid for loot
  const loot = new Mesh(
    new BoxGeometry(1, 1, 1),
    new MeshStandardMaterial({ color: 0xae8321 })
  );
  loot.name = 'loot';
  loot.userData.type = 'loot';

  // Create a sphere for cannonball
  const cannonball = new Mesh(
    new SphereGeometry(0.5, 16, 16),
    new MeshStandardMaterial({ color: 0x222222 })
  );
  cannonball.name = 'cannonball';
  cannonball.userData.type = 'cannonball';
  cannonball.castShadow = true;

  return { ship: boatGroup, loot, cannonball };
};

export const load = async () => {
  const gltfLoader = new GLTFLoader();
  const ship = await gltfLoader.loadAsync('ship/scene.gltf');
  ship.scene.scale.set(0.05, 0.05, 0.05);
  ship.scene.rotateY(2 * Math.PI);
  ship.scene.translateX(1);
  ship.scene.traverse((o) => {
    if (o instanceof Mesh) {
      o.translateY(2);
      o.receiveShadow = true;
      o.castShadow = true;
    }
  });
  ship.scene.userData.type = 'ship';
  ship.scene.name = 'ship';
  // const island = new Mesh(
  //   new SphereGeometry(5, 50, 20).scale(4, 2, 4).translate(0, -4, 0),
  //   new MeshStandardMaterial({ color: 0x83ae21 })
  // );
  // island.name = 'island';
  // island.receiveShadow = true;

  const loot = new Mesh(
    new CylinderGeometry(1, 1, 2),
    new MeshStandardMaterial({ color: 0xae8321 })
  );
  loot.name = 'loot';
  loot.userData.type = 'loot';
  const cannonball = new Mesh(
    new SphereGeometry(1, 10, 4),
    new MeshStandardMaterial({ color: 0x222222 })
  );
  cannonball.name = 'cannonball';
  cannonball.userData.type = 'cannonball';
  cannonball.castShadow = true;
  return { ship: ship.scene, loot, cannonball };
};

export type LoadedAssets = Awaited<ReturnType<typeof load>>;
