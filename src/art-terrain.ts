import * as T from "three";

export const riverCenter = (z: number) =>
  Math.sin(z / 105) * 10 + Math.sin(z / 230) * 6;
export const riverTangent = (z: number) =>
  (Math.cos(z / 105) * 10) / 105 + (Math.cos(z / 230) * 6) / 230;

/** A world-space horizontal ribbon following the same shoreline as the city. */
export function riverRibbon(left: number, right: number, height: number) {
  const positions: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  const segments = 280;
  for (let i = 0; i <= segments; i++) {
    const z = -700 + (i * 1400) / segments,
      center = riverCenter(z);
    positions.push(center + left, height, z, center + right, height, z);
    uvs.push(0, i / segments, 1, i / segments);
    if (i < segments) {
      const n = i * 2;
      indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
