const RGB = {
    fragPars: '#define RGB( r, g, b ) vec3( float( r ) / 255.0, float( g ) / 255.0, float( b ) / 255.0 )' };
  
  
  const treeShader = {
    uniforms: THREE.UniformsLib.fog,
    vertexShader: `
      uniform vec3 mvPosition;
      varying vec2 vUv;
  
      varying float fogDepth;
  
      void main() {
        fogDepth = -mvPosition.z;
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision mediump float;
  
      ${THREE.ShaderChunk.fog_pars_fragment}
  
      varying vec2 vUv;
  
      void main() {
        //vec4 color = vec4(.0, 1. - (vUv.y * 1.6), 1. - (vUv.y * .8), 1.); // 1. - vUv.y * 2.
        vec4 color = vec4(.133, .545, .133, 1.);
        gl_FragColor = color;
        
        #ifdef USE_FOG
          #ifdef USE_LOGDEPTHBUF_EXT
            float depth = gl_FragDepthEXT / gl_FragCoord.w;
          #else
            float depth = gl_FragCoord.z / gl_FragCoord.w;
          #endif
          float fogFactor = smoothstep(fogNear, fogFar, depth);
          gl_FragColor.a = gl_FragColor.a * (1. - fogFactor);
        #endif
      }
    `,
    fog: true,
    transparent: true };
  
  const keys = {
    W: 1 << 0,
    A: 1 << 1,
    S: 1 << 2,
    D: 1 << 3,
    SPACE: 1 << 4,
    ENTER: 1 << 5,
    ESC: 1 << 6,
    SHIFT: 1 << 7,
    CTRL: 1 << 8,
    LEFT: 1 << 9,
    UP: 1 << 10,
    RIGHT: 1 << 11,
    DOWN: 1 << 12 };
  
  
  const keyCodes = {
    87: keys.W,
    65: keys.A,
    83: keys.S,
    68: keys.D,
    32: keys.SPACE,
    13: keys.ENTER,
    27: keys.ESC,
    16: keys.SHIFT,
    17: keys.CTRL,
    37: keys.LEFT,
    38: keys.UP,
    39: keys.RIGHT,
    40: keys.DOWN };
  
  
  let keysPressed = 0;
  
  const isKeyDown = keyFlag => Boolean(keysPressed & keyFlag);
  
  const onKeyDown = ({ keyCode }) => {
    const keyFlag = keyCodes[keyCode];
    keysPressed |= keyFlag;
  };
  
  const onKeyUp = ({ keyCode }) => {
    keysPressed &= ~keyCodes[keyCode];
  };
  
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('keydown', onKeyDown);
  
  const addUniformsToShader = (shader, uniforms) => ({ ...shader, uniforms: { ...shader.uniforms, ...uniforms } });
  
  const random = (min, max, round = false) => {
    const num = Math.random() * (max - min) + min;
    return round ? Math.floor(num + 1) : num;
  };
  
  
  let scene, camera, renderer;
  let playerGeometry, playerMaterial, player;
  let backgroundGeometry, backgroundMaterial, background;
  
  let time = performance.now();
  let timePlaying = 0;
  
  const trees = [];
  const treeCount = 500;
  const treeHeight = 100;
  let treePlaceInterval;
  let treePlaceLastTime = time;
  
  let score = 0;
  const scoreIncrease = 10;
  const scoreUpdateInterval = 500;
  let scoreUpdateLastTime = time;
  const scoreNodes = document.querySelectorAll('.js-score');
  
  let speed = 600;
  const speedIncrease = 3;
  let playerSpeed = 0;
  const playerAcceleration = 70;
  const playerMaxSpeed = 700;
  
  const gameStates = {
    PLAYING: 1,
    GAME_OVER: 2 };
  
  let gameState = gameStates.PLAYING;
  
  loadAssets();
  
  function init() {
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xABAEB0, 1100, 2000);
  
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.set(0, 50, 0);
  
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
  
    document.body.appendChild(renderer.domElement);
  
    window.addEventListener('resize', resize);
    attachDOMListeners();
  
    createObjects();
  
    requestAnimationFrame(update);
  }
  
  function loadAssets() {
    const loader = new THREE.JSONLoader();
    playerGeometry = loader.parse(spaceshipModel).geometry;
    init();
  }
  
  function reset() {
    hideGameOver();
  
    while (scene.children.length) {
      scene.remove(scene.children[0]);
    }
    trees.length = 0;
    score = 0;
  
    createObjects();
  
    time = performance.now();
    timePlaying = 0;
    gameState = gameStates.PLAYING;
  }
  
  function createObjects() {
    backgroundGeometry = new THREE.PlaneGeometry(100000, 1800, 1);
    const bgMaterial = new THREE.MeshPhongMaterial( {color: 0x87CEEB, side: THREE.DoubleSide, depthTest: true, fog: false} )
    background = new THREE.Mesh(backgroundGeometry, bgMaterial)
    background.position.set(0, 920, -2200)
    scene.add(background);

    groudGeom = new THREE.PlaneGeometry(100000, 1800, 1);
    const grMaterial = new THREE.MeshPhongMaterial( {color: 0x557755, side: THREE.DoubleSide, depthTest: true, fog: false} )
    ground = new THREE.Mesh(groudGeom, grMaterial)
    ground.position.set(0, -850, -2200)
    scene.add(ground)

    player = new Carrot().mesh;
    player.rotation.x += Math.PI;
    player.rotation.y += Math.PI;
    player.position.set(0, 30, -65);
    
    scene.add(player);

    const directional = new THREE.DirectionalLight(0xffffff, 1);
    directional.position.set(30, 20, -65);
    directional.castShadow = true;

    scene.add(new THREE.AmbientLight(0xc5f5f5, 1));
    scene.add(directional);
  
    createTrees();
  }
  
  function createTrees() {
    const geometry = new THREE.ConeGeometry(12, treeHeight, 4);
    const uniforms = {
      fogColor: { value: scene.fog.color },
      fogNear: { value: scene.fog.near },
      fogFar: { value: scene.fog.far } };
  
    const shader = addUniformsToShader(treeShader, uniforms);
    const material = new THREE.ShaderMaterial(shader);
    
    for (let i = 0; i < treeCount; i++) {
      const mesh = new THREE.Mesh(geometry, material);
      const scale = random(1, 2);
      mesh.scale.set(1, scale, 1);
      mesh.rotateY(Math.PI * random(0, 0.5));
      mesh.inUse = false;
      mesh.visible = false;
      trees.push(mesh);
      scene.add(mesh);
    }
  }
  
  function getTree() {
    let tree;
    let i = 0;
  
    do {
      tree = trees[i];
      i++;
    } while (tree.inUse === true && i < treeCount);
  
    return tree;
  }
  
  function placeTree() {
    const tree = getTree();
    const offsetY = treeHeight * tree.scale.y / 2;
    tree.inUse = true;
    tree.visible = true;
    tree.position.set(random(camera.position.x - 2500, camera.position.x + 2500), offsetY, -2000);
  }
  
  function removeTree(i) {
    trees[i].inUse = false;
    trees[i].visible = false;
  }
  
  function updateTrees(delta) {
    for (let i = 0; i < trees.length; i++) {
      if (!trees[i].inUse === true) continue;
      trees[i].position.z += speed * delta;
      checkCollision(trees[i].position.x, trees[i].position.z);
  
      if (trees[i].position.z > 10) {
        removeTree(i);
      }
    }
  
    if (time - treePlaceLastTime >= treePlaceInterval) {
      placeTree();
      treePlaceLastTime = time;
    }
  }
  
  function updatePlayer(delta) {
    let targetSpeed = 0;
  
    if (isKeyDown(keys.A) || isKeyDown(keys.LEFT)) {
      targetSpeed = -playerMaxSpeed;
    } else if (isKeyDown(keys.D) || isKeyDown(keys.RIGHT)) {
      targetSpeed = playerMaxSpeed;
    }
  
    if (playerSpeed < targetSpeed) {
      playerSpeed += playerAcceleration;
    } else if (playerSpeed > targetSpeed) {
      playerSpeed -= playerAcceleration;
    }
  
    player.position.x += playerSpeed * delta;
    player.rotation.z = -playerSpeed * 0.0006;
    camera.position.x = player.position.x;
    camera.updateProjectionMatrix();
  }
  
  function checkCollision(x, z) {
    if (Math.abs(player.position.z - z) < 20 && Math.abs(player.position.x - x) < 25) {
      gameState = gameStates.GAME_OVER;
      showGameOver();
    }
  }
  
  function attachDOMListeners() {
    const nodes = document.querySelectorAll('.js-play');
    Array.prototype.forEach.call(nodes, node => node.addEventListener('click', reset));
  }
  
  function updateScore() {
    if (time - scoreUpdateLastTime >= scoreUpdateInterval) {
      score += scoreIncrease;
      scoreUpdateLastTime = time;
    }
  
    Array.prototype.forEach.call(scoreNodes, node => node.innerHTML = score);
  }
  
  function showGameOver() {
    document.getElementById('gameover').style.visibility = 'visible';
  }
  
  function hideGameOver() {
    document.getElementById('gameover').style.visibility = 'hidden';
  }
  
  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  
  function update(newTime) {
    requestAnimationFrame(update);
  
    const delta = (newTime - time) / 1000;
    time = newTime;
  
    if (delta > 0.5) return;
  
    renderer.render(scene, camera);
  
    if (gameState !== gameStates.PLAYING) return;
  
    timePlaying += delta;
    speed += speedIncrease * delta;
    treePlaceInterval = 1 / speed * 40 * 1000;
  
    updateTrees(delta);
    updatePlayer(delta);
    updateScore();
  }