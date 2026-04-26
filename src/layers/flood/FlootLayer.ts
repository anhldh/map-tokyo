import mapboxgl from "mapbox-gl";

export class FloodLayer implements mapboxgl.CustomLayerInterface {
  id = "flood-layer";
  type = "custom" as const;
  renderingMode = "2d" as const;

  private map: mapboxgl.Map | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private buffer: WebGLBuffer | null = null;
  private waterLevel = 0; // mét

  setWaterLevel(level: number) {
    this.waterLevel = level;
    this.map?.triggerRepaint();
  }

  onAdd(map: mapboxgl.Map, gl: WebGL2RenderingContext) {
    this.map = map;
    this.gl = gl;

    // Vertex shader — full-screen quad
    const vs = `#version 300 es
      in vec2 a_pos;
      out vec2 v_uv;
      void main() {
        v_uv = a_pos * 0.5 + 0.5;
        gl_Position = vec4(a_pos, 0.0, 1.0);
      }
    `;

    // Fragment shader — đọc terrain texture, so sánh elevation
    const fs = `#version 300 es
      precision highp float;
      in vec2 v_uv;
      out vec4 fragColor;

      uniform sampler2D u_terrain;
      uniform float u_waterLevel;

      // Mapbox terrain-rgb decode
      float decodeElevation(vec3 rgb) {
        return -10000.0 + (rgb.r * 256.0 * 256.0 + rgb.g * 256.0 + rgb.b) * 25.5 / 256.0 * 0.1;
      }

      void main() {
        vec3 rgb = texture(u_terrain, v_uv).rgb * 255.0;
        float elevation = decodeElevation(rgb);

        if (elevation < u_waterLevel) {
          // Độ sâu càng lớn → màu càng đậm
          float depth = u_waterLevel - elevation;
          float intensity = clamp(depth / 10.0, 0.3, 0.85);
          fragColor = vec4(0.1, 0.4, 0.9, intensity);
        } else {
          discard;
        }
      }
    `;

    // Compile shaders
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(s));
      }
      return s;
    };

    this.program = gl.createProgram()!;
    gl.attachShader(this.program, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(this.program, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(this.program);

    // Quad buffer
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
  }

  render(gl: WebGL2RenderingContext) {
    if (!this.program || !this.map) return;

    // Lấy terrain source texture (Mapbox internal)
    // ⚠️ Cách này phụ thuộc Mapbox internal API → có thể break giữa các version
    const terrain = (this.map as any).style?._terrain;
    if (!terrain) return;

    gl.useProgram(this.program);
    // Binding texture, set uniforms... (cần access internal terrain framebuffer)

    const loc = gl.getUniformLocation(this.program, "u_waterLevel");
    gl.uniform1f(loc, this.waterLevel);

    // Draw quad
    const posLoc = gl.getAttribLocation(this.program, "a_pos");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  onRemove() {
    if (this.gl && this.program) this.gl.deleteProgram(this.program);
    if (this.gl && this.buffer) this.gl.deleteBuffer(this.buffer);
  }
}
