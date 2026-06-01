import React from "react";
import * as THREE from "three";

const FACE_ROTATIONS = {
  1: [0, 0, 0],
  2: [0, 0, Math.PI / 2],
  3: [-Math.PI / 2, 0, 0],
  4: [Math.PI / 2, 0, 0],
  5: [0, 0, -Math.PI / 2],
  6: [Math.PI, 0, 0]
};

export default class DiceScene extends React.Component {
  containerRef = React.createRef();
  frameId = null;
  renderer = null;
  scene = null;
  camera = null;
  die = null;
  shadow = null;
  clock = new THREE.Clock();
  drag = { active: false, x: 0, y: 0 };
  orbit = { yaw: 0, pitch: 0.12, radius: 5.4 };
  physics = this.createPhysics();

  componentDidMount() {
    this.createScene();
    window.addEventListener("resize", this.resize);
    this.resize();
    window.setTimeout(this.resize, 60);
    window.setTimeout(this.resize, 260);
    this.animate();
  }

  componentDidUpdate(prevProps) {
    this.resize();
    if (this.props.rolling && !prevProps.rolling) this.startRoll();
    if (this.props.result && this.props.result !== prevProps.result) this.snapToFace(this.props.result);
  }

  componentWillUnmount() {
    window.removeEventListener("resize", this.resize);
    if (this.frameId) cancelAnimationFrame(this.frameId);
    this.die?.geometry.dispose();
    const materials = Array.isArray(this.die?.material) ? this.die.material : [];
    materials.forEach((material) => {
      material.map?.dispose();
      material.dispose();
    });
    this.shadow?.geometry.dispose();
    this.shadow?.material.dispose();
    this.renderer?.dispose();
    this.renderer?.domElement?.remove();
  }

  createPhysics() {
    return {
      active: false,
      position: new THREE.Vector3(0, -0.05, 0),
      velocity: new THREE.Vector3(),
      angularVelocity: new THREE.Vector3(),
      rotation: new THREE.Euler(0.25, 0.55, 0.12),
      quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.25, 0.55, 0.12)),
      floorY: -1.15,
      radius: 0.9,
      targetRotation: new THREE.Euler(),
      snapProgress: undefined,
      settleTimer: 0
    };
  }

  createScene() {
    const container = this.containerRef.current;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#f3ebdc");
    this.scene.fog = new THREE.Fog("#f3ebdc", 11, 22);

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight("#fff8ed", 0.8));
    const key = new THREE.DirectionalLight("#fff3dc", 2.25);
    key.position.set(4, 7, 5);
    key.castShadow = true;
    this.scene.add(key);
    const red = new THREE.DirectionalLight("#b63326", 0.5);
    red.position.set(-3, 2, 4);
    this.scene.add(red);

    // BoxGeometry material order is +x, -x, +y, -y, +z, -z.
    // This maps dice values to right, left, top, bottom, front, back.
    const materials = [2, 5, 1, 6, 3, 4].map(createFaceMaterial);
    this.die = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.8, 6, 6, 6), materials);
    this.die.castShadow = true;
    this.die.receiveShadow = true;
    this.scene.add(this.die);

    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.45, 90),
      new THREE.MeshBasicMaterial({ color: "#120b06", transparent: true, opacity: 0.08, depthWrite: false })
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.set(0, this.physics.floorY + 0.01, 0);
    this.scene.add(this.shadow);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.14 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = this.physics.floorY;
    floor.receiveShadow = true;
    this.scene.add(floor);
  }

  startRoll() {
    const p = this.physics;
    p.active = true;
    p.snapProgress = undefined;
    p.settleTimer = 0;
    p.position.set((Math.random() - 0.5) * 0.45, 3.6, 1.35);
    p.velocity.set((Math.random() - 0.5) * 1.8, 6.2, -8.4);
    p.angularVelocity.set((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18);
    p.rotation.set(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);
    p.quaternion.setFromEuler(p.rotation);
  }

  snapToFace(value) {
    const target = FACE_ROTATIONS[normalizeFace(value)];
    const p = this.physics;
    p.position.set(0, p.floorY + p.radius, 0);
    p.velocity.set(0, 0, 0);
    p.angularVelocity.set(0, 0, 0);
    p.targetRotation.set(target[0], target[1], target[2]);
    p.snapProgress = 0;
    p.active = true;
  }

  updatePhysics(dt) {
    const p = this.physics;
    if (!p.active) return;

    if (p.snapProgress !== undefined) {
      p.snapProgress += dt * 4;
      const t = easeOut(Math.min(p.snapProgress, 1));
      p.rotation.x = lerp(p.rotation.x, p.targetRotation.x, t);
      p.rotation.y = lerp(p.rotation.y, p.targetRotation.y, t);
      p.rotation.z = lerp(p.rotation.z, p.targetRotation.z, t);
      p.quaternion.setFromEuler(p.rotation);
      if (p.snapProgress >= 1) p.active = false;
      return;
    }

    p.velocity.y -= 18 * dt;
    p.position.addScaledVector(p.velocity, dt);
    p.rotation.x += p.angularVelocity.x * dt;
    p.rotation.y += p.angularVelocity.y * dt;
    p.rotation.z += p.angularVelocity.z * dt;
    p.quaternion.setFromEuler(p.rotation);

    if (p.position.y <= p.floorY + p.radius) {
      p.position.y = p.floorY + p.radius;
      if (Math.abs(p.velocity.y) > 1) {
        p.velocity.y *= -0.42;
        p.velocity.x += (Math.random() - 0.5) * 1.2;
        p.velocity.z += (Math.random() - 0.5) * 1.2;
      } else {
        p.velocity.y = 0;
      }
      p.velocity.x *= 0.9;
      p.velocity.z *= 0.9;
      p.angularVelocity.multiplyScalar(0.9);

      if (p.velocity.length() < 0.07 && p.angularVelocity.length() < 0.07) {
        p.settleTimer += dt;
        if (p.settleTimer > 0.28 && this.props.rolling && !this.props.result) this.startRoll();
      } else {
        p.settleTimer = 0;
      }
    }
  }

  updateObjects() {
    if (!this.die) return;
    const p = this.physics;
    this.die.position.copy(p.position);
    this.die.quaternion.copy(p.quaternion);
    const height = Math.max(0, p.position.y - (p.floorY + p.radius));
    this.shadow.position.x = p.position.x;
    this.shadow.position.z = p.position.z;
    this.shadow.material.opacity = Math.max(0.025, 0.08 - height * 0.018);
    const scale = 1 + height * 0.18;
    this.shadow.scale.set(scale, scale, 1);
  }

  updateCamera() {
    const pitch = THREE.MathUtils.clamp(this.orbit.pitch, -0.3, 0.55);
    const x = Math.sin(this.orbit.yaw) * Math.cos(pitch) * this.orbit.radius;
    const y = 2.15 + Math.sin(pitch) * this.orbit.radius * 0.34;
    const z = Math.cos(this.orbit.yaw) * Math.cos(pitch) * this.orbit.radius;
    this.camera.position.set(x, y, z);
    this.camera.lookAt(0, -0.08, -0.15);
  }

  resize = () => {
    const container = this.containerRef.current;
    if (!container || !this.camera || !this.renderer) return;
    const rect = container.getBoundingClientRect();
    const w = Math.max(container.clientWidth, rect.width, 320);
    const h = Math.max(container.clientHeight, rect.height, 420);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  animate = () => {
    this.frameId = requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.08);
    this.updatePhysics(dt);
    this.updateObjects();
    this.updateCamera();
    this.renderer.render(this.scene, this.camera);
  };

  onPointerDown = (event) => {
    this.drag = { active: true, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  onPointerMove = (event) => {
    if (!this.drag.active) return;
    this.orbit.yaw -= (event.clientX - this.drag.x) * 0.006;
    this.orbit.pitch -= (event.clientY - this.drag.y) * 0.004;
    this.drag = { active: true, x: event.clientX, y: event.clientY };
  };

  onPointerUp = () => {
    this.drag.active = false;
  };

  render() {
    return (
      <div
        ref={this.containerRef}
        className="absolute inset-0 min-h-[420px] touch-none"
        onPointerDown={this.onPointerDown}
        onPointerMove={this.onPointerMove}
        onPointerUp={this.onPointerUp}
        style={{ cursor: this.drag.active ? "grabbing" : "grab" }}
      />
    );
  }
}

function createFaceMaterial(value) {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f8f0df";
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 3800; i++) {
    const alpha = Math.random() * 0.035;
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(45,31,20,${alpha})` : `rgba(255,255,255,${alpha})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }

  ctx.strokeStyle = "rgba(150,52,37,0.42)";
  ctx.lineWidth = 8;
  ctx.strokeRect(28, 28, size - 56, size - 56);
  ctx.strokeStyle = "rgba(25,18,13,0.12)";
  ctx.lineWidth = 3;
  ctx.strokeRect(48, 48, size - 96, size - 96);

  getPipPositions(value, size).forEach(([x, y], index) => drawInkPip(ctx, x, y, 38 + (index % 2) * 2));

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.82, metalness: 0, color: "#fff7ea" });
}

function drawInkPip(ctx, x, y, radius) {
  const bleed = ctx.createRadialGradient(x, y, radius * 0.35, x, y, radius * 1.6);
  bleed.addColorStop(0, "rgba(20,16,13,0.95)");
  bleed.addColorStop(0.58, "rgba(20,16,13,0.72)");
  bleed.addColorStop(1, "rgba(20,16,13,0)");
  ctx.fillStyle = bleed;
  ctx.beginPath();
  ctx.arc(x, y, radius * 1.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#18120e";
  ctx.beginPath();
  ctx.ellipse(0, 0, radius * 0.98, radius * 0.88, Math.random() * Math.PI, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function getPipPositions(value, size) {
  const m = size / 2;
  const o = size * 0.28;
  return {
    1: [[m, m]],
    2: [[m - o, m - o], [m + o, m + o]],
    3: [[m - o, m - o], [m, m], [m + o, m + o]],
    4: [[m - o, m - o], [m + o, m - o], [m - o, m + o], [m + o, m + o]],
    5: [[m - o, m - o], [m + o, m - o], [m, m], [m - o, m + o], [m + o, m + o]],
    6: [[m - o, m - o], [m + o, m - o], [m - o, m], [m + o, m], [m - o, m + o], [m + o, m + o]]
  }[value] || [];
}

function normalizeFace(value) {
  return Math.max(1, Math.min(6, Number(value) || 1));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeOut(t) {
  return 1 - Math.pow(1 - t, 3);
}
