// Code resource: https://tympanus.net/codrops/2023/01/25/crafting-a-dice-roller-with-three-js-and-cannon-es/

import React, { useEffect, useState, useRef } from 'react';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';


// dice animation component
function DiceRoller() {
  // Ref for the container
  const containerRef = useRef();

  const params = {
    segments : 20,
    edgeRadius : .13,
    notchRadius : .12,
    notchDepth : .12,
    numberOfDice : 5
  };

  const notchWave = (v) => {
    v = (1 / params.notchRadius) * v;
    v = Math.PI * Math.max(-1, Math.min(1, v));
    return params.notchDepth * (Math.cos(v) + 1.);
  }
  const notch = (pos) => notchWave(pos[0]) * notchWave(pos[1]);

  const createBoxGeometry = () => {

    let boxGeometry = new THREE.BoxGeometry(1, 1, 1, params.segments, params.segments, params.segments);
    const positionAttribute = boxGeometry.attributes.position; // an array of all vertices x, y, z position
    const subCubeHalfSize = .5 - params.edgeRadius;

    for (let i = 0; i < positionAttribute.count; i++) {
        let position = new THREE.Vector3().fromBufferAttribute(positionAttribute, i);
        const subCube = new THREE.Vector3(Math.sign(position.x), Math.sign(position.y), Math.sign(position.z)).multiplyScalar(subCubeHalfSize);
        const addition = new THREE.Vector3().subVectors(position, subCube);

        // create rounded corner effect
        if (Math.abs(position.x) > subCubeHalfSize && Math.abs(position.y) > subCubeHalfSize && Math.abs(position.z) > subCubeHalfSize) {
          // position is close to box vertex
          addition.normalize().multiplyScalar(params.edgeRadius);
          position = subCube.add(addition);
        } else if (Math.abs(position.x) > subCubeHalfSize && Math.abs(position.y) > subCubeHalfSize) {
          // position is close to box edge that's parallel to Z axis
          addition.z = 0;
          addition.normalize().multiplyScalar(params.edgeRadius);
          position.x = subCube.x + addition.x;
          position.y = subCube.y + addition.y;
        } else if (Math.abs(position.x) > subCubeHalfSize && Math.abs(position.z) > subCubeHalfSize) {
          // position is close to box edge that's parallel to Y axis
          addition.y = 0;
          addition.normalize().multiplyScalar(params.edgeRadius);
          position.x = subCube.x + addition.x;
          position.z = subCube.z + addition.z;
        } else if (Math.abs(position.y) > subCubeHalfSize && Math.abs(position.z) > subCubeHalfSize) {
          // position is close to box edge that's parallel to X axis
          addition.x = 0;
          addition.normalize().multiplyScalar(params.edgeRadius);
          position.y = subCube.y + addition.y;
          position.z = subCube.z + addition.z;
        }

        // create notch effect
        const offset = .23;
        if (position.y === .5) {
            position.y -= notch([position.x, position.z]);
        } else if (position.x === .5) {
            position.x -= notch([position.y + offset, position.z + offset]);
            position.x -= notch([position.y - offset, position.z - offset]);
        } else if (position.z === .5) {
            position.z -= notch([position.x - offset, position.y + offset]);
            position.z -= notch([position.x, position.y]);
            position.z -= notch([position.x + offset, position.y - offset]);
        } else if (position.z === -.5) {
            position.z += notch([position.x + offset, position.y + offset]);
            position.z += notch([position.x + offset, position.y - offset]);
            position.z += notch([position.x - offset, position.y + offset]);
            position.z += notch([position.x - offset, position.y - offset]);
        } else if (position.x === -.5) {
            position.x += notch([position.y + offset, position.z + offset]);
            position.x += notch([position.y + offset, position.z - offset]);
            position.x += notch([position.y, position.z]);
            position.x += notch([position.y - offset, position.z + offset]);
            position.x += notch([position.y - offset, position.z - offset]);
        } else if (position.y === -.5) {
            position.y += notch([position.x + offset, position.z + offset]);
            position.y += notch([position.x + offset, position.z]);
            position.y += notch([position.x + offset, position.z - offset]);
            position.y += notch([position.x - offset, position.z + offset]);
            position.y += notch([position.x - offset, position.z]);
            position.y += notch([position.x - offset, position.z - offset]);
        }
        positionAttribute.setXYZ(i, position.x, position.y, position.z);
    }

    // reset uv and norms
    boxGeometry.deleteAttribute('normal');
    boxGeometry.deleteAttribute('uv');
    boxGeometry = BufferGeometryUtils.mergeVertices(boxGeometry);
    boxGeometry.computeVertexNormals();

    return boxGeometry;
  };

  const createInnerGeometry = () => {
    // keep the plane size equal to flat surface of cube
    const baseGeometry = new THREE.PlaneGeometry(1 - 2 * params.edgeRadius, 1 - 2 * params.edgeRadius);
    // place planes a bit behind the box sides
    const offset = .48;
    // and merge them as we already have BufferGeometryUtils file loaded
    return BufferGeometryUtils.mergeGeometries([
        baseGeometry.clone().translate(0, 0, offset),
        baseGeometry.clone().translate(0, 0, -offset),
        baseGeometry.clone().rotateX(.5 * Math.PI).translate(0, -offset, 0),
        baseGeometry.clone().rotateX(.5 * Math.PI).translate(0, offset, 0),
        baseGeometry.clone().rotateY(.5 * Math.PI).translate(-offset, 0, 0),
        baseGeometry.clone().rotateY(.5 * Math.PI).translate(offset, 0, 0),
    ], false);
  };

  const createDiceMesh = () => {
    const boxMaterialOuter = new THREE.MeshBasicMaterial({
        color: 0xeaeaea,
    })
    const boxMaterialInner = new THREE.MeshStandardMaterial({
        color: 0x000000,
        roughness: 0,
        metalness: 1,
        side: THREE.DoubleSide
    })

    const diceMesh = new THREE.Group();
    const innerMesh = new THREE.Mesh(createInnerGeometry(), boxMaterialInner);
    const outerMesh = new THREE.Mesh(createBoxGeometry(), boxMaterialOuter);
    outerMesh.castShadow = true;
    diceMesh.add(innerMesh, outerMesh);

    return diceMesh;
  };

  // physic simulation modules
  const diceArray = []; // to store { mesh, body } for a pair of visible mesh and physical body

  // create a floor element in the physical world
  const createFloor = (scene, physicsWorld) => {
    // Three.js (visible) object
    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(1000, 1000),
        new THREE.ShadowMaterial({
            opacity: .1
        })
    )
    floor.receiveShadow = true;
    floor.position.y = -7;
    floor.quaternion.setFromAxisAngle(new THREE.Vector3(-1, 0, 0), Math.PI * .5);
    scene.add(floor);

    // Cannon-es (physical) object
    const floorBody = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: new CANNON.Plane(),
    });
    floorBody.position.copy(floor.position);
    floorBody.quaternion.copy(floor.quaternion);
    physicsWorld.addBody(floorBody);
  };

  // create a dice in the physical world
  const createDice = (diceMesh, scene, physicsWorld) => {
    const mesh = diceMesh.clone();
    scene.add(mesh);

    const body = new CANNON.Body({
        mass: 1,
        shape: new CANNON.Box(new CANNON.Vec3(.5, .5, .5)),
        sleepTimeLimit: .1
    });
    physicsWorld.addBody(body);

    return {mesh, body};
  };

  function throwDice() {
    diceArray.forEach((d, dIdx) => {
      // to reset the velocity dice got on the previous throw
      d.body.velocity.setZero();
      d.body.angularVelocity.setZero();

      d.body.position = new CANNON.Vec3(5, dIdx * 1.5, 0); // the floor is placed at y = -7
      d.mesh.position.copy(d.body.position);

      // set initial rotation
      d.mesh.rotation.set(2 * Math.PI * Math.random(), 0, 2 * Math.PI * Math.random())
      d.body.quaternion.copy(d.mesh.quaternion);

      // add random pulse
      const force = 3 + 5 * Math.random();
      d.body.applyImpulse(
          new CANNON.Vec3(-force, force, 0),
          new CANNON.Vec3(0, 0, .2) // point of application of force is shifted from the center of mass
      );

      d.body.allowSleep = true;
    });
  }

  function addDiceEvents(dice) {
    dice.body.addEventListener('sleep', (e) => {
      dice.body.allowSleep = false;
      const euler = new CANNON.Vec3();
      e.target.quaternion.toEuler(euler);

      const eps = .1;
      const isZero = (angle) => Math.abs(angle) < eps;
      const isHalfPi = (angle) => Math.abs(angle - .5 * Math.PI) < eps;
      const isMinusHalfPi = (angle) => Math.abs(.5 * Math.PI + angle) < eps;
      const isPiOrMinusPi = (angle) => (Math.abs(Math.PI - angle) < eps || Math.abs(Math.PI + angle) < eps);

      if (isZero(euler.z)) {
        if (isZero(euler.x)) {
          showRollResults(1);
        } 
        else if (isHalfPi(euler.x)) {
          showRollResults(4);
        }
        else if (isMinusHalfPi(euler.x)) {
          showRollResults(3);
        } 
        else if (isPiOrMinusPi(euler.x)) {
          showRollResults(6);
        }
        else {
          // landed on edge => wait to fall on side and fire the event again
          dice.body.allowSleep = true;
        }
      } 
      else if (isHalfPi(euler.z)) {
        showRollResults(2);
      } 
      else if (isMinusHalfPi(euler.z)) {
        showRollResults(5);
      } 
      else {
        // landed on edge => wait to fall on side and fire the event again
        dice.body.allowSleep = true;
      }
    });
  }

  function showRollResults(score) {
    console.log('Dice score: ' + score);
  }
  // entry of three.js scene and cannon.es physics world
  // Code will be executed once the component is mounted
  useEffect(() => {

    // create three.js scene
    const scene = new THREE.Scene();
    // renderer configuration
    const renderer = new THREE.WebGLRenderer({
      antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    // add component to dom tree
    containerRef.current.appendChild(renderer.domElement);
    // camera configuration
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, .1, 100)
    camera.position.set(0, .8, -3.5).multiplyScalar(6);
    camera.lookAt(0, -7, 0);
    // add a white ambient lighting
    const light = new THREE.AmbientLight(0xffffff, .5);
    scene.add(light);
    // add a top light for casting shadows
    const topLight = new THREE.PointLight(0xffffff, .5);
    topLight.position.set(-10, 30, 3);
    topLight.castShadow = true;
    topLight.shadow.mapSize.width = 2048;
    topLight.shadow.mapSize.height = 2048;
    topLight.shadow.camera.near = 5;
    topLight.shadow.camera.far = 400;
    scene.add(topLight);
    // configure background color
    scene.background = new THREE.Color(0xFFC0CB);
  
    // create cannon es physics world
    const physicsWorld = new CANNON.World({
      allowSleep: true,
      gravity: new CANNON.Vec3(0, -50, 0)
    });
    // set elastic coefficient
    physicsWorld.defaultContactMaterial.restitution = .3;

    // create floor in the scene
    createFloor(scene, physicsWorld);
    // create geometry dice
    const diceMesh = createDiceMesh();
    // add dice to the scene
    for (let i = 0; i < params.numberOfDice; i++) {
      diceArray.push(createDice(diceMesh, scene, physicsWorld));
      addDiceEvents(diceArray[i]);
    }

    // initialize dice
    throwDice();

    function render() {
      // recalculate the physics world
      physicsWorld.fixedStep();
      // apply recalculated values to visible elements 
      for (const dice of diceArray) {
        dice.mesh.position.copy(dice.body.position);
        dice.mesh.quaternion.copy(dice.body.quaternion);
      }
      // redraw the scene
      renderer.render(scene, camera);
      requestAnimationFrame(render);
    }
    render();

    // Clean up
    return () => {
      containerRef.current.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={containerRef}></div>;
};

export default DiceRoller;
