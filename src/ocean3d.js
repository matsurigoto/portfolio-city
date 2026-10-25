import * as THREE from "three";

// 與 vertex shader 相同的波浪公式,讓小船能跟著浪起伏
export function waveHeight(x, z, t) {
  return (
    0.18 * Math.sin(x * 0.35 + t) +
    0.15 * Math.sin(z * 0.5 - t * 0.8) +
    0.08 * Math.sin((x + z) * 0.9 + t * 1.7)
  );
}

const WAVE_GLSL = /* glsl */ `
  float waveH(vec2 p, float t) {
    return 0.18 * sin(p.x * 0.35 + t) + 0.15 * sin(p.y * 0.5 - t * 0.8) + 0.08 * sin((p.x + p.y) * 0.9 + t * 1.7);
  }
`;

const vertexShader = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorld;
  varying float vH;
  ${WAVE_GLSL}
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    float h = waveH(w.xz, uTime);
    w.y += h;
    vH = h;
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uIslands[8];
  uniform int uCount;
  uniform float uRadius;
  uniform vec3 uSunDir;
  uniform vec3 uSky;
  varying vec3 vWorld;
  varying float vH;
  ${WAVE_GLSL}

  void main() {
    vec2 p = vWorld.xz;
    float e = 0.05;
    // 以高度場的偏微分求法線
    vec3 n = normalize(vec3(
      -(waveH(p + vec2(e, 0.0), uTime) - waveH(p - vec2(e, 0.0), uTime)) / (2.0 * e),
      1.0,
      -(waveH(p + vec2(0.0, e), uTime) - waveH(p - vec2(0.0, e), uTime)) / (2.0 * e)
    ));
    // 細小漣漪
    n.xz += 0.06 * vec2(sin(p.x * 3.1 + uTime * 1.4), cos(p.y * 3.7 - uTime * 1.2));
    n = normalize(n);

    // 與最近島嶼的距離,用來決定淺水色與泡沫
    float d = 1e3;
    for (int i = 0; i < 8; i++) {
      if (i >= uCount) break;
      d = min(d, length(p - uIslands[i].xy));
    }
    float shore = d - uRadius;
    float shallow = smoothstep(7.0, 0.0, shore);

    vec3 deep = vec3(0.04, 0.27, 0.55);
    vec3 mid = vec3(0.10, 0.55, 0.78);
    vec3 lagoon = vec3(0.35, 0.85, 0.85);
    vec3 col = mix(deep, mid, smoothstep(40.0, 4.0, shore));
    col = mix(col, lagoon, shallow * 0.8);

    vec3 v = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
    col = mix(col, uSky, fres * 0.55);

    vec3 hv = normalize(uSunDir + v);
    col += vec3(1.0, 0.95, 0.8) * pow(max(dot(n, hv), 0.0), 120.0) * 1.2;

    col += smoothstep(0.17, 0.3, vH) * 0.08;

    // 島嶼周圍的流動泡沫
    float ring = shore - 0.4 * sin(uTime * 1.2 + shore * 2.0);
    float foam = smoothstep(1.4, 0.0, ring) * (0.6 + 0.4 * sin(p.x * 2.0 + p.y * 2.3 + uTime * 2.0));
    col = mix(col, vec3(1.0), clamp(foam, 0.0, 1.0) * 0.85);

    // 遠景融入天空色
    float dist = length(cameraPosition - vWorld);
    col = mix(col, uSky, smoothstep(110.0, 230.0, dist));
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createSea(centers, radius, sky, sunDir) {
  const arr = Array.from({ length: 8 }, (_, i) => (centers[i] ? new THREE.Vector3(centers[i].x, centers[i].z, 0) : new THREE.Vector3()));
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uIslands: { value: arr },
      uCount: { value: Math.min(centers.length, 8) },
      uRadius: { value: radius },
      uSunDir: { value: sunDir.clone().normalize() },
      uSky: { value: new THREE.Color(sky).convertLinearToSRGB() },
    },
  });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(500, 500, 250, 250), material);
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -0.3;
  return sea;
}
