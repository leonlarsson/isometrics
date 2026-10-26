// Render lab: `three` for the WebGPU build, with the WebGL-only classes still there for libraries
// that import them. Both builds share three.core.js, so classes stay single instances.

export * from "../../node_modules/three/build/three.module.js";
export * from "../../node_modules/three/build/three.webgpu.js";
export { PMREMGenerator } from "../../node_modules/three/build/three.webgpu.js";
