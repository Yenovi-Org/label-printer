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

const oneByOnePng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/ax0f8kAAAAASUVORK5CYII=",
    "base64"
)

function toArrayBuffer(buf: Buffer): ArrayBufferLike {
    // Create a standalone ArrayBuffer containing exactly the bytes (works across Node Buffer implementations)
    const copy = Uint8Array.from(buf)
    return copy.buffer
}

describe("ImageProcessor.getImageData (node)", () => {
    afterEach(() => {
        delete (globalThis as any).fetch
    })

    test("fetch url path uses content-type to parse png", async () => {
        ;(globalThis as any).fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: "OK",
            arrayBuffer: async () => toArrayBuffer(oneByOnePng),
            headers: {
                get: (_k: string) => "image/png",
            },
        })

        const out = await ImageProcessor.getImageData("https://example.com/image")
        expect(out.width).toBe(1)
        expect(out.height).toBe(1)
    })

    test("data URL rejects non-image", async () => {
        await expect(ImageProcessor.getImageData("data:text/plain;base64,SGVsbG8=" as any)).rejects.toThrow(
            "Invalid image data URL"
        )
    })

    test("parse rejects unsupported extension", async () => {
        await expect(ImageProcessor.getImageData("data:image/gif;base64,R0lGODlhAQABAAAAACw=" as any)).rejects.toThrow(
            "Unsupported image format"
        )
    })
})
