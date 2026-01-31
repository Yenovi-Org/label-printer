import ImageUtils from "@/helpers/ImageUtils"

jest.mock("@/helpers/ImageProcessor", () => {
    return {
        __esModule: true,
        default: {
            getImageData: jest.fn(),
        },
    }
})

import ImageProcessor from "@/helpers/ImageProcessor"

test("getBWBitmap converts RGBA pixels to 1-bit rows packed into bytes", async () => {
    ;(ImageProcessor.getImageData as unknown as jest.Mock).mockResolvedValue({
        width: 2,
        height: 2,
        bitsPerPixel: 4,
        // (0,0) black; (1,0) white; (0,1) transparent (treated as white); (1,1) white
        data: new Uint8Array([
            0, 0, 0, 255,
            255, 255, 255, 255,
            0, 0, 0, 0,
            255, 255, 255, 255,
        ])
    })

    const result = await ImageUtils.getBWBitmap("mock")

    // width is returned as bytes per row; width is rounded up to multiple of 8 bits
    expect(result.width).toBe(1)
    expect(result.height).toBe(2)

    // Row0: [black(0), white(1), pad(1..)] => 0b01111111 = 127
    // Row1: [white(1), white(1), pad(1..)] => 0b11111111 = 255
    expect(Array.from(result.bytes)).toEqual([127, 255])
})

test("getBWBitmap downsizes to destination dimensions", async () => {
    ;(ImageProcessor.getImageData as unknown as jest.Mock).mockResolvedValue({
        width: 10,
        height: 10,
        bitsPerPixel: 4,
        data: new Uint8Array(10 * 10 * 4).fill(255),
    })

    const result = await ImageUtils.getBWBitmap("mock", 8, 4)
    expect(result.width).toBe(1)
    expect(result.height).toBe(4)
    expect(result.bytes.length).toBe(4)
})
