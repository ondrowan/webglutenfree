/**
 * This example shows how we can process images in a data-driven fashion by
 * exchanging kernels.
 *
 * Kernel convolutions inspired by:
 * https://webgl2fundamentals.org/webgl/lessons/webgl-image-processing.html
 */

import {
    Device,
    Command,
    Attributes,
    Texture,
} from "./lib/webglutenfree.js";
import { mat4 } from "./libx/gl-matrix.js";
import { loadImage } from "./libx/load-image.js";

import * as square from "./libx/square.js";

const kernels = {
    identity: [
        0, 0, 0,
        0, 1, 0,
        0, 0, 0,
    ],
    gaussianBlur: [
        0.045, 0.122, 0.045,
        0.122, 0.332, 0.122,
        0.045, 0.122, 0.045,
    ],
    unsharpen: [
        -1, -1, -1,
        -1, 9, -1,
        -1, -1, -1,
    ],
    emboss: [
        -2, -1, 0,
        -1, 1, 1,
        0, 1, 2,
    ],
    edgeDetect: [
        -1, -1, -1,
        -1, 8, -1,
        -1, -1, -1,
    ],
};

const KERNEL = kernels.edgeDetect;

const dev = Device.create();
const [width, height] = [dev.canvasCSSWidth, dev.canvasCSSHeight];

async function run() {
    const imageData = await loadImage("img/lenna.png", true);
    const imageTexture = Texture.withImage(dev, imageData);

    const cmd = Command.create(
        dev,
        `#version 300 es
            precision mediump float;

            uniform mat4 u_projection, u_model;

            layout (location = 0) in vec2 a_position;
            layout (location = 1) in vec2 a_uv;

            out vec2 v_uv;

            void main() {
                v_uv = a_uv;
                gl_Position = u_projection
                    * u_model
                    * vec4(a_position, 0.0, 1.0);
            }
        `,
        `#version 300 es
            precision mediump float;

            uniform sampler2D u_image;
            uniform float[9] u_kernel;
            uniform float u_kernel_weight;

            in vec2 v_uv;

            out vec4 f_color;

            void main() {
                vec2 px = vec2(1) / vec2(textureSize(u_image, 0));
                float[9] k = u_kernel;
                vec4 color_sum =
                    texture(u_image, px * vec2(-1, -1) + v_uv) * k[0] +
                    texture(u_image, px * vec2( 0, -1) + v_uv) * k[1] +
                    texture(u_image, px * vec2( 1, -1) + v_uv) * k[2] +
                    texture(u_image, px * vec2(-1,  0) + v_uv) * k[3] +
                    texture(u_image, px * vec2( 0,  0) + v_uv) * k[4] +
                    texture(u_image, px * vec2( 1,  0) + v_uv) * k[5] +
                    texture(u_image, px * vec2(-1,  1) + v_uv) * k[6] +
                    texture(u_image, px * vec2( 0,  1) + v_uv) * k[7] +
                    texture(u_image, px * vec2( 1,  1) + v_uv) * k[8] ;
                f_color = vec4((color_sum / u_kernel_weight).rgb, 1.0);
            }
        `,
        {
            textures: { u_image: imageTexture },
            uniforms: {
                u_model: {
                    type: "matrix4fv",
                    value: mat4.fromScaling(mat4.create(), [400, 400, 1]),
                },
                u_projection: {
                    type: "matrix4fv",
                    value: mat4.ortho(
                        mat4.create(),
                        -width / 2,
                        width / 2,
                        -height / 2,
                        height / 2,
                        -0.1,
                        1000.0,
                    ),
                },
                u_kernel: {
                    type: "1fv",
                    value: KERNEL,
                },
                u_kernel_weight: {
                    type: "1f",
                    value: computeKernelWeight(KERNEL),
                },
            },
        },
    );

    const attrs = Attributes.create(dev, square.elements, cmd.locate({
        a_position: square.positions,
        a_uv: square.uvs,
    }));

    dev.target((rt) => {
        rt.draw(cmd, attrs);
    });
}

run();

function computeKernelWeight(kernel) {
    const weight = kernel.reduce((prev, curr) => prev + curr);
    return weight <= 0 ? 1 : weight;
}
