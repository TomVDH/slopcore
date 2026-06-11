/**
 * TT2000 liquid chrome.
 *
 * Algorithmic philosophy: mercury under studio lights. A handful of
 * metaballs share one implicit field; where the field crosses its
 * threshold a surface exists, and its normal is read straight from the
 * field gradient. The surface reflects a two-tone studio sky with a
 * hard horizon, which is the whole trick of chrome: not color, just a
 * world to mirror. One blob is leashed to the cursor; a magenta rim
 * burns where the surface turns away. Springy, glossy, era-correct.
 */

export const y2kFrag = /* glsl */ `
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

  // Metaball field: five drifters plus one leashed to the cursor.
  float field(vec2 p, float t) {
    float f = 0.0;

    vec2 b1 = vec2(0.42 * sin(t * 0.31), 0.30 * cos(t * 0.23));
    vec2 b2 = vec2(0.55 * cos(t * 0.17 + 2.0), 0.38 * sin(t * 0.27 + 1.0));
    vec2 b3 = vec2(0.30 * sin(t * 0.41 + 4.0), 0.45 * cos(t * 0.19 + 3.0));
    vec2 b4 = vec2(0.62 * cos(t * 0.13 + 5.0), 0.22 * sin(t * 0.37 + 2.5));
    vec2 b5 = vec2(0.18 * sin(t * 0.29 + 1.5), 0.55 * cos(t * 0.11 + 0.5));

    f += 0.055 / max(dot(p - b1, p - b1), 1e-4);
    f += 0.045 / max(dot(p - b2, p - b2), 1e-4);
    f += 0.038 / max(dot(p - b3, p - b3), 1e-4);
    f += 0.030 / max(dot(p - b4, p - b4), 1e-4);
    f += 0.034 / max(dot(p - b5, p - b5), 1e-4);

    // The leashed blob: swells while the cursor moves.
    vec2 bm = uMouse * 0.85;
    f += (0.018 + 0.05 * uMouseStrength) / max(dot(p - bm, p - bm), 1e-4);

    return f;
  }

  // Studio sky: bright dome, hard horizon, dark floor.
  vec3 studio(float y) {
    vec3 sky    = vec3(0.95, 0.97, 1.0);
    vec3 haze   = vec3(0.62, 0.65, 0.72);
    vec3 floorc = vec3(0.13, 0.13, 0.16);
    float horizon = smoothstep(-0.04, 0.04, y);
    vec3 below = mix(floorc, haze * 0.5, clamp(-y, 0.0, 1.0));
    vec3 above = mix(haze, sky, clamp(y * 1.6, 0.0, 1.0));
    return mix(below, above, horizon);
  }

  void main() {
    vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);
    float vel = clamp(abs(uScrollVel), 0.0, 4.0);
    float t = uTime * (0.5 + 0.4 * uEnergy) + vel * 0.02;

    vec3 void_ = vec3(0.031, 0.031, 0.043);
    vec3 magenta = vec3(1.0, 0.239, 0.682);

    // Background: a faint magenta haze low in the void.
    vec3 col = void_;
    col += magenta * 0.045 * exp(-(p.y + 0.9) * (p.y + 0.9) * 2.0);

    // The blob mass rides high so the headline sits over its dark
    // floor-facing half, not the bright dome.
    vec2 pb = p - vec2(0.0, 0.34);
    float thr = 1.05;
    float f = field(pb, t);

    // Surface normal straight from the field gradient.
    float e = 0.004;
    float fx = field(pb + vec2(e, 0.0), t) - f;
    float fy = field(pb + vec2(0.0, e), t) - f;
    vec3 n = normalize(vec3(-fx, -fy, e * 2.2));

    float aa = 6.0 / min(uRes.x, uRes.y);
    float surf = smoothstep(thr - aa * 14.0, thr + aa * 14.0, f);

    // Chrome: mirror the studio along the bent normal.
    vec3 chrome = studio(n.y * 1.4 + p.y * 0.2);

    // Posterize a touch: liquid metal banding.
    chrome = floor(chrome * 7.0 + 0.5) / 7.0;

    // Specular bite from the dome light.
    float spec = pow(max(dot(n, normalize(vec3(0.4, 0.75, 0.5))), 0.0), 24.0);
    chrome += vec3(1.0) * spec * 0.55;

    // Magenta rim where the surface turns away from the eye.
    float rim = pow(1.0 - clamp(n.z, 0.0, 1.0), 2.2);
    chrome += magenta * rim * (0.35 + 0.35 * uEnergy);

    col = mix(col, chrome, surf);

    // A breath of glow just outside the surface.
    float nearSurf = smoothstep(thr * 0.6, thr, f) * (1.0 - surf);
    col += magenta * nearSurf * 0.10;

    float vig = smoothstep(1.8, 0.5, length(p * vec2(0.85, 1.0)));
    col *= mix(0.62, 1.0, vig);
    col += (hash(gl_FragCoord.xy + fract(uTime) * vec2(13.7, 71.3)) - 0.5) * 0.025;

    gl_FragColor = vec4(col, 1.0);
  }
`;
