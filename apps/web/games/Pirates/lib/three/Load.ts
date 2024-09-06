import { CylinderGeometry, Mesh, MeshStandardMaterial, SphereGeometry } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
export const load = async () => {
	const gltfLoader = new GLTFLoader();
	const ship = await gltfLoader.loadAsync("ship/scene.gltf");
	ship.scene.scale.set(0.05, 0.05, 0.05);
	ship.scene.rotateY(Math.PI);
	ship.scene.rotateY(Math.PI);
	ship.scene.translateX(1);
	ship.scene.updateMatrix();
	ship.scene.traverse((o) => {
		if (o instanceof Mesh) {
			o.receiveShadow = true;
			o.castShadow = true;
		}
	});
	ship.scene.name = 'ship';
	const island = new Mesh(
		new SphereGeometry(5, 50, 20).scale(4, 2, 4).translate(0, -4, 0),
		new MeshStandardMaterial({ color: 0x83ae21 })
	);
	island.name = 'island';
	island.receiveShadow = true;

	const loot = new Mesh(
		new CylinderGeometry(1, 1, 2),
		new MeshStandardMaterial({ color: 0xae8321 })
	);
	loot.name = 'loot';
	const cannonball = new Mesh(
		new SphereGeometry(1, 10, 4),
		new MeshStandardMaterial({ color: 0x222222 })
	);
	cannonball.name = 'cannonball';
	cannonball.castShadow = true;
	return { ship, island, loot, cannonball };
};
export type LoadedAssets = Awaited<ReturnType<typeof load>>;
