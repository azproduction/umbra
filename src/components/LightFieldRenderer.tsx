import { useEffect, useRef } from 'react';

const vsSource = `#version 300 es
in vec2 a_position;
void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// 2D Lambertian disc integration. Mirrors src/lib/physics.ts — keep in sync.
const fsSource = `#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_modifierSize;
uniform float u_distSubject;
uniform float u_subRadius;
uniform float u_wallX;
uniform float u_physicalW;
uniform float u_physicalH;
uniform float u_xMin;
uniform float u_yMin;
uniform float u_halfBeamRad;
uniform float u_exposure;
uniform float u_distribution;
uniform float u_lightPower;
uniform int u_M;   // radial samples (set on JS side, scaled with R / tan(β))
uniform int u_N;   // angular samples (set on JS side, scaled with R / tan(β))

// Compile-time upper bounds. Loops break early at u_M/u_N. Worst case
// 32×96 = 3072 samples per fragment; typical is 8×16 = 128.
const int M_MAX = 32;
const int N_MAX = 96;
const float PI = 3.14159265358979;
const float ALPHA_MAX = 10.0;
const float BEAM_SOFT = 0.01;  // smooth the beam-cone boundary in cos-space to avoid sample-cutoff aliasing

out vec4 outColor;

// Normalised radial luminance (disc-average is 1 for any distribution).
float luminanceL(float rNorm) {
    float t = 1.0 - clamp(u_distribution, 0.0, 1.0);
    float alpha = ALPHA_MAX * t;
    if (alpha < 1e-4) return 1.0;
    float norm = alpha / (1.0 - exp(-alpha));
    return norm * exp(-alpha * rNorm * rNorm);
}

// Sphere-blocks-segment test for a ray from \`origin\` along \`dir\` hitting
// \`sphereCenter\` of radius \`sphereRadius\` between t=0 and t=1.
bool sphereBlocked(vec3 origin, vec3 dir, vec3 sphereCenter, float sphereRadius) {
    vec3 f = origin - sphereCenter;
    float a = dot(dir, dir);
    float b = 2.0 * dot(f, dir);
    float c = dot(f, f) - sphereRadius * sphereRadius;
    float disc = b * b - 4.0 * a * c;
    if (disc < 0.0) return false;
    float sqrtDisc = sqrt(disc);
    float t1 = (-b - sqrtDisc) / (2.0 * a);
    float t2 = (-b + sqrtDisc) / (2.0 * a);
    return (t1 > 0.0 && t1 < 1.0) || (t2 > 0.0 && t2 < 1.0);
}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    float flippedY = 1.0 - st.y;
    float wx = u_xMin + st.x * u_physicalW;
    float wy = u_yMin + flippedY * u_physicalH;

    // Inside subject (cross-section circle) or behind wall: black.
    float dx_sub = wx - u_distSubject;
    float dy_sub = wy;
    if (dx_sub * dx_sub + dy_sub * dy_sub <= u_subRadius * u_subRadius || wx > u_wallX) {
        outColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }

    float R = u_modifierSize * 0.5;
    float cosBeam = cos(u_halfBeamRad);
    // Clamp halfBeamRad below π/2 so tan() doesn't blow up at 180° beam.
    float tanBeam = tan(min(u_halfBeamRad, 1.55));
    vec3 sphereCenter = vec3(u_distSubject, 0.0, 0.0);
    vec3 receiver = vec3(wx, wy, 0.0);
    float sum = 0.0;

    // Outer rings (i ∈ [1, u_M)). The innermost cell r ∈ [0, R/u_M] is replaced
    // by an analytical correction below — its 1/d² peak at r=0 is severely
    // under-sampled by midpoint Riemann at any practical M.
    for (int i = 1; i < M_MAX; i++) {
        if (i >= u_M) break;
        float rNorm = (float(i) + 0.5) / float(u_M);
        float rs = rNorm * R;
        float L = luminanceL(rNorm);

        for (int j = 0; j < N_MAX; j++) {
            if (j >= u_N) break;
            // Left-endpoint sampling so j=0 → φ=0 and j=u_N/2 → φ=π give samples
            // at zs=0 (on the cross-section plane). Anchors the lit region at the
            // modifier surface for narrow beams. Equivalent to midpoint for periodic
            // integrands on [0, 2π], so no accuracy loss.
            float phi = float(j) * 2.0 * PI / float(u_N);
            vec3 src = vec3(0.0, rs * cos(phi), rs * sin(phi));
            vec3 dir = receiver - src;
            float distSq = dot(dir, dir);
            float dist = sqrt(distSq);
            float cosTheta = dir.x / dist;

            if (cosTheta <= 0.0) continue;
            float beamFactor = smoothstep(cosBeam - BEAM_SOFT, cosBeam + BEAM_SOFT, cosTheta);
            if (beamFactor <= 0.0) continue;

            if (!sphereBlocked(src, dir, sphereCenter, u_subRadius)) {
                sum += L * cosTheta * beamFactor / distSq * rs;
            }
        }
    }

    // Analytical inner correction over r ∈ [0, R/u_M], assuming uniform L = L(0).
    // The contributing radius is min(rEdge, wallDist·tan β): for narrow beams
    // close to the modifier, only rs ≤ wallDist·tan β is inside the cone, so
    // the inner cell is partially clipped. Without this clip the formula
    // counts the full cell and overcounts wildly near the surface (the
    // "strong middle beam" artifact).
    float innerCorr = 0.0;
    {
        float rEdge = R / float(u_M);
        float L_inner = luminanceL(0.5 / float(u_M));
        float wallDist = max(sqrt(wx * wx + wy * wy), 1e-3);
        float cosCenter = wx / wallDist;
        if (cosCenter > 0.0) {
            float beamCenter = smoothstep(cosBeam - BEAM_SOFT, cosBeam + BEAM_SOFT, cosCenter);
            if (beamCenter > 0.0) {
                vec3 dir_in = receiver;
                if (!sphereBlocked(vec3(0.0), dir_in, sphereCenter, u_subRadius)) {
                    float rsClip = min(rEdge, wallDist * tanBeam);
                    float angularFactor = 1.0 - wallDist / sqrt(wallDist * wallDist + rsClip * rsClip);
                    innerCorr = 2.0 * L_inner * beamCenter * angularFactor / (R * R);
                }
            }
        }
    }

    float intensity = u_lightPower * (sum * 2.0 / (float(u_M) * float(u_N) * R) + innerCorr);
    float val = 1.0 - exp(-intensity * u_exposure / 100.0);
    outColor = vec4(val, val, val, 1.0);
}
`;

interface GLInfo {
  gl: WebGL2RenderingContext
  program: WebGLProgram
  locs: {
    position: number
    resolution: WebGLUniformLocation | null
    modifierSize: WebGLUniformLocation | null
    distSubject: WebGLUniformLocation | null
    subRadius: WebGLUniformLocation | null
    wallX: WebGLUniformLocation | null
    physicalW: WebGLUniformLocation | null
    physicalH: WebGLUniformLocation | null
    xMin: WebGLUniformLocation | null
    yMin: WebGLUniformLocation | null
    halfBeamRad: WebGLUniformLocation | null
    exposure: WebGLUniformLocation | null
    distribution: WebGLUniformLocation | null
    lightPower: WebGLUniformLocation | null
    M: WebGLUniformLocation | null
    N: WebGLUniformLocation | null
  }
}

const M_MAX = 32;
const N_MAX = 96;
const M_MIN = 8;
const N_MIN = 16;
// Closest distance from the modifier (in cm) we want to render without
// individual-emitter aliasing. Below this `wx`, samples may still appear
// discrete; above, they merge into a continuous field.
const TARGET_WX = 30;

/**
 * Choose enough disc samples that adjacent ones overlap in the cross-section
 * at distance `TARGET_WX`. The visible-ray spacing on cross-section is
 * dominated by the on-plane samples at `(rs_i, 0)` (one per radial ring at
 * φ=0 and one at φ=π). For their cones of width `2·wx·tan(β)` to overlap by
 * ~5× at `TARGET_WX`, M must be ~`5·R / (2·wx·tan β)` = `2.5·R/(wx·tan β)`.
 * N is sized symmetrically for the rim chord `π·R/N`.
 */
function chooseSamples(modifierSize: number, beamAngle: number): { M: number, N: number } {
  const R = modifierSize / 2;
  const beamHalfRad = (beamAngle / 2) * (Math.PI / 180);
  const tanBeam = Math.max(Math.tan(beamHalfRad), 1e-3);
  const M = Math.max(M_MIN, Math.min(M_MAX, Math.ceil(2.5 * R / (TARGET_WX * tanBeam))));
  const N = Math.max(N_MIN, Math.min(N_MAX, Math.ceil(Math.PI * R / (TARGET_WX * tanBeam))));
  return { M, N };
}

interface LightFieldRendererProps {
  modifierSize: number
  distSubject: number
  subjectDiam: number
  distWall: number
  beamAngle: number
  exposure: number
  distribution: number
  wallOffsetRight: number
}

export function LightFieldRenderer({
  modifierSize,
  distSubject,
  subjectDiam,
  distWall,
  beamAngle,
  exposure,
  distribution,
  wallOffsetRight,
}: LightFieldRendererProps) {
  const glCanvasRef = useRef<HTMLCanvasElement>(null);
  const glInfo = useRef<GLInfo | null>(null);

  useEffect(() => {
    const gl = glCanvasRef.current?.getContext('webgl2') as WebGL2RenderingContext | null;
    if (!gl)
      return;

    const compileShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader)
        return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        return null;
      return shader;
    };

    const vs = compileShader(gl.VERTEX_SHADER, vsSource);
    const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
    const program = gl.createProgram();
    if (!program || !vs || !fs)
      return;

    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1,
      -1,
      1,
      -1,
      -1,
      1,
      -1,
      1,
      1,
      -1,
      1,
      1,
    ]), gl.STATIC_DRAW);

    glInfo.current = {
      gl,
      program,
      locs: {
        position: gl.getAttribLocation(program, 'a_position'),
        resolution: gl.getUniformLocation(program, 'u_resolution'),
        modifierSize: gl.getUniformLocation(program, 'u_modifierSize'),
        distSubject: gl.getUniformLocation(program, 'u_distSubject'),
        subRadius: gl.getUniformLocation(program, 'u_subRadius'),
        wallX: gl.getUniformLocation(program, 'u_wallX'),
        physicalW: gl.getUniformLocation(program, 'u_physicalW'),
        physicalH: gl.getUniformLocation(program, 'u_physicalH'),
        xMin: gl.getUniformLocation(program, 'u_xMin'),
        yMin: gl.getUniformLocation(program, 'u_yMin'),
        halfBeamRad: gl.getUniformLocation(program, 'u_halfBeamRad'),
        exposure: gl.getUniformLocation(program, 'u_exposure'),
        distribution: gl.getUniformLocation(program, 'u_distribution'),
        lightPower: gl.getUniformLocation(program, 'u_lightPower'),
        M: gl.getUniformLocation(program, 'u_M'),
        N: gl.getUniformLocation(program, 'u_N'),
      },
    };
  }, []);

  useEffect(() => {
    if (!glInfo.current)
      return;
    const { gl, program, locs } = glInfo.current;

    const canvas = glCanvasRef.current;
    if (!canvas)
      return;
    const draw = () => {
      const width = canvas.parentElement!.clientWidth;
      const height = canvas.parentElement!.clientHeight;
      if (!width || !height)
        return;
      canvas.width = width;
      canvas.height = height;

      const wallX = distSubject + distWall;
      const scale = width / 1000;
      const physicalW = width / scale;
      const physicalH = height / scale;

      const xMax = wallX + wallOffsetRight;
      const xMin = xMax - physicalW;
      const yMin = -physicalH / 2;

      const subRadius = subjectDiam / 2;
      const halfBeamRad = (beamAngle / 2) * (Math.PI / 180);

      gl.viewport(0, 0, width, height);
      gl.useProgram(program);

      gl.uniform2f(locs.resolution, width, height);
      gl.uniform1f(locs.modifierSize, modifierSize);
      gl.uniform1f(locs.distSubject, distSubject);
      gl.uniform1f(locs.subRadius, subRadius);
      gl.uniform1f(locs.wallX, wallX);
      gl.uniform1f(locs.physicalW, physicalW);
      gl.uniform1f(locs.physicalH, physicalH);
      gl.uniform1f(locs.xMin, xMin);
      gl.uniform1f(locs.yMin, yMin);
      gl.uniform1f(locs.halfBeamRad, halfBeamRad);
      gl.uniform1f(locs.exposure, exposure);
      gl.uniform1f(locs.distribution, distribution);
      gl.uniform1f(locs.lightPower, 50000.0);

      const { M, N } = chooseSamples(modifierSize, beamAngle);
      gl.uniform1i(locs.M, M);
      gl.uniform1i(locs.N, N);

      gl.enableVertexAttribArray(locs.position);
      gl.vertexAttribPointer(locs.position, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [modifierSize, distSubject, subjectDiam, distWall, beamAngle, exposure, distribution, wallOffsetRight]);

  return (
    <canvas
      ref={glCanvasRef}
      className="absolute inset-0 w-full h-full block"
    />
  );
}
