import { useEffect, useRef } from 'react';

const vsSource = `#version 300 es
in vec2 a_position;
void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

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
uniform int u_samples;
uniform float u_lightPower;

out vec4 outColor;

void main() {
    // Convert gl_FragCoord to match Top-Down Canvas coordinate system
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    float flippedY = 1.0 - st.y; 

    float wx = u_xMin + st.x * u_physicalW;
    float wy = u_yMin + flippedY * u_physicalH;

    // Inside subject or behind wall check
    float dx_sub = wx - u_distSubject;
    float dy_sub = wy;
    float distToSubCenterSq = dx_sub*dx_sub + dy_sub*dy_sub;

    if (distToSubCenterSq <= u_subRadius*u_subRadius || wx > u_wallX) {
        outColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }

    float intensity = 0.0;
    float sampleStep = u_modifierSize / float(u_samples);

    for (int i = 0; i < 1024; i++) {
        if (i >= u_samples) break;

        float lx = 0.0;
        float ly = -u_modifierSize / 2.0 + (float(i) + 0.5) * sampleStep;

        float dx = wx - lx;
        float dy = wy - ly;
        float distSq = dx*dx + dy*dy;
        float dist = sqrt(distSq);

        float dirX = dx / dist;
        float cosTheta = dirX;

        if (cosTheta > 0.0 && acos(cosTheta) <= u_halfBeamRad) {
            float fX = lx - u_distSubject;
            float fY = ly;

            float a = distSq;
            float b = 2.0 * (fX*dx + fY*dy);
            float c = fX*fX + fY*fY - u_subRadius*u_subRadius;
            float disc = b*b - 4.0*a*c;

            bool hit = false;
            if (disc >= 0.0) {
                float sqrtDisc = sqrt(disc);
                float t1 = (-b - sqrtDisc) / (2.0*a);
                float t2 = (-b + sqrtDisc) / (2.0*a);
                if ((t1 > 0.0 && t1 < 1.0) || (t2 > 0.0 && t2 < 1.0)) hit = true;
            }

            if (!hit) {
                intensity += cosTheta / distSq;
            }
        }
    }

    intensity = (intensity / float(u_samples)) * u_lightPower;
    float val = 1.0 - exp(-intensity * (u_exposure / 100.0));

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
    samples: WebGLUniformLocation | null
    lightPower: WebGLUniformLocation | null
  }
}

interface LightFieldRendererProps {
  modifierSize: number
  distSubject: number
  subjectDiam: number
  distWall: number
  beamAngle: number
  exposure: number
  samples: number
  wallOffsetRight: number
}

export function LightFieldRenderer({
  modifierSize,
  distSubject,
  subjectDiam,
  distWall,
  beamAngle,
  exposure,
  samples,
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
        samples: gl.getUniformLocation(program, 'u_samples'),
        lightPower: gl.getUniformLocation(program, 'u_lightPower'),
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
      // const physWidthMin = wallX + wallOffsetRight;
      // const physHeightMin = height / 2.244;
      // const scale = Math.min(width / physWidthMin, height / physHeightMin);
      const scale = width / 1000;
      // console.log(`height=`, height / 2.244);
      // const scale = 2.244

      const physicalW = width / scale;
      const physicalH = height / scale;

      // Pin wall to the right side using the provided offset parameter
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
      gl.uniform1i(locs.samples, samples);
      gl.uniform1f(locs.lightPower, 10000.0);

      gl.enableVertexAttribArray(locs.position);
      gl.vertexAttribPointer(locs.position, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [modifierSize, distSubject, subjectDiam, distWall, beamAngle, exposure, samples, wallOffsetRight]);

  return (
    <canvas
      ref={glCanvasRef}
      className="absolute inset-0 w-full h-full block"
    />
  );
}
