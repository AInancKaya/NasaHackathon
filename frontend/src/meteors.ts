// AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
// Reviewed and directed by the project author.
import type * as THREE_NS from "three";

type Three = typeof THREE_NS;

/**
 * Decoration only: an occasional shooting star streaks across the sky behind the globe.
 * The streak hangs off the camera far behind the globe, so the Earth hides it by depth testing.
 * Returns a stop function. Does nothing when the user prefers reduced motion.
 */
export function startMeteors(THREE: Three, scene: THREE_NS.Scene, camera: THREE_NS.PerspectiveCamera): () => void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};

  const DEPTH = 2000; // well behind the globe (camera sits a few hundred units from it)
  const pos = new Float32Array(9); // tapered triangle: tail point + two head corners
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  // tail fades out: vertex 0 is the tail, vertices 1-2 the bright head
  geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 1, 1, 1, 1, 1]), 3));
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const line = new THREE.Mesh(geo, mat);
  line.frustumCulled = false;
  line.visible = false;
  camera.add(line);
  if (!camera.parent) scene.add(camera); // camera children only render when the camera is in the scene

  let raf = 0;
  let timer = 0;
  const schedule = () => {
    timer = window.setTimeout(fire, 5000 + Math.random() * 9000);
  };

  function fire() {
    const halfH = DEPTH * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const halfW = halfH * camera.aspect;
    const x0 = (Math.random() * 1.6 - 0.8) * halfW;
    const y0 = (0.3 + Math.random() * 0.6) * halfH;
    const angle = THREE.MathUtils.degToRad(20 + Math.random() * 25); // below the horizontal
    const dx = -Math.sign(x0 || 1) * Math.cos(angle); // head towards the middle of the sky
    const dy = -Math.sin(angle);
    const travel = halfH * (0.6 + Math.random() * 0.5);
    const tail = halfH * 0.18;
    const w = halfH * 0.004; // head width, about 2 px
    const ms = 700 + Math.random() * 500;
    const t0 = performance.now();
    line.visible = true;

    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      const hx = x0 + dx * travel * k;
      const hy = y0 + dy * travel * k;
      const len = tail * Math.sin(Math.PI * k); // grows, then shrinks as it burns out
      pos.set([hx - dx * len, hy - dy * len, -DEPTH, hx - dy * w, hy + dx * w, -DEPTH, hx + dy * w, hy - dx * w, -DEPTH]);
      geo.attributes.position.needsUpdate = true;
      mat.opacity = Math.sin(Math.PI * k);
      if (k < 1) raf = requestAnimationFrame(step);
      else {
        line.visible = false;
        schedule();
      }
    };
    raf = requestAnimationFrame(step);
  }

  schedule();
  return () => {
    clearTimeout(timer);
    cancelAnimationFrame(raf);
    camera.remove(line);
    geo.dispose();
    mat.dispose();
  };
}
