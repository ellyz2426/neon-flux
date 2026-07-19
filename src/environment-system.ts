import {
  createSystem,
  Mesh,
  MeshBasicMaterial,
  BoxGeometry,
  CylinderGeometry,
  SphereGeometry,
  Vector3,
  GridHelper,
} from '@iwsdk/core';

export class EnvironmentSystem extends createSystem({}) {
  init() {
    const scene = this.world.scene;

    const gridFloor = new GridHelper(40, 40, 0x004488, 0x002244);
    gridFloor.position.y = 0;
    scene.add(gridFloor);

    const gridCeiling = new GridHelper(40, 40, 0x002244, 0x001122);
    gridCeiling.position.y = 6;
    gridCeiling.rotation.x = Math.PI;
    scene.add(gridCeiling);

    const wallMat = new MeshBasicMaterial({ color: 0x001133, transparent: true, opacity: 0.3 });

    const backWall = new Mesh(new BoxGeometry(40, 6, 0.05), wallMat);
    backWall.position.set(0, 3, -20);
    scene.add(backWall);

    const leftWall = new Mesh(new BoxGeometry(0.05, 6, 40), wallMat);
    leftWall.position.set(-20, 3, 0);
    scene.add(leftWall);

    const rightWall = new Mesh(new BoxGeometry(0.05, 6, 40), wallMat);
    rightWall.position.set(20, 3, 0);
    scene.add(rightWall);

    const edgeMat = new MeshBasicMaterial({ color: 0x0088ff });
    const edgeGeo = new BoxGeometry(0.02, 6, 0.02);

    for (const x of [-20, 20]) {
      const edge = new Mesh(edgeGeo, edgeMat);
      edge.position.set(x, 3, -20);
      scene.add(edge);
    }

    const floorEdgeGeo = new BoxGeometry(40, 0.02, 0.02);
    const floorFront = new Mesh(floorEdgeGeo, edgeMat);
    floorFront.position.set(0, 0.01, -20);
    scene.add(floorFront);

    const pillarMat = new MeshBasicMaterial({ color: 0x003366 });
    const pillarGlowMat = new MeshBasicMaterial({ color: 0x0088ff, transparent: true, opacity: 0.4 });

    const pillarPositions = [
      new Vector3(-8, 0, -15),
      new Vector3(8, 0, -15),
      new Vector3(-8, 0, -8),
      new Vector3(8, 0, -8),
    ];

    for (const pos of pillarPositions) {
      const pillar = new Mesh(new CylinderGeometry(0.15, 0.15, 6, 8), pillarMat);
      pillar.position.set(pos.x, 3, pos.z);
      scene.add(pillar);

      for (const y of [0.1, 5.9]) {
        const ring = new Mesh(new CylinderGeometry(0.2, 0.2, 0.05, 16), pillarGlowMat);
        ring.position.set(pos.x, y, pos.z);
        scene.add(ring);
      }
    }

    const orbMat = new MeshBasicMaterial({ color: 0x00ccff, transparent: true, opacity: 0.15 });
    const orbPositions = [
      new Vector3(-12, 4.5, -12),
      new Vector3(12, 4.5, -12),
      new Vector3(0, 5, -18),
      new Vector3(-6, 4, -5),
      new Vector3(6, 4, -5),
    ];

    for (const pos of orbPositions) {
      const orb = new Mesh(new SphereGeometry(0.25, 16, 16), orbMat);
      orb.position.copy(pos);
      scene.add(orb);
    }
  }

  update() {}
}
