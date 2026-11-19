// Hero background: drifting embers and heat shimmer in a single WebGL fragment shader.
// Falls back to the CSS gradient already painted behind it.

const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';

const FRAG = `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform float uLight;

float hash(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}

// One layer of embers: each grid cell may hold a spark that rises, sways and flickers.
vec2 embers(vec2 uv, float scale, float speed, float seed, float t) {
  vec2 p = uv * scale + vec2(seed * 7.31, 0.0);
  p.y -= t * speed * scale;
  vec2 id = floor(p);
  vec2 f = fract(p) - 0.5;
  float h = hash(id + seed);
  // Offset and sway stay inside the cell so glows never get clipped at cell edges.
  vec2 off = (vec2(hash(id + seed + 11.1), hash(id + seed + 27.3)) - 0.5) * 0.24;
  off.x += sin(p.y * 2.1 + h * 6.283 + t * 0.9) * 0.08;
  float d = length(f - off);
  float r = mix(0.018, 0.05, hash(id + seed + 5.5));
  float flick = 0.55 + 0.45 * sin(t * (2.0 + h * 5.0) + h * 31.0);
  float alive = step(0.64, h);
  float core = smoothstep(r, r * 0.15, d);
  float glow = smoothstep(0.24, 0.0, d) * smoothstep(0.0, 0.05, r);
  return vec2(core, glow * glow) * flick * alive;
}

void main() {
  vec2 q = gl_FragCoord.xy / uRes;
  vec2 uv = gl_FragCoord.xy / uRes.y;
  float t = uTime;

  // Heat shimmer: warp coordinates, strongest just above the coals.
  float heatMask = smoothstep(0.8, 0.0, q.y);
  vec2 w = vec2(fbm(uv * 3.5 + vec2(0.0, -t * 0.9)), fbm(uv * 3.5 + vec2(4.1, -t * 0.8))) - 0.5;
  vec2 wuv = uv + w * 0.05 * heatMask;

  vec2 e = embers(wuv, 5.0, 0.055, 1.0, t)
         + embers(wuv, 9.0, 0.05, 7.0, t) * 0.8
         + embers(wuv, 15.0, 0.045, 13.0, t) * 0.55;
  e *= smoothstep(1.05, 0.1, q.y);

  // Glowing bed of coals along the bottom edge, rippling with the shimmer.
  float bed = fbm(vec2(wuv.x * 2.2, wuv.y * 2.6 - t * 0.3));
  float heat = smoothstep(0.42, 0.0, q.y + (bed - 0.5) * 0.28);
  heat *= 0.75 + 0.25 * sin(t * 0.9 + wuv.x * 3.0);

  // Dark theme: additive glow. Light theme: burnt sparks on paper.
  vec3 hot = vec3(1.0, 0.86, 0.6);
  vec3 ember = vec3(1.0, 0.42, 0.1);
  vec3 deep = vec3(0.6, 0.1, 0.02);
  vec3 dark = hot * e.x + ember * e.y * 0.55 + mix(deep, ember, heat) * heat * 0.6;
  float aD = clamp(max(max(dark.r, dark.g), dark.b), 0.0, 1.0);

  float aL = clamp(e.x * 0.95 + e.y * 0.3 + heat * 0.42, 0.0, 0.92);
  vec3 cL = mix(vec3(0.98, 0.55, 0.25), vec3(0.72, 0.2, 0.03), clamp(e.x * 1.4, 0.0, 1.0));

  float dither = (hash(gl_FragCoord.xy + t) - 0.5) / 255.0;
  vec4 outD = vec4(dark + dither, aD);
  vec4 outL = vec4(cL * aL + dither, aL);
  gl_FragColor = mix(outD, outL, uLight);
}`;

function shader(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return s;
}

// With KHR_parallel_shader_compile the driver builds the program off the main thread; poll until done.
function linked(gl, prog) {
  const ext = gl.getExtension('KHR_parallel_shader_compile');
  return new Promise((resolve) => {
    const check = () => {
      if (ext && !gl.getProgramParameter(prog, ext.COMPLETION_STATUS_KHR)) { setTimeout(check, 60); return; }
      resolve(gl.getProgramParameter(prog, gl.LINK_STATUS));
    };
    check();
  });
}

export async function initEmbers(hero) {
  if (!hero || hero.dataset.fx) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduce.matches) { hero.dataset.fx = 'static'; return; }

  const canvas = document.createElement('canvas');
  canvas.className = 'hero-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  // Software GL would cost more battery than the effect is worth, unless ?embers forces it for QA.
  const force = new URLSearchParams(location.search).has('embers');
  let gl = null;
  try {
    gl = canvas.getContext('webgl', {
      alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false,
      powerPreference: 'low-power', failIfMajorPerformanceCaveat: !force,
    });
  } catch { gl = null; }
  if (!gl) { hero.dataset.fx = 'static'; return; }

  const prog = gl.createProgram();
  gl.attachShader(prog, shader(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, shader(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!(await linked(gl, prog)) || reduce.matches) { hero.dataset.fx = 'static'; return; }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(prog, 'uRes');
  const uTime = gl.getUniformLocation(prog, 'uTime');
  const uLight = gl.getUniformLocation(prog, 'uLight');

  const bg = hero.querySelector('.hero-bg') || hero;
  bg.append(canvas);
  hero.dataset.fx = 'webgl';

  let light = document.documentElement.dataset.theme === 'light' ? 1 : 0;
  let target = light;
  document.addEventListener('themechange', (e) => { target = e.detail === 'light' ? 1 : 0; });

  const resize = () => {
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(hero.clientWidth * dpr));
    const h = Math.max(1, Math.round(hero.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  };
  resize();
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(hero);
  else window.addEventListener('resize', resize, { passive: true });

  let raf = 0;
  let running = false;
  let inView = true;
  let last = 0;
  let elapsed = Math.random() * 40;
  let shown = false;

  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    elapsed += Math.min(now - last, 50) / 1000;
    last = now;
    light += (target - light) * 0.08;
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, elapsed);
    gl.uniform1f(uLight, light);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!shown) { shown = true; canvas.classList.add('is-on'); }
  };
  const start = () => {
    if (running || !inView || document.hidden || reduce.matches) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };
  const stop = () => { running = false; cancelAnimationFrame(raf); };

  new IntersectionObserver(([en]) => { inView = en.isIntersecting; if (inView) start(); else stop(); }).observe(hero);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  reduce.addEventListener('change', () => {
    if (reduce.matches) { stop(); canvas.remove(); hero.dataset.fx = 'static'; }
  });
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); stop(); canvas.remove(); hero.dataset.fx = 'static'; });
  start();
}
