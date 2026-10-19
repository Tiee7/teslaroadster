// Reuse the preserved Roadster as a shared, efficient traffic variant. Gameplay
// dimensions, wheel-spin handles, lane logic and collision behavior stay exact.
(() => {
  function reducedLoft(source, rows, columns, rowStep, columnStep) {
    const grid = [], p = source.attributes.position;
    for (let row = 0; row < rows; row += rowStep) {
      const points = [];
      for (let column = 0; column < columns; column += columnStep) {
        const at = row * columns + column;
        points.push([p.getX(at),p.getY(at),p.getZ(at)]);
      }
      grid.push(points);
    }
    return createSmoothGridGeometry(grid, true);
  }
  const classicBody = reducedLoft(roadsterBodyMesh.geometry,161,81,4,2);
  const classicCanopy = reducedLoft(roadsterCanopyMesh.geometry,73,41,3,2);
  const frontCap = new THREE.BoxGeometry(1.65,.24,.08);
  const rearCap = new THREE.BoxGeometry(1.72,.56,.08);
  const lightBar = new THREE.BoxGeometry(1.14,.018,.024);
  const sideIntake = new THREE.BoxGeometry(.018,.13,.32);
  const skirt = new THREE.BoxGeometry(.035,.045,1.82);
  const baseCreate = createTrafficVehicleMesh;
  const classicVariants = new Set([0,3]);
  createTrafficVehicleMesh = function (typeIndex) {
    const car = baseCreate(typeIndex);
    const paint = sharedTrafficPaintMats[typeIndex % sharedTrafficPaintMats.length];
    const isClassic = classicVariants.has(typeIndex % 6);
    car.userData.model = isClassic ? 'classic-roadster' : (typeIndex % 2 ? 'sculpted-track' : 'sculpted-touring');
    if (isClassic) {
      const body = car.children.find(part => part.geometry === legacySupercarBodyGeo);
      const canopy = car.children.find(part => part.geometry === legacySupercarCanopyGeo);
      body.geometry = classicBody;
      canopy.geometry = classicCanopy;
      canopy.material = goldCanopyMaterial;
      const front = new THREE.Mesh(frontCap, carbonMaterial);
      front.position.set(0,.27,-2.26);
      const rear = new THREE.Mesh(rearCap,paint);
      rear.position.set(0,.565,2.24);
      const noseLight = new THREE.Mesh(lightBar,sharedTrafficHLMat);
      noseLight.position.set(0,.416,-2.307);
      car.add(front,rear,noseLight);
      // Match the preserved model's tall slit rather than the older low tailbar.
      car.children.filter(part => part.geometry === sharedTrafficTaillightGeo).forEach(part => { part.position.y = .805; part.position.z = 2.289; });
      roadsterCanopyRails.forEach(source => car.add(new THREE.Mesh(source.geometry,paint)));
    }
    // All road cars gain physical sills and dark rear-quarter intakes. Their
    // palette and touring/track aero mix remain shared, without material clones.
    [-1,1].forEach(side => {
      const sill = new THREE.Mesh(skirt,carbonMaterial);
      sill.position.set(side*.958,.17,-.02);
      const intake = new THREE.Mesh(sideIntake,carbonMaterial);
      intake.position.set(side*.98,.47,.70);
      intake.rotation.x = -.18;
      car.add(sill,intake);
    });
    if (!isClassic && typeIndex % 2 === 0) {
      // Touring cars have the factory low spoiler, track cars the tall aero wing.
      car.children.forEach(part => {
        if ([sharedTrafficWingGeo,sharedTrafficWingEndplateGeo,sharedTrafficWingStrutGeo].includes(part.geometry)) part.position.y -= .08;
      });
    }
    return car;
  };
})();
