import {createHash} from 'node:crypto';
// Hash source geometry and pose only. Three.js UUIDs, materials, names and
// incidental metadata cannot alter identity when the same source is rebuilt.
export function canonicalSourceGeometryHash(meshes) {
 const canonical=meshes.map(mesh=>({
  position:Array.from(mesh.position),index:mesh.index?Array.from(mesh.index):null,
  matrixWorld:Array.from(mesh.matrixWorld),
  groups:(mesh.groups||[]).map(group=>({start:group.start,count:group.count,materialIndex:group.materialIndex})),
  drawRange:{start:mesh.drawRange?.start||0,count:Number.isFinite(mesh.drawRange?.count)?mesh.drawRange.count:null}
 }));
 return createHash('sha256').update(JSON.stringify({format:'position-topology-pose-v1',meshes:canonical})).digest('hex');
}
