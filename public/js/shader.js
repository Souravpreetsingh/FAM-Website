// WebGL Atmospheric Fog Shader (ANIMATION_7)
// Creates a slow-moving golden-hour atmospheric fog/mist overlay

(function(global) {
  'use strict';

  class FogShader {
    constructor(canvas, opts) {
      this.canvas = canvas;
      this.opts = Object.assign({
        opacity: 0.4,
        blendMode: 'screen',
        color1: [1.0, 0.95, 0.8],   // warm morning sun
        color2: [0.137, 0.294, 0.196] // forest green depth
      }, opts);

      this.gl = null;
      this.prog = null;
      this.mouse = { x: canvas.width / 2, y: canvas.height / 2 };
      this.running = false;
      this.rafId = null;

      this._init();
    }

    _init() {
      const canvas = this.canvas;
      this._syncSize();

      // Use ResizeObserver if available
      if (typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(() => this._syncSize()).observe(canvas);
      }

      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) return;
      this.gl = gl;

      // Vertex shader
      const vs = `attribute vec2 a_position;
varying vec2 v_texCoord;
void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

      // Fragment shader with simplex noise
      const fs = `precision highp float;
varying vec2 v_texCoord;
uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform vec3 u_color1;
uniform vec3 u_color2;

vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
           -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
  + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
    dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
    vec2 uv = v_texCoord;
    float n1 = snoise(uv * 2.0 + u_time * 0.05);
    float n2 = snoise(uv * 4.0 - u_time * 0.03);
    float noise = n1 * 0.5 + n2 * 0.25;
    vec3 finalColor = mix(u_color1, u_color2, uv.y * 0.5);
    float alpha = smoothstep(0.3, 0.8, noise) * 0.15;
    gl_FragColor = vec4(finalColor, alpha);
}`;

      const prog = gl.createProgram();
      const vsShader = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vsShader, vs);
      gl.compileShader(vsShader);
      gl.attachShader(prog, vsShader);

      const fsShader = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(fsShader, fs);
      gl.compileShader(fsShader);
      gl.attachShader(prog, fsShader);

      gl.linkProgram(prog);
      gl.useProgram(prog);
      this.prog = prog;

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

      const pos = gl.getAttribLocation(prog, 'a_position');
      gl.enableVertexAttribArray(pos);
      gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

      this.uTime = gl.getUniformLocation(prog, 'u_time');
      this.uRes = gl.getUniformLocation(prog, 'u_resolution');
      this.uMouse = gl.getUniformLocation(prog, 'u_mouse');
      this.uColor1 = gl.getUniformLocation(prog, 'u_color1');
      this.uColor2 = gl.getUniformLocation(prog, 'u_color2');

      if (this.uColor1) gl.uniform3fv(this.uColor1, new Float32Array(this.opts.color1));
      if (this.uColor2) gl.uniform3fv(this.uColor2, new Float32Array(this.opts.color2));

      // Mouse tracking
      window.addEventListener('mousemove', (event) => {
        const rect = canvas.getBoundingClientRect();
        if (rect.width && rect.height) {
          const nx = (event.clientX - rect.left) / rect.width;
          const ny = 1.0 - (event.clientY - rect.top) / rect.height;
          this.mouse.x = nx * canvas.width;
          this.mouse.y = ny * canvas.height;
        }
      });
    }

    _syncSize() {
      const canvas = this.canvas;
      const w = canvas.clientWidth || 1280;
      const h = canvas.clientHeight || 720;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    }

    start() {
      if (this.running) return;
      this.running = true;
      // Pause/resume when tab hidden/visible to free GPU/CPU for video
      this._visHandler = () => {
        if (document.hidden) this.stop();
        else if (this.running !== false) this.start();
      };
      document.addEventListener('visibilitychange', this._visHandler);
      this._render(0);
    }

    stop() {
      this.running = false;
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    }

    _render(t) {
      if (!this.running) return;
      this._syncSize();
      const gl = this.gl;
      const canvas = this.canvas;
      if (!gl || !this.prog) return;

      gl.viewport(0, 0, canvas.width, canvas.height);
      if (this.uTime) gl.uniform1f(this.uTime, t * 0.001);
      if (this.uRes) gl.uniform2f(this.uRes, canvas.width, canvas.height);
      if (this.uMouse) gl.uniform2f(this.uMouse, this.mouse.x, this.mouse.y);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      this.rafId = requestAnimationFrame((t) => this._render(t));
    }

    destroy() {
      this.stop();
      this.gl = null;
      this.prog = null;
    }
  }

  // Auto-init on elements with data-shader attribute
  function initAllShaders() {
    document.querySelectorAll('[data-shader]').forEach(el => {
      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'display:block;width:100%;height:100%';
      el.appendChild(canvas);
      const shader = new FogShader(canvas);
      shader.start();
      el._shader = shader;
    });
  }

  global.FogShader = FogShader;
  global.initFogShaders = initAllShaders;

})(window);
