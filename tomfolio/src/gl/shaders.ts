/**
 * Fullscreen shader pair for the background canvas.
 *
 * Fragment: domain-warped fbm "ink and moss" field with sparse acid-lime
 * contour filaments. Energy (scroll), mouse position and scroll velocity
 * are fed in as uniforms so the field breathes with the page.
 */

export const vertexShader = /* glsl */ `
  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const fragmentShader = /* glsl */ `
  precision highp float;

  uniform vec2  uRes;
  uniform float uTime;
  uniform vec2  uMouse;
  uniform float uMouseStrength;
  uniform float uEnergy;
  uniform float uScrollVel;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  mat2 rot(float a) {
    float s = sin(a);
    float c = cos(a);
    return mat2(c, -s, s, c);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.55;
    for (int i = 0; i < 4; i++) {
      v += amp * vnoise(p);
      p = rot(0.5) * p * 2.02;
      amp *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);

    float vel = clamp(abs(uScrollVel), 0.0, 4.0);
    float t = uTime * (0.05 + 0.09 * uEnergy) + vel * 0.012;

    float md = length(p - uMouse);
    float mouseWarp = uMouseStrength * exp(-md * 2.2);

    vec2 q = vec2(
      fbm(p + t * vec2(0.9, 0.7)),
      fbm(p + vec2(5.2, 1.3) - t * 0.6)
    );
    vec2 r = vec2(
      fbm(p + (3.0 + 1.6 * uEnergy) * q + vec2(1.7, 9.2) + t * 0.35),
      fbm(p + 3.4 * q + vec2(8.3, 2.8))
    );
    float v = fbm(p + (3.4 + mouseWarp * 2.5) * r);

    vec3 ink  = vec3(0.043, 0.043, 0.051);
    vec3 moss = vec3(0.082, 0.121, 0.094);
    vec3 fern = vec3(0.149, 0.215, 0.141);
    vec3 lime = vec3(0.784, 0.961, 0.259);

    vec3 col = mix(ink, moss, smoothstep(0.15, 0.78, v));
    col = mix(col, fern, smoothstep(0.52, 0.95, fbm(p * 1.5 + r)));

    float bands = sin(v * 24.0 + t * 2.0);
    float filament = pow(smoothstep(0.0, 0.9, 1.0 - abs(bands)), 18.0);
    float filamentAmt = filament * (0.22 + 0.78 * uEnergy) * smoothstep(0.25, 0.6, v);
    col += lime * filamentAmt * 0.85;

    col += lime * 0.10 * uMouseStrength * exp(-md * 3.0);

    float vig = smoothstep(1.5, 0.35, length(p * vec2(0.85, 1.0)));
    col *= mix(0.55, 1.0, vig);

    col += (hash(gl_FragCoord.xy + fract(uTime) * vec2(13.7, 71.3)) - 0.5) * 0.032;

    gl_FragColor = vec4(col, 1.0);
  }
`;
