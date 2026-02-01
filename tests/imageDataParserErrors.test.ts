import { parsePNG } from "@/helpers/ImageDataParser"

test("parsePNG throws on invalid signature", () => {
    expect(() => parsePNG(Buffer.from([0, 1, 2, 3]))).toThrow("Invalid PNG file")
})

test("parsePNG throws when no IDAT", () => {
    // Minimal PNG with IHDR and IEND only
    const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])

    const ihdrData = Buffer.alloc(13)
    ihdrData.writeUInt32BE(1, 0) // width
    ihdrData.writeUInt32BE(1, 4) // height
    ihdrData.writeUInt8(8, 8) // bitDepth
    ihdrData.writeUInt8(6, 9) // colorType RGBA
    ihdrData.writeUInt8(0, 10) // compression
    ihdrData.writeUInt8(0, 11) // filter
    ihdrData.writeUInt8(0, 12) // interlace

    const ihdr = Buffer.concat([
        Buffer.from([0x00, 0x00, 0x00, 0x0d]),
        Buffer.from("IHDR"),
        ihdrData,
        Buffer.from([0x00, 0x00, 0x00, 0x00]), // fake CRC
    ])

    const iend = Buffer.concat([
        Buffer.from([0x00, 0x00, 0x00, 0x00]),
        Buffer.from("IEND"),
        Buffer.from([]),
        Buffer.from([0x00, 0x00, 0x00, 0x00]),
    ])

    const png = Buffer.concat([signature, ihdr, iend])
    expect(() => parsePNG(png)).toThrow("No image data found in PNG")
})
