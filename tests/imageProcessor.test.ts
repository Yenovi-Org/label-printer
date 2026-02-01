import ImageProcessor from "@/helpers/ImageProcessor"

jest.mock("@/helpers/ImageDataParser", () => {
    const actual = jest.requireActual("@/helpers/ImageDataParser")
    return {
        __esModule: true,
        ...actual,
        parsePNG: jest.fn(() => {
            return {
                width: 1,
                height: 1,
                bitsPerPixel: 4,
                data: new Uint8Array([0, 0, 0, 255]),
            }
        })
    }
})

function makeMinimalJpeg(width: number, height: number) {
    // Minimal JPEG structure just sufficient for ImageProcessor.parseJPEG() to read SOF0 dimensions.
    // SOI
    const chunks: number[] = [0xff, 0xd8]

    // SOF0 marker (FFC0) with length 17 (0x0011)
    // [marker][length][precision][height][width][components][component spec...]
    chunks.push(
        0xff, 0xc0,
        0x00, 0x11,
        0x08,
        (height >> 8) & 0xff, height & 0xff,
        (width >> 8) & 0xff, width & 0xff,
        0x03,
        0x01, 0x11, 0x00,
        0x02, 0x11, 0x00,
        0x03, 0x11, 0x00,
    )

    return Buffer.from(chunks)
}

test("toGrayscale keeps alpha and makes R=G=B", () => {
    const input = {
        width: 1,
        height: 1,
        bitsPerPixel: 4,
        data: new Uint8Array([100, 150, 200, 123]),
    }

    const out = ImageProcessor.toGrayscale(input)
    expect(out.data[3]).toBe(123)
    expect(out.data[0]).toBe(out.data[1])
    expect(out.data[1]).toBe(out.data[2])
})

test("resize uses nearest neighbor", () => {
    // 2x1 image: left pixel red, right pixel green
    const input = {
        width: 2,
        height: 1,
        bitsPerPixel: 4,
        data: new Uint8Array([
            255, 0, 0, 255,
            0, 255, 0, 255,
        ]),
    }

    const out = ImageProcessor.resize(input, 1, 1)
    expect(out.width).toBe(1)
    expect(out.height).toBe(1)
    expect(Array.from(out.data.slice(0, 4))).toEqual([255, 0, 0, 255])
})

test("getImageData supports PNG data URLs (smoke)", async () => {
    // 1x1 black PNG
    const base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/ax0f8kAAAAASUVORK5CYII="
    const dataUrl = `data:image/png;base64,${base64}`

    const out = await ImageProcessor.getImageData(dataUrl)
    expect(out.width).toBe(1)
    expect(out.height).toBe(1)
    expect(out.bitsPerPixel).toBe(4)
    expect(out.data.length).toBe(4)
})

test("getImageData supports JPEG data URLs (dimension parsing)", async () => {
    const jpeg = makeMinimalJpeg(2, 3)
    const dataUrl = `data:image/jpeg;base64,${jpeg.toString("base64")}`

    const out = await ImageProcessor.getImageData(dataUrl)
    expect(out.width).toBe(2)
    expect(out.height).toBe(3)
    expect(out.bitsPerPixel).toBe(4)
    expect(out.data.length).toBe(2 * 3 * 4)
})
