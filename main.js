import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
// import * as dat from 'dat.gui';
// Constantes y variables globales
const clock = new THREE.Clock(); // Reloj para medir el tiempo transcurrido entre frames
let container, stats, camera, controls, scene, renderer, textureLoader; // Variables para el contenedor, estadísticas, cámara, controles, escena, renderizador y cargador de texturas
let terrainMesh, physicsWorld, transformAux1; // Malla del terreno, mundo de física y transformación auxiliar
const rigidBodies = []; // Array para almacenar cuerpos rígidos

// Parámetros del terreno
const terrainParams = {
    widthExtents: 100, // Ancho del terreno
    depthExtents: 100, // Profundidad del terreno
    width: 128, // Segmentos de ancho
    depth: 128, // Segmentos de profundidad
    maxHeight: 8, // Altura máxima del terreno
    minHeight: -2, // Altura mínima del terreno
    gridTexture: '/vite.svg', // Textura del grid
    gridSize: 1, // Tamaño del grid
    backgroundColor: 0xbfd1e5, // Color de fondo
    meshSize: 1, // Nuevo parámetro para el tamaño del grid
    showAxesHelper: false, // Nuevo parámetro para mostrar el helper de ejes
    showWireframe: false // Parámetro para mostrar el wireframe
};

// Parámetros de física
const physicsParams = {
    gravityConstant: -9.8, // Constante de gravedad
    margin: 0.05, // Margen de los objetos en el mundo de física
};

const mouseCoords = new THREE.Vector2(); // Coordenadas del ratón
const raycaster = new THREE.Raycaster(); // Raycaster para detectar interacciones con el ratón

const ballMaterialParams = {
    color: 0xff0000, // Color rojo
    transmission: 0.8, // Nivel de transparencia
    opacity: 0.8, // Opacidad
    roughness: 0.1, // Rugosidad
    metalness: 0, // Metalidad
    clearcoat: 0.25, // Clearcoat
    clearcoatRoughness: 0.1, // Rugosidad del clearcoat
    ior: 1.5, // Índice de refracción
    thickness: 2.0, // Grosor del material
};

const glassBallMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(ballMaterialParams.color),
    transmission: ballMaterialParams.transmission,
    opacity: ballMaterialParams.opacity,
    transparent: true,
    roughness: ballMaterialParams.roughness,
    metalness: ballMaterialParams.metalness,
    clearcoat: ballMaterialParams.clearcoat,
    clearcoatRoughness: ballMaterialParams.clearcoatRoughness,
    ior: ballMaterialParams.ior,
    thickness: ballMaterialParams.thickness,
});

let axesHelper = null;
let heightData = null; // Datos de altura del terreno
let ammoHeightData = null; // Datos de altura para Ammo.js
const maxNumObjects = 30; // Número máximo de objetos aleatorios

// Cargar el motor de física Ammo.js
Ammo().then((AmmoLib) => {
    Ammo = AmmoLib;
    transformAux1 = new Ammo.btTransform(); // Transformación auxiliar
    init(); // Inicializar la escena
    animate(); // Comenzar la animación
});

function init() {
    heightData = generateHeight(
        terrainParams.width,
        terrainParams.depth,
        terrainParams.minHeight,
        terrainParams.maxHeight
    ); // Generar datos de altura del terreno
    initGraphics(); // Inicializar gráficos
    initPhysics(); // Inicializar física
    createObjects(); // Crear objetos en la escena
    initInput(); // Inicializar entrada del usuario
    setupGUI(); // Configurar GUI
    updateAxesHelper(); // Actualizar el helper de ejes
}

// Inicialización de gráficos con three.js
function initGraphics() {
    container = document.getElementById('container'); // Obtener el contenedor
    container.innerHTML = ''; // Limpiar el contenedor

    // Configuración de la cámara
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000); 
    camera.position.set(0, terrainParams.maxHeight + 5, terrainParams.depthExtents / 2); 
    camera.lookAt(new THREE.Vector3(0, 0, 0)); 

    // Crear y configurar el renderizador
    renderer = new THREE.WebGLRenderer(); 
    renderer.setClearColor(terrainParams.backgroundColor); 
    renderer.setPixelRatio(window.devicePixelRatio); 
    renderer.setSize(window.innerWidth, window.innerHeight); 
    renderer.shadowMap.enabled = true; 

    // Configuración de los controles de órbita
    controls = new OrbitControls(camera, renderer.domElement); 
    controls.target.y = 2; 

    textureLoader = new THREE.TextureLoader(); // Cargador de texturas

    // Crear la escena y configurar luces, estadísticas y helper de ejes
    scene = new THREE.Scene(); 
    setupLights(); 
    setupStats(); 

    axesHelper = new THREE.AxesHelper(50); 
    scene.add(axesHelper);

    container.appendChild(renderer.domElement); // Añadir el renderizador al contenedor
    window.addEventListener('resize', onWindowResize, false); // Añadir evento de redimensionamiento
}

function setupLights() {
    const ambientLight = new THREE.AmbientLight(0x404040); 
    scene.add(ambientLight); 

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1); 
    directionalLight.position.set(-10, 10, 5); 
    directionalLight.castShadow = true; 

    const d = 10; 
    directionalLight.shadow.camera.left = -d;
    directionalLight.shadow.camera.right = d;
    directionalLight.shadow.camera.top = d;
    directionalLight.shadow.camera.bottom = -d;
    directionalLight.shadow.camera.near = 2;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.mapSize.set(1024, 1024); 
    scene.add(directionalLight); 
}

function setupStats() {
    stats = new Stats(); 
    stats.domElement.style.position = 'absolute'; 
    stats.domElement.style.top = '5px';
    stats.domElement.style.left = '5px';
    stats.domElement.style.cursor = 'move';
    stats.domElement.draggable = true; 

    stats.domElement.addEventListener('dragstart', onDragStart, false); 
    stats.domElement.addEventListener('dragend', onDragEnd, false); 

    container.appendChild(stats.domElement); 
}

function onDragStart(event) {
    event.dataTransfer.setData('text/plain', null); 
    event.dataTransfer.setDragImage(event.target, 0, 0); 
}

function onDragEnd(event) {
    stats.domElement.style.left = `${event.clientX}px`; 
    stats.domElement.style.top = `${event.clientY}px`;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight; 
    camera.updateProjectionMatrix(); 
    renderer.setSize(window.innerWidth, window.innerHeight); 
}

// Inicialización de física con Ammo.js
function initPhysics() {
    const collisionConfiguration = new Ammo.btDefaultCollisionConfiguration(); 
    const dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration); 
    const broadphase = new Ammo.btDbvtBroadphase(); 
    const solver = new Ammo.btSequentialImpulseConstraintSolver(); 

    physicsWorld = new Ammo.btDiscreteDynamicsWorld(dispatcher, broadphase, solver, collisionConfiguration); 
    physicsWorld.setGravity(new Ammo.btVector3(0, physicsParams.gravityConstant, 0)); 
}

// Crear objetos en la escena
function createObjects() {
    createTerrain(); 
    createRandomObjects(); 
}

function createTerrain() {
    const geometry = new THREE.PlaneGeometry(
        terrainParams.widthExtents,
        terrainParams.depthExtents,
        terrainParams.width - 1,
        terrainParams.depth - 1
    ); 
    geometry.rotateX(-Math.PI / 2); 

    const vertices = geometry.attributes.position.array; 
    for (let i = 0, j = 0; i < vertices.length; i++, j += 3) {
        vertices[j + 1] = heightData[i]; 
    }
    geometry.computeVertexNormals(); 

    terrainMesh = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({ color: 0xC7C7C7 })); 
    terrainMesh.receiveShadow = true; 
    terrainMesh.castShadow = true; 
    scene.add(terrainMesh); 

    updateTexture(); 
    updateTerrainMaterial(); 

    const groundShape = createTerrainShape(heightData); 
    const groundTransform = new Ammo.btTransform();
    groundTransform.setIdentity();
    groundTransform.setOrigin(new Ammo.btVector3(0, (terrainParams.maxHeight + terrainParams.minHeight) / 2, 0)); 

    const groundMass = 0; 
    const groundLocalInertia = new Ammo.btVector3(0, 0, 0); 
    const groundMotionState = new Ammo.btDefaultMotionState(groundTransform); 
    const groundBody = new Ammo.btRigidBody(new Ammo.btRigidBodyConstructionInfo(groundMass, groundMotionState, groundShape, groundLocalInertia)); 
    physicsWorld.addRigidBody(groundBody); 
}

function createRandomObjects() {
    for (let i = 0; i < maxNumObjects; i++) {
        const pos = new THREE.Vector3(Math.random(), 2 * i, Math.random()); 
        const quat = new THREE.Quaternion(); 
        createRandomObject(pos, quat, Math.ceil(Math.random() * 3)); 
    }
}

function createRandomObject(pos, quat, objectSize) {
    const objectTypes = [createSphere, createBox, createCylinder, createCone]; 
    const objectType = objectTypes[Math.floor(Math.random() * objectTypes.length)]; 

    const { threeObject, shape } = objectType(objectSize); 
    createRigidBody(threeObject, shape, objectSize * 5, pos, quat); 
}

function createSphere(size) {
    const radius = 1 + Math.random() * size; 
    const threeObject = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 20), createRandomColorObjectMaterial()); 
    const shape = new Ammo.btSphereShape(radius); 
    shape.setMargin(physicsParams.margin); 
    return { threeObject, shape }; 
}

function createBox(size) {
    const sx = 1 + Math.random() * size; 
    const sy = 1 + Math.random() * size; 
    const sz = 1 + Math.random() * size; 
    const threeObject = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz, 1, 1, 1), createRandomColorObjectMaterial()); 
    const shape = new Ammo.btBoxShape(new Ammo.btVector3(sx * 0.5, sy * 0.5, sz * 0.5)); 
    shape.setMargin(physicsParams.margin); 
    return { threeObject, shape }; 
}

function createCylinder(size) {
    const radius = 1 + Math.random() * size; 
    const height = 1 + Math.random() * size; 
    const threeObject = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 20, 1), createRandomColorObjectMaterial()); 
    const shape = new Ammo.btCylinderShape(new Ammo.btVector3(radius, height * 0.5, radius)); 
    shape.setMargin(physicsParams.margin); 
    return { threeObject, shape }; 
}

function createCone(size) {
    const radius = 1 + Math.random() * size; 
    const height = 2 + Math.random() * size; 
    const threeObject = new THREE.Mesh(new THREE.CylinderGeometry(0, radius, height, 20, 2), createRandomColorObjectMaterial()); 
    const shape = new Ammo.btConeShape(radius, height); 
    return { threeObject, shape }; 
}

function createRandomColorObjectMaterial() {
    const color = Math.floor(Math.random() * (1 << 24)); 
    return new THREE.MeshPhongMaterial({ color }); 
}

function createRigidBody(threeObject, physicsShape, mass, pos, quat) {
    threeObject.position.copy(pos); 
    threeObject.quaternion.copy(quat); 

    const transform = new Ammo.btTransform(); 
    transform.setIdentity();
    transform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z)); 
    transform.setRotation(new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w)); 
    const motionState = new Ammo.btDefaultMotionState(transform); 

    const localInertia = new Ammo.btVector3(0, 0, 0); 
    physicsShape.calculateLocalInertia(mass, localInertia); 

    const rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, physicsShape, localInertia); 
    const body = new Ammo.btRigidBody(rbInfo); 

    threeObject.userData.physicsBody = body; 

    scene.add(threeObject); 

    if (mass > 0) {
        rigidBodies.push(threeObject); 
        body.setActivationState(4); 
    }

    physicsWorld.addRigidBody(body); 

    return body; 
}

// Animar la escena
function animate() {
    requestAnimationFrame(animate); 
    render(); 
    stats.update(); 
}

// Renderizar la escena
function render() {
    const deltaTime = clock.getDelta(); 
    updatePhysics(deltaTime); 
    controls.update(deltaTime); 
    renderer.render(scene, camera); 
}

// Actualizar la simulación física
function updatePhysics(deltaTime) {
    physicsWorld.stepSimulation(deltaTime); 

    rigidBodies.forEach((objThree) => {
        const objPhys = objThree.userData.physicsBody; 
        const ms = objPhys.getMotionState(); 
        if (ms) {
            ms.getWorldTransform(transformAux1); 
            const p = transformAux1.getOrigin(); 
            const q = transformAux1.getRotation(); 
            objThree.position.set(p.x(), p.y(), p.z()); 
            objThree.quaternion.set(q.x(), q.y(), q.z(), q.w()); 
        }
    });
}

// Inicializar entrada del usuario
function initInput() {
    window.addEventListener('mousedown', (event) => {
        mouseCoords.set(
            (event.clientX / window.innerWidth) * 2 - 1,
            -(event.clientY / window.innerHeight) * 2 + 1
        ); 

        raycaster.setFromCamera(mouseCoords, camera); 

        const ballMass = 35; 
        const ballRadius = 0.4; 

        const ball = new THREE.Mesh(new THREE.SphereGeometry(ballRadius, 14, 10), glassBallMaterial); 
        ball.castShadow = true; 
        ball.receiveShadow = true; 
        const ballShape = new Ammo.btSphereShape(ballRadius); 
        ballShape.setMargin(physicsParams.margin); 
        const pos = new THREE.Vector3(); 
        const quat = new THREE.Quaternion(); 
        pos.copy(raycaster.ray.direction); 
        pos.add(raycaster.ray.origin); 
        quat.set(0, 0, 0, 1); 
        const ballBody = createRigidBody(ball, ballShape, ballMass, pos, quat); 

        pos.copy(raycaster.ray.direction); 
        pos.multiplyScalar(24); 
        ballBody.setLinearVelocity(new Ammo.btVector3(pos.x, pos.y, pos.z)); 
    }, false);
}

// Generar datos de altura para el terreno
function generateHeight(width, depth, minHeight, maxHeight) {
    const size = width * depth; 
    const data = new Float32Array(size); 

    const hRange = maxHeight - minHeight; 
    const w2 = width / 2; 
    const d2 = depth / 2; 
    const phaseMult = 12; 

    for (let i = 0; i < depth; i++) {
        for (let j = 0; j < width; j++) {
            const radius = Math.sqrt(
                Math.pow((j - w2) / w2, 2.0) +
                Math.pow((i - d2) / d2, 2.0)
            ); 

            const height = (Math.sin(radius * phaseMult) + 1) * 0.5 * hRange + minHeight; 
            data[i * width + j] = height; 
        }
    }

    return data; 
}

// Crear forma de terreno para el motor de física
function createTerrainShape(heightData) {
    const heightScale = 1; 
    const upAxis = 1; 
    const hdt = 'PHY_FLOAT'; 
    const flipQuadEdges = false; 

    ammoHeightData = Ammo._malloc(4 * terrainParams.width * terrainParams.depth); 

    for (let i = 0; i < terrainParams.depth; i++) {
        for (let j = 0; j < terrainParams.width; j++) {
            Ammo.HEAPF32[ammoHeightData + (i * terrainParams.width + j) * 4 >> 2] = heightData[i * terrainParams.width + j]; 
        }
    }

    const heightFieldShape = new Ammo.btHeightfieldTerrainShape(
        terrainParams.width,
        terrainParams.depth,
        ammoHeightData,
        heightScale,
        terrainParams.minHeight,
        terrainParams.maxHeight,
        upAxis,
        hdt,
        flipQuadEdges
    ); 

    const scaleX = terrainParams.widthExtents / (terrainParams.width - 1); 
    const scaleZ = terrainParams.depthExtents / (terrainParams.depth - 1); 
    heightFieldShape.setLocalScaling(new Ammo.btVector3(scaleX, 1, scaleZ)); 
    heightFieldShape.setMargin(physicsParams.margin); 

    return heightFieldShape; 
}

function updateTerrainPhysics() {
    const newShape = createTerrainShape(heightData);
    const groundTransform = new Ammo.btTransform();
    groundTransform.setIdentity();
    groundTransform.setOrigin(new Ammo.btVector3(0, (terrainParams.maxHeight + terrainParams.minHeight) / 2, 0));
    
    if (terrainMesh.userData.physicsBody) {
        physicsWorld.removeRigidBody(terrainMesh.userData.physicsBody);
    }

    const groundMass = 0; 
    const groundLocalInertia = new Ammo.btVector3(0, 0, 0);
    const groundMotionState = new Ammo.btDefaultMotionState(groundTransform);
    const groundBody = new Ammo.btRigidBody(new Ammo.btRigidBodyConstructionInfo(groundMass, groundMotionState, newShape, groundLocalInertia));

    terrainMesh.userData.physicsBody = groundBody; 
    physicsWorld.addRigidBody(groundBody); 
}

function updateObjectPhysics(object, newMass) {
    const physicsBody = object.userData.physicsBody;

    const transform = new Ammo.btTransform();
    physicsBody.getMotionState().getWorldTransform(transform);

    const localInertia = new Ammo.btVector3(0, 0, 0);
    physicsBody.getCollisionShape().calculateLocalInertia(newMass, localInertia);

    physicsBody.setMassProps(newMass, localInertia);
    physicsBody.updateInertiaTensor();
}

function addObject(type, size, mass) {
    const pos = new THREE.Vector3(0, terrainParams.maxHeight + 5, 0); 
    const quat = new THREE.Quaternion(); 

    let object;
    if (type === 'Sphere') {
        object = createSphere(size);
    } else if (type === 'Box') {
        object = createBox(size);
    } else if (type === 'Cone') {
        object = createCone(size);
    }

    const { threeObject, shape } = object;
    createRigidBody(threeObject, shape, mass, pos, quat);
}

function updateTerrainMaterial() {
    if (terrainParams.showWireframe) {
        terrainMesh.material = new THREE.MeshBasicMaterial({ color: 0xC7C7C7, wireframe: true });
    } else {
        const groundMaterial = new THREE.MeshPhongMaterial({ color: 0xC7C7C7 });
        terrainMesh.material = groundMaterial;
        updateTexture();
    }
    terrainMesh.material.needsUpdate = true;
}

function setupGUI() {
    const gui = new dat.GUI();

    const terrainFolder = gui.addFolder('Terrain');
    terrainFolder.add(terrainParams, 'gridTexture').name('Grid Texture').onChange(updateTexture);
    terrainFolder.add(terrainParams, 'gridSize', 1, 10).name('Grid Size Texture').onChange(updateTexture); 
    terrainFolder.addColor(terrainParams, 'backgroundColor').name('Background Color').onChange(updateBackgroundColor);
    terrainFolder.add(terrainParams, 'showAxesHelper').name('Show Axes Helper').onChange(updateAxesHelper); 
    terrainFolder.add(terrainParams, 'showWireframe').name('Show Wireframe').onChange(updateTerrainMaterial);
    terrainFolder.open();

    const ballMaterialFolder = gui.addFolder('Ball Material');
    ballMaterialFolder.addColor(ballMaterialParams, 'color').name('Color').onChange(value => {
        glassBallMaterial.color.set(value);
    });
    ballMaterialFolder.add(ballMaterialParams, 'transmission', 0, 1, 0.01).name('Transmission').onChange(value => {
        glassBallMaterial.transmission = value;
    });
    ballMaterialFolder.add(ballMaterialParams, 'opacity', 0, 1, 0.01).name('Opacity').onChange(value => {
        glassBallMaterial.opacity = value;
    });
    ballMaterialFolder.add(ballMaterialParams, 'roughness', 0, 1, 0.01).name('Roughness').onChange(value => {
        glassBallMaterial.roughness = value;
    });
    ballMaterialFolder.add(ballMaterialParams, 'metalness', 0, 1, 0.01).name('Metalness').onChange(value => {
        glassBallMaterial.metalness = value;
    });
    ballMaterialFolder.add(ballMaterialParams, 'clearcoat', 0, 1, 0.01).name('Clearcoat').onChange(value => {
        glassBallMaterial.clearcoat = value;
    });
    ballMaterialFolder.add(ballMaterialParams, 'clearcoatRoughness', 0, 1, 0.01).name('Clearcoat Roughness').onChange(value => {
        glassBallMaterial.clearcoatRoughness = value;
    });
    ballMaterialFolder.add(ballMaterialParams, 'ior', 1.0, 2.333, 0.01).name('IOR').onChange(value => {
        glassBallMaterial.ior = value;
    });
    ballMaterialFolder.add(ballMaterialParams, 'thickness', 0, 10, 0.1).name('Thickness').onChange(value => {
        glassBallMaterial.thickness = value;
    });
    ballMaterialFolder.open();

    const objectParams = {
        type: 'Sphere',
        size: 1,
        mass: 1,
        addObject: () => {
            addObject(objectParams.type, objectParams.size, objectParams.mass);
        }
    };
    const objectFolder = gui.addFolder('Add Object');
    objectFolder.add(objectParams, 'type', ['Sphere', 'Box', 'Cone']).name('Type');
    objectFolder.add(objectParams, 'size', 1, 5, 0.1).name('Size');
    objectFolder.add(objectParams, 'mass', 0.1, 10, 0.1).name('Mass');
    objectFolder.add(objectParams, 'addObject').name('Add Object');
    objectFolder.open();

    const editParams = {
        mass: 1,
        selectedObject: null,
        updatePhysics: () => {
            if (editParams.selectedObject) {
                updateObjectPhysics(editParams.selectedObject, editParams.mass);
            }
        }
    };
    const editFolder = gui.addFolder('Edit Object Physics');
    editFolder.add(editParams, 'mass', 0.1, 10, 0.1).name('Mass').onChange(() => {
        editParams.updatePhysics();
    });
    editFolder.open();
}

function updateTexture() {
    textureLoader.load(terrainParams.gridTexture, (texture) => {
        texture.wrapS = THREE.RepeatWrapping; 
        texture.wrapT = THREE.RepeatWrapping; 
        texture.repeat.set(terrainParams.gridSize * (terrainParams.widthExtents / (terrainParams.width - 1)), 
                           terrainParams.gridSize * (terrainParams.depthExtents / (terrainParams.depth - 1)));
        terrainMesh.material.map = texture; 
        terrainMesh.material.needsUpdate = true; 
    });
}


function updateBackgroundColor() {
    renderer.setClearColor(terrainParams.backgroundColor); 
}

function updateAxesHelper() {
    axesHelper.visible = terrainParams.showAxesHelper;
}
