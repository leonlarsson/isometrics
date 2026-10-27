import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { geometryKey, layoutKey, materialKey, meshKey } from "./instancing";

const standard = (color: string, options: THREE.MeshStandardMaterialParameters = {}) =>
	new THREE.MeshStandardMaterial({ color, ...options });

describe("drawing objects that look the same together (ADR-0086)", () => {
	it("knows three's own shapes by their parameters, and hand-built ones by the shape they're named", () => {
		expect(geometryKey(new THREE.BoxGeometry(1, 2, 3))).toBe(
			geometryKey(new THREE.BoxGeometry(1, 2, 3)),
		);
		expect(geometryKey(new THREE.BoxGeometry(1, 2, 3))).not.toBe(
			geometryKey(new THREE.BoxGeometry(1, 2, 4)),
		);
		const built = () => new THREE.BufferGeometry();
		expect(geometryKey(built())).not.toBe(geometryKey(built()));
		const named = () => {
			const geometry = built();
			geometry.userData.shareKey = "roof:1,2,3";
			return geometry;
		};
		expect(geometryKey(named())).toBe(geometryKey(named()));
	});

	it("shares materials that look the same but for their colour, and never see-through or shader ones", () => {
		expect(materialKey(standard("#ff0000"))).toBe(materialKey(standard("#ff0000")));
		// Each instance in a batch has its own colour (ADR-0092).
		expect(materialKey(standard("#ff0000"))).toBe(materialKey(standard("#00ff00")));
		expect(materialKey(standard("#ff0000"))).not.toBe(
			materialKey(standard("#ff0000", { roughness: 0.2 })),
		);
		expect(materialKey(standard("#ff0000"))).not.toBe(
			materialKey(standard("#ff0000", { emissive: "#ffffff", emissiveIntensity: 1 })),
		);
		expect(materialKey(standard("#ff0000", { transparent: true }))).toBeNull();
		expect(materialKey(new THREE.ShaderMaterial())).toBeNull();
		const custom = standard("#ff0000");
		custom.onBeforeCompile = () => {};
		expect(materialKey(custom)).toBeNull();
	});

	it("leaves out meshes marked notInstanced, with several materials, or instanced already", () => {
		const mesh = () => new THREE.Mesh(new THREE.BoxGeometry(), standard("#ff0000"));
		expect(meshKey(mesh())).toBe(meshKey(mesh()));
		const marked = mesh();
		marked.userData.notInstanced = true;
		expect(meshKey(marked)).toBeNull();
		expect(
			meshKey(new THREE.Mesh(new THREE.BoxGeometry(), [standard("#ff0000"), standard("#00ff00")])),
		).toBeNull();
		expect(
			meshKey(new THREE.InstancedMesh(new THREE.BoxGeometry(), standard("#ff0000"), 4)),
		).toBeNull();
		expect(meshKey(new THREE.Mesh(new THREE.BufferGeometry(), standard("#ff0000")))).toBeNull();
		const casting = mesh();
		casting.castShadow = true;
		expect(meshKey(casting)).not.toBe(meshKey(mesh()));
	});

	it("draws every shape with one look together, as long as their data is laid out alike (ADR-0092)", () => {
		const mesh = (geometry: THREE.BufferGeometry) => new THREE.Mesh(geometry, standard("#ff0000"));
		expect(meshKey(mesh(new THREE.BoxGeometry(1, 2, 3)))).toBe(
			meshKey(mesh(new THREE.BoxGeometry(4, 5, 6))),
		);
		expect(meshKey(mesh(new THREE.BoxGeometry()))).toBe(
			meshKey(mesh(new THREE.CylinderGeometry())),
		);
		// An icosahedron has no index: it can't share a batch with a box.
		expect(layoutKey(new THREE.IcosahedronGeometry())).not.toBe(layoutKey(new THREE.BoxGeometry()));
		expect(meshKey(mesh(new THREE.IcosahedronGeometry()))).not.toBe(
			meshKey(mesh(new THREE.BoxGeometry())),
		);
	});
});
