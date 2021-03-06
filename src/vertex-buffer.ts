import * as assert from "./util/assert";
import { BufferUsage, DataType, sizeOf } from "./types";

export type Device = import ("./device").Device;

/**
 * Possible data types of vertex buffers.
 */
export type VertexBufferType =
    | DataType.UNSIGNED_BYTE
    | DataType.BYTE
    | DataType.UNSIGNED_SHORT
    | DataType.SHORT
    | DataType.UNSIGNED_INT
    | DataType.INT
    | DataType.FLOAT
    ;

export type VertexBufferTypedArray =
    | Uint8Array
    | Uint8ClampedArray
    | Uint16Array
    | Uint32Array
    | Int8Array
    | Int16Array
    | Int32Array
    | Float32Array
    ;

export interface VertexBufferTypeToTypedArray {
    [DataType.UNSIGNED_BYTE]: Uint8Array | Uint8ClampedArray;
    [DataType.BYTE]: Int8Array;
    [DataType.UNSIGNED_SHORT]: Uint16Array;
    [DataType.SHORT]: Int16Array;
    [DataType.UNSIGNED_INT]: Uint32Array;
    [DataType.INT]: Int32Array;
    [DataType.FLOAT]: Float32Array;

    [p: number]: VertexBufferTypedArray;
}

export interface VertexBufferOptions {
    usage?: BufferUsage;
}

export interface VertexBufferStoreOptions {
    offset?: number;
}

/**
 * Vertex buffers contain GPU accessible data. Accessing them is usually done
 * via setting up an attribute that reads the buffer.
 */
export class VertexBuffer<T extends VertexBufferType> {

    /**
     * Create a new vertex buffer with given type and of given size.
     */
    static create<T extends VertexBufferType>(
        dev: Device,
        type: T,
        size: number,
        { usage = BufferUsage.DYNAMIC_DRAW } = {},
    ): VertexBuffer<T> {
        return new VertexBuffer(
            dev._gl,
            type,
            size,
            size * sizeOf(type),
            usage,
        );
    }

    /**
     * Create a new vertex buffer of given type with provided data. Does not
     * take ownership of data.
     */
    static withTypedArray<T extends VertexBufferType>(
        dev: Device,
        type: T,
        data: VertexBufferTypeToTypedArray[T] | number[],
        { usage = BufferUsage.STATIC_DRAW }: VertexBufferOptions = {},
    ): VertexBuffer<T> {
        return new VertexBuffer(
            dev._gl,
            type,
            data.length,
            data.length * sizeOf(type),
            usage,
        ).store(data);
    }

    readonly type: T;
    readonly length: number;
    readonly byteLength: number;
    readonly usage: BufferUsage;

    readonly glBuffer: WebGLBuffer | null;

    private gl: WebGL2RenderingContext;

    private constructor(
        gl: WebGL2RenderingContext,
        type: T,
        length: number,
        byteLength: number,
        usage: BufferUsage,
    ) {
        this.gl = gl;
        this.type = type;
        this.length = length;
        this.byteLength = byteLength;
        this.usage = usage;
        this.glBuffer = null;

        this.init();
    }

    /**
     * Reinitialize invalid buffer, eg. after context is lost.
     */
    restore(): void {
        const { gl, glBuffer } = this;
        if (!gl.isBuffer(glBuffer)) { this.init(); }
    }

    /**
     * Upload new data to buffer. Does not take ownership of data.
     */
    store(
        data: VertexBufferTypeToTypedArray[T] | number[],
        { offset = 0 }: VertexBufferStoreOptions = {},
    ): this {
        const { type, gl, glBuffer } = this;
        const buffer = Array.isArray(data)
            ? createBuffer(type, data)
            // Note: we have to convert Uint8ClampedArray to Uint8Array
            // because of webgl bug
            // https://github.com/KhronosGroup/WebGL/issues/1533
            : data instanceof Uint8ClampedArray
                ? new Uint8Array(data)
                : data;
        const byteOffset = buffer.BYTES_PER_ELEMENT * offset;
        gl.bindBuffer(gl.ARRAY_BUFFER, glBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, byteOffset, buffer);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        return this;
    }

    private init(): void {
        const { usage, byteLength, gl } = this;
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, byteLength, usage);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        (this as any).glBuffer = buffer;
    }
}

function createBuffer(
    type: VertexBufferType,
    arr: number[],
): VertexBufferTypedArray {
    switch (type) {
        case DataType.BYTE: return new Int8Array(arr);
        case DataType.SHORT: return new Int16Array(arr);
        case DataType.INT: return new Int32Array(arr);
        case DataType.UNSIGNED_BYTE: return new Uint8Array(arr);
        case DataType.UNSIGNED_SHORT: return new Uint16Array(arr);
        case DataType.UNSIGNED_INT: return new Uint32Array(arr);
        case DataType.FLOAT: return new Float32Array(arr);
        default: return assert.never(type, (p) => `Invalid buffer type: ${p}`);
    }
}
