// Global post-processing: bloom + halation, chromatic aberration, tone shoulder,
// film grain, vignette, fades/flash, and the 2000s hardware: CRT raster, VHS, 4:3 box, degauss, power.
// Operates on the composited HDR (linear) frame.
import * as THREE from 'three';
import { FSPass, makeRT, W, H, SCALE } from './gl';

/** The tone shoulder (linear HDR -> 0..1 linear), shared with the engine's sampling error estimate. */
export const SHOULDER_GLSL = /* glsl */ `
vec3 shoulder(vec3 x) {
  // identity below k, smooth exponential shoulder above; very bright values desaturate toward white
  const float k = 0.72;
  vec3 y = mix(x, k + (1.0 - k) * (1.0 - exp(-(x - k) / (1.0 - k))), step(k, x));
  float over = max(max(x.r, x.g), x.b);
  return mix(y, vec3(1.0), smoothstep(2.0, 12.0, over) * 0.85);
}`;

export interface PostParams {
  exposure: number;
  bloom: number; // bloom strength
  bloomThreshold: number; // linear luminance where bloom starts
  bloomKnee: number; // soft knee width
  bloomRadius: number; // 0..1 upsample spread
  halation: number; // red-orange film halation around highlights
  ca: number; // chromatic aberration in px at the frame edge
  grain: number; // grain amplitude (sRGB units), ~0.04-0.1
  vignette: number; // 0..1
  hud: number; // HUD opacity multiplier (crop marks, readout)
  /** 0..1: the crop-mark frame (1 = in place, 0 = flown out past the edges). Unused by this video. */
  frame: number;
  /** Opacity of the HUD's corner readout (the fork's; unused by this video). */
  pdoom: number;
  /** 0..1: the frame is light (bone paper) — the HUD switches captions and crop marks to ink. */
  paper: number;
  fade: number; // fade to black 0..1
  flash: number; // additive bone-white flash 0..1+
  shake: [number, number]; // frame offset in px
  zoom: number; // frame zoom (1 = none), for punch-ins on hits
  invert: number; // 0..1 invert (ink <-> bone), applied before grain
  /** Replace the HUD readout's digits (unused). */
  pdoomText?: string;
  /** 0..1 glitch the HUD readout. */
  hudCorruption?: number;
  // --- 2000s hardware (docs/DESIGN.md, Look). All at their defaults = off, so a plain frame is unchanged.
  /** 0..1: CRT raster: scanlines (beam spread with brightness), slot mask, tube curvature (scaled by `curve`). */
  crt: number;
  /** Tube curvature at crt = 1 (0 = flat glass). */
  curve: number;
  /** 0..1: VHS playback: line jitter, a drifting tracking band, head-switching skew at the bottom, chroma smear. */
  vhs: number;
  /** 0..1: a 4:3 box (1 = pillarboxed to 1440x1080, 0 = full-bleed). Unused by this video. */
  box: number;
  /** 0..1: the degauss: raster wobble, a colour-purity swirl in nixie/ember, brightness surge. */
  degauss: number;
  /** CRT power: 1 = on; below 1 the picture collapses to a line (0.5) and a dot (0.15); 0 = off. */
  power: number;
  /** 0..1: the cold grade (Act II): the near-neutral image shifts toward a cold blue-grey; saturated light (nixie, phosphor) keeps its colour. */
  cold: number;
}

export const DEFAULT_POST: PostParams = {
  exposure: 1,
  bloom: 0.55,
  bloomThreshold: 0.85,
  bloomKnee: 0.5,
  bloomRadius: 0.75,
  halation: 0.25,
  ca: 1.2,
  grain: 0.055,
  vignette: 0.35,
  hud: 1,
  frame: 0,
  pdoom: 0,
  paper: 0,
  fade: 0,
  flash: 0,
  shake: [0, 0],
  zoom: 1,
  invert: 0,
  crt: 0,
  curve: 0.12,
  vhs: 0,
  box: 0,
  degauss: 0,
  power: 1,
  cold: 0,
};

const MIPS = 7;

export class Post {
  private prefilter: FSPass;
  private down: FSPass;
  private up: FSPass;
  private final: FSPass;
  private mips: THREE.WebGLRenderTarget[] = [];
  private ups: THREE.WebGLRenderTarget[] = [];

  constructor() {
    // the bloom pyramid stays at the logical resolution at every output scale (same radii, same look)
    let w = W >> 1, h = H >> 1;
    for (let i = 0; i < MIPS; i++) {
      this.mips.push(makeRT(Math.max(2, w), Math.max(2, h), { depthBuffer: false, pxScale: 1 }));
      this.ups.push(makeRT(Math.max(2, w), Math.max(2, h), { depthBuffer: false, pxScale: 1 }));
      w >>= 1; h >>= 1;
    }
    this.prefilter = new FSPass(/* glsl */ `
      uniform sampler2D src; uniform vec2 texel; uniform float threshold, knee;
      void main() {
        // 4-tap box downsample + soft threshold on luminance
        vec3 c = vec3(0.0);
${SCALE === 1 ? `        c += texture(src, vUv + texel * vec2(-1, -1)).rgb; c += texture(src, vUv + texel * vec2(1, -1)).rgb;
        c += texture(src, vUv + texel * vec2(-1, 1)).rgb;  c += texture(src, vUv + texel * vec2(1, 1)).rgb;
        c *= 0.25;` : `        // output scale > 1: the same 4x4-logical-px box from a SCALE x larger source, as 2x2-texel bilinear taps
        const int N = ${SCALE * 2};
        for (int j = 0; j < N; j++) for (int i = 0; i < N; i++)
          c += texture(src, vUv + texel * (vec2(float(i), float(j)) * 2.0 - float(N - 1)) / PX_SCALE).rgb;
        c /= float(N * N);`}
        c = min(c, vec3(40.0));
        float l = max(c.r, max(c.g, c.b));
        float rq = clamp(l - threshold + knee, 0.0, 2.0 * knee);
        rq = rq * rq / (4.0 * knee + 1e-5);
        float w = max(rq, l - threshold) / max(l, 1e-5);
        fragColor = vec4(c * w, 1.0);
      }`, { src: { value: null }, texel: { value: new THREE.Vector2() }, threshold: { value: 1 }, knee: { value: 0.5 } });
    this.down = new FSPass(/* glsl */ `
      uniform sampler2D src; uniform vec2 texel;
      void main() {
        // 13-tap downsample (Jimenez 2014)
        vec3 a = texture(src, vUv + texel * vec2(-2, -2)).rgb, b = texture(src, vUv + texel * vec2(0, -2)).rgb, c = texture(src, vUv + texel * vec2(2, -2)).rgb;
        vec3 d = texture(src, vUv + texel * vec2(-1, -1)).rgb, e = texture(src, vUv + texel * vec2(1, -1)).rgb;
        vec3 f = texture(src, vUv + texel * vec2(-2, 0)).rgb, g = texture(src, vUv).rgb, h = texture(src, vUv + texel * vec2(2, 0)).rgb;
        vec3 i = texture(src, vUv + texel * vec2(-1, 1)).rgb, j = texture(src, vUv + texel * vec2(1, 1)).rgb;
        vec3 k = texture(src, vUv + texel * vec2(-2, 2)).rgb, l = texture(src, vUv + texel * vec2(0, 2)).rgb, m = texture(src, vUv + texel * vec2(2, 2)).rgb;
        vec3 o = (d + e + i + j) * 0.125 + (a + b + g + f) * 0.03125 + (b + c + h + g) * 0.03125 + (f + g + l + k) * 0.03125 + (g + h + m + l) * 0.03125;
        fragColor = vec4(o, 1.0);
      }`, { src: { value: null }, texel: { value: new THREE.Vector2() } });
    this.up = new FSPass(/* glsl */ `
      uniform sampler2D src; uniform sampler2D prev; uniform vec2 texel; uniform float radius;
      void main() {
        // 9-tap tent upsample of the smaller level, added to this level
        vec2 o = texel * radius;
        vec3 s = texture(src, vUv - o).rgb + 2.0 * texture(src, vUv + vec2(0, -o.y)).rgb + texture(src, vUv + vec2(o.x, -o.y)).rgb
          + 2.0 * texture(src, vUv + vec2(-o.x, 0)).rgb + 4.0 * texture(src, vUv).rgb + 2.0 * texture(src, vUv + vec2(o.x, 0)).rgb
          + texture(src, vUv + vec2(-o.x, o.y)).rgb + 2.0 * texture(src, vUv + vec2(0, o.y)).rgb + texture(src, vUv + o).rgb;
        fragColor = vec4(texture(prev, vUv).rgb + s / 16.0, 1.0);
      }`, { src: { value: null }, prev: { value: null }, texel: { value: new THREE.Vector2() }, radius: { value: 1 } });
    this.final = new FSPass(/* glsl */ `
      uniform sampler2D src; uniform sampler2D bloomTex; uniform sampler2D haloTex; uniform sampler2D hudTex;
      uniform float exposure, bloom, halation, ca, grain, vignette, hud, fade, flash, time, zoom, invert;
      uniform float crt, curve, vhs, box, degauss, power, cold, frame;
      uniform vec2 shake; uniform vec2 res;
      ${SHOULDER_GLSL}
      // the CRT's raster collapsing when it powers down: (horizontal, vertical) extent of the picture
      vec2 powerScale(float p) {
        return vec2(mix(0.004, 1.0, smoothstep(0.15, 0.5, p)), mix(0.0035, 1.0, smoothstep(0.5, 1.0, p)));
      }
      void main() {
        // tube curvature: screen point -> raster position (outside [0,1] is the bezel)
        vec2 asp = vec2(res.x / res.y, 1.0);
        vec2 cc = vUv - 0.5;
        float kc = curve * crt;
        vec2 ras = 0.5 + cc * (1.0 + kc * dot(cc * asp, cc * asp) * 0.5);
        vec2 bz = smoothstep(vec2(0.0), vec2(0.004), ras) * smoothstep(vec2(1.0), vec2(0.996), ras);
        float bezel = kc > 0.0 ? bz.x * bz.y : 1.0;
        // power: the picture is squeezed into the collapsing raster
        vec2 ps = powerScale(power);
        vec2 dr = ras - 0.5;
        vec2 pm2 = smoothstep(ps * 0.5 + 0.6 / res, ps * 0.5 - 0.6 / res, abs(dr));
        float pmask = power >= 1.0 ? 1.0 : pm2.x * pm2.y;
        vec2 pic = 0.5 + dr / ps;
        // VHS: per-line jitter, a tracking band drifting up the frame, head-switching skew in the last lines
        float line = floor(pic.y * ${H}.0);
        float jit = (hash12(vec2(line, frame)) - 0.5) * 0.9;
        float yb = fract(0.15 + frame * 0.0021);
        float band = exp(-pow((pic.y - yb) / 0.018, 2.0));
        jit += band * (hash12(vec2(line * 3.1, frame + 7.0)) - 0.5) * 24.0;
        jit += smoothstep(0.022, 0.0, pic.y) * (18.0 + 10.0 * hash12(vec2(frame, 3.0)));
        pic.x += jit * vhs / ${W}.0;
        // degauss: the raster wobbles
        pic.x += sin(pic.y * 38.0 + time * 31.0) * 0.007 * degauss;
        pic.y += sin(pic.x * 21.0 - time * 23.0) * 0.004 * degauss;
        vec2 uv = (pic - 0.5) / zoom + 0.5 - shake / res;
        vec2 dc = uv - 0.5;
        float r2 = dot(dc * asp, dc * asp);
        vec2 off = dc * r2 * ca / res.x * 4.0;
        vec3 col;
        col.r = texture(src, uv + off).r;
        col.g = texture(src, uv).g;
        col.b = texture(src, uv - off).b;
        if (vhs > 0.0) {
          // chroma smear: colour from a horizontal blur, luminance from the sharp sample
          vec2 hs = vec2(3.0 * vhs / res.x, 0.0);
          vec3 bl5 = (texture(src, uv - 2.0 * hs).rgb + texture(src, uv - hs).rgb + texture(src, uv).rgb
            + texture(src, uv + hs).rgb + texture(src, uv + 2.0 * hs).rgb) / 5.0;
          col = max(vec3(luma(col)) + (bl5 - vec3(luma(bl5))) * vhs + (col - vec3(luma(col))) * (1.0 - vhs), 0.0);
          // the tracking band's white noise streaks
          col += C_BONE * band * step(0.93, hash12(vec2(floor(uv.x * 220.0), line + frame))) * 0.5 * vhs;
        }
        vec3 bl = texture(bloomTex, uv).rgb;
        vec3 ha = texture(haloTex, uv).rgb;
        col += bl * bloom;
        col += vec3(1.0, 0.18, 0.04) * luma(ha) * halation;
        col *= exposure;
        // the cold grade: the near-neutral image toward the blue-grey, luminance kept; saturated
        // light (the nixie orange, the phosphor green) keeps its colour
        float mx = max(col.r, max(col.g, col.b));
        float satur = clamp(((mx - min(col.r, min(col.g, col.b))) / max(mx, 1e-3) - 0.35) * 2.5, 0.0, 1.0);
        vec3 graded = mix(vec3(luma(col)), luma(col) * C_COLD / luma(C_COLD), 0.65);
        col = mix(col, graded, cold * (1.0 - satur));
        // degauss: colour-purity swirl (in palette: nixie/ember) and a surge
        if (degauss > 0.0) {
          float ang = atan(dc.y, dc.x);
          float sw = 0.5 + 0.5 * sin(ang * 3.0 + length(dc) * 14.0 - time * 9.0);
          vec3 tint = mix(C_NIXIE, C_EMBER, sw) / luma(mix(C_NIXIE, C_EMBER, sw));
          col = mix(col, col * tint * (1.0 + 0.8 * degauss) + tint * 0.06, degauss * 0.7);
        }
        // HUD is composited in linear space before the shoulder so it gets grain & vignette too
        vec4 h = texture(hudTex, vUv);
        col = mix(col, h.rgb / max(h.a, 1e-4), h.a * hud);
        col = shoulder(col);
        // ink<->bone in linear-ish space; saturated light (the nixie orange, phosphor) keeps its colour
        float mxI = max(col.r, max(col.g, col.b));
        float satI = clamp(((mxI - min(col.r, min(col.g, col.b))) / max(mxI, 1e-3) - 0.35) * 2.5, 0.0, 1.0);
        col = mix(col, mix(vec3(0.8515) - col * 0.84, col, satI), invert);
        col += C_BONE * flash;
        // CRT raster: scanlines along the curved raster (bright lines spread and fill the gaps), slot mask
        if (crt > 0.0) {
          float lm0 = luma(col);
          float sl = 0.5 + 0.5 * cos(6.2831853 * pic.y * ${H}.0 / 3.0);
          float spread = smoothstep(0.0, 0.9, lm0);
          col *= mix(1.0, mix(0.42 + 0.58 * sl, 0.85 + 0.15 * sl, spread) * 1.22, crt);
          float tri = mod(floor(ras.x * ${W}.0), 3.0);
          vec3 mask = tri < 1.0 ? vec3(1.0, 0.82, 0.82) : tri < 2.0 ? vec3(0.82, 1.0, 0.82) : vec3(0.82, 0.82, 1.0);
          col *= mix(vec3(1.0), mask * 1.12, 0.35 * crt);
        }
        // power: only the collapsing raster is lit, brighter as it narrows; a dot as it dies
        if (power < 1.0) {
          col *= pmask * (1.0 + (1.0 - ps.y) * 2.0);
          float dot0 = exp(-dot(dr * asp, dr * asp) / (0.0004 + 0.003 * smoothstep(0.0, 0.15, power)));
          col += C_BONE * dot0 * smoothstep(0.0, 0.03, power) * (1.0 - smoothstep(0.15, 0.3, power)) * 2.5;
        }
        col *= bezel;
        // vignette
        float v = smoothstep(0.95, 0.25, length(dc * vec2(1.0, 0.8)));
        col *= mix(1.0, v, vignette);
        col *= (1.0 - fade);
        // the 4:3 box (pillarbox to near-black, 1 px soft edge)
        float bh = mix(0.5, 0.375, box);
        col = mix(C_INK * 0.25, col, smoothstep(bh + 0.5 / res.x, bh - 0.5 / res.x, abs(vUv.x - 0.5)));
        vec3 s = toSRGB(sat(col));
        // film grain: two scales, stronger in mid-tones
${SCALE === 1 ? `        float g1 = hash12(gl_FragCoord.xy + fract(time * 13.37) * 1000.0) - 0.5;
        float g2 = hash12(floor(gl_FragCoord.xy / 2.0) + fract(time * 7.13) * 1000.0) - 0.5;` : `        // output scale > 1: the fine grain is per physical px with its amplitude raised by PX_SCALE so its
        // power per logical px (what survives a downscale) matches 1x; the coarse grain keeps 2x2-logical-px cells
        float g1 = (hash12(gl_FragCoord.xy + fract(time * 13.37) * 1000.0) - 0.5) * PX_SCALE;
        float g2 = hash12(floor(FRAG_PX / 2.0) + fract(time * 7.13) * 1000.0) - 0.5;`}
        float lm = luma(s);
        float amt = grain * (0.55 + 1.2 * lm * (1.0 - lm));
        s += (g1 * 0.6 + g2 * 0.4) * amt;
        s += (hash12(gl_FragCoord.xy * 1.37 + time) - 0.5) / 255.0; // dither
        fragColor = vec4(sat(s), 1.0);
      }`, {
      src: { value: null }, bloomTex: { value: null }, haloTex: { value: null }, hudTex: { value: null },
      exposure: { value: 1 }, bloom: { value: 0.5 }, halation: { value: 0.2 }, ca: { value: 1 }, grain: { value: 0.05 },
      vignette: { value: 0.3 }, hud: { value: 1 }, fade: { value: 0 }, flash: { value: 0 }, time: { value: 0 },
      zoom: { value: 1 }, invert: { value: 0 }, shake: { value: new THREE.Vector2() }, res: { value: new THREE.Vector2(W, H) },
      crt: { value: 0 }, curve: { value: 0 }, vhs: { value: 0 }, box: { value: 0 }, degauss: { value: 0 }, power: { value: 1 },
      cold: { value: 0 }, frame: { value: 0 },
    });
  }

  /** Apply the chain: src (HDR linear) -> out (sRGB 8-bit target or screen). */
  render(renderer: THREE.WebGLRenderer, src: THREE.Texture, hud: THREE.Texture, out: THREE.WebGLRenderTarget | null, p: PostParams, time: number) {
    // bloom pyramid
    this.prefilter.u.src!.value = src;
    (this.prefilter.u.texel!.value as THREE.Vector2).set(1 / W, 1 / H);
    this.prefilter.u.threshold!.value = p.bloomThreshold;
    this.prefilter.u.knee!.value = p.bloomKnee;
    this.prefilter.render(renderer, this.mips[0]!);
    for (let i = 1; i < MIPS; i++) {
      const s = this.mips[i - 1]!;
      this.down.u.src!.value = s.texture;
      (this.down.u.texel!.value as THREE.Vector2).set(1 / s.width, 1 / s.height);
      this.down.render(renderer, this.mips[i]!);
    }
    // upsample: ups[i] = mips[i] + up(ups[i+1])
    let prevTex = this.mips[MIPS - 1]!.texture;
    for (let i = MIPS - 2; i >= 0; i--) {
      const small = i === MIPS - 2 ? this.mips[MIPS - 1]! : this.ups[i + 1]!;
      this.up.u.src!.value = prevTex;
      this.up.u.prev!.value = this.mips[i]!.texture;
      (this.up.u.texel!.value as THREE.Vector2).set(1 / small.width, 1 / small.height);
      this.up.u.radius!.value = 0.5 + p.bloomRadius;
      this.up.render(renderer, this.ups[i]!);
      prevTex = this.ups[i]!.texture;
    }
    const f = this.final.u;
    f.src!.value = src;
    f.bloomTex!.value = this.ups[0]!.texture;
    f.haloTex!.value = this.ups[3]!.texture;
    f.hudTex!.value = hud;
    f.exposure!.value = p.exposure;
    f.bloom!.value = p.bloom / 3; // pyramid sums ~MIPS levels; normalize
    f.halation!.value = p.halation;
    f.ca!.value = p.ca;
    f.grain!.value = p.grain;
    f.vignette!.value = p.vignette;
    f.hud!.value = p.hud;
    f.fade!.value = p.fade;
    f.flash!.value = p.flash;
    f.time!.value = time;
    f.zoom!.value = p.zoom;
    f.invert!.value = p.invert;
    f.crt!.value = p.crt;
    f.curve!.value = p.curve;
    f.vhs!.value = p.vhs;
    f.box!.value = p.box;
    f.degauss!.value = p.degauss;
    f.power!.value = p.power;
    f.cold!.value = p.cold;
    f.frame!.value = Math.round(time * 60); // VHS noise: constant over a frame (= frameIdx)
    (f.shake!.value as THREE.Vector2).set(p.shake[0], p.shake[1]);
    this.final.render(renderer, out);
  }
}
