/**
 * This example steps computation of the Conway's Game of Life and draws it on
 * the screen.
 *
 * Game of life simulates a grid world, where the state of each cell in time T + 1
 * can be determined by rules applied to the cell's surroundings at time T.
 * The rules are:
 * - If the cell is alive and 2-3 surrounding cells are alive, the cell stays alive
 * - If the cell is alive and 0-1 surrounding cells are alive, the cell dies
 * - If the cell is alive and 4-8 surrounding cells are alive, the cell dies
 * - If the cell is dead and 3 surrounding cells are alive, the cell comes to life
 */

import {
    Device,
    Command,
    Attributes,
    Texture,
    Framebuffer,
    BufferBits,
    Primitive,
    DataType,
    InternalFormat,
    Format,
    Wrap,
} from "./lib/webglutenfree.js";

const dev = Device.create({ antialias: false });
const [width, height] = [dev.bufferWidth, dev.bufferHeight];
const [lifeWidth, lifeHeight] = [
    Math.round(width / 4),
    Math.round(height / 4),
];

// Use textures with only one channel. By using REPEAT in both directions, we
// create a cyclic universe
const pingTex = Texture.create(dev, lifeWidth, lifeHeight, InternalFormat.R8, {
    wrapS: Wrap.REPEAT,
    wrapT: Wrap.REPEAT,
});
const pongTex = Texture.create(dev, lifeWidth, lifeHeight, InternalFormat.R8, {
    wrapS: Wrap.REPEAT,
    wrapT: Wrap.REPEAT,
});

const data = Array(lifeWidth * lifeHeight);
for (let i = 0; i < lifeWidth * lifeHeight; ++i) {
    data[i] = Math.random() > 0.5 ? 0 : 255;
}
pingTex.store(
    new Uint8Array(data),
    Format.RED,
    DataType.UNSIGNED_BYTE,
);

const pingFbo = Framebuffer.create(dev, lifeWidth, lifeHeight, pingTex);
const pongFbo = Framebuffer.create(dev, lifeWidth, lifeHeight, pongTex);

// Performs a step by step simulation by reading previous state of the
// universe from one texture and writing the result to another.

interface CmdProps {
    tex: Texture<InternalFormat>;
}

const cmd = Command.create<CmdProps>(
    dev,
    `#version 300 es
        precision mediump float;

        out vec2 v_uv;

        void main() {
            switch (gl_VertexID % 3) {
                case 0:
                    gl_Position = vec4(-1, 3, 0, 1);
                    v_uv = vec2(0, 2);
                    break;
                case 1:
                    gl_Position = vec4(-1, -1, 0, 1);
                    v_uv = vec2(0, 0);
                    break;
                case 2:
                    gl_Position = vec4(3, -1, 0, 1);
                    v_uv = vec2(2, 0);
                    break;
            }
        }
    `,
    `#version 300 es
        precision mediump float;

        uniform sampler2D u_universe;

        in vec2 v_uv;

        layout (location = 0) out float f_next_universe;

        void main() {
            vec2 px = vec2(1) / vec2(textureSize(u_universe, 0));

            float current = texture(u_universe, v_uv).r;
            float neighbors = 0.0;

            neighbors += texture(u_universe, px * vec2( 1,  1) + v_uv).r;
            neighbors += texture(u_universe, px * vec2( 0,  1) + v_uv).r;
            neighbors += texture(u_universe, px * vec2(-1,  1) + v_uv).r;
            neighbors += texture(u_universe, px * vec2(-1,  0) + v_uv).r;
            neighbors += texture(u_universe, px * vec2(-1, -1) + v_uv).r;
            neighbors += texture(u_universe, px * vec2( 0, -1) + v_uv).r;
            neighbors += texture(u_universe, px * vec2( 1, -1) + v_uv).r;
            neighbors += texture(u_universe, px * vec2( 1,  0) + v_uv).r;

            if (current == 0.0) {
                f_next_universe = neighbors == 3.0 ? 1.0 : 0.0;
            } else {
                if (neighbors >= 4.0) {
                    f_next_universe = 0.0;
                } else if (neighbors >= 2.0) {
                    f_next_universe = 1.0;
                } else {
                    f_next_universe = 0.0;
                }
            }
        }
    `,
    { textures: { u_universe: ({ tex }) => tex } },
);

const attrs = Attributes.empty(dev, Primitive.TRIANGLES, 3);

let ping = { tex: pingTex, fbo: pingFbo };
let pong = { tex: pongTex, fbo: pongFbo };

const loop = () => {
    // Compute using previous values in ping, store to pong
    pong.fbo.target((rt) => {
        rt.draw(cmd, attrs, { tex: ping.tex });
    });

    // Update canvas based on pong
    dev.target((rt) => {
        rt.blit(pong.fbo, BufferBits.COLOR);
    });

    // ... and swap the pingpong
    const tmp = ping;
    ping = pong;
    pong = tmp;

    window.requestAnimationFrame(loop);
};

window.requestAnimationFrame(loop);
