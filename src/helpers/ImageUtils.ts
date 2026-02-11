import { getSizePreserveAspect } from "./UnitUtils"
import ImageProcessor from "./ImageProcessor"

/**
 * Helper type to transmit image bitmap data
 */
export type Pixels = {
    data: Uint8Array, 
    width: number,
    height: number, 
    bitsPerPixel: number
}

export type BitmapLike = {
    width: number,
    height: number,
    bytes: Uint8Array
}

/**
 * Helper type to transmit black and white bitmap data
 */
export type BWBitmap = BitmapLike

const BLACK_PIXEL = 0
const WHITE_PIXEL = 1
const DEFAULT_THRESHOLD = 240
const DEFAULT_CROP_ALPHA_THRESHOLD = 16

/**
 * Set of image utility
 */
export default class ImageUtils {
    /**
     * Get pixel information about an image
     * @param image Image to process
     * @param target Optional target raster size. Useful for vector inputs (e.g. SVG) to rasterize at the final size.
     * @returns 
     */
    static async getPixels(image: string|Blob, target?: { width: number; height: number }): Promise<Pixels> {
        return await ImageProcessor.getImageData(image, target)
    }

    /**
     * Return a bitmap in which all pixels are represented with one bit of either 1 or 0 representing white and black
     * pixels respectively. `destinationWidth` and `destinationHeight` have to be smaller or equal to the
     * input size as only downscaling is performed
     * 
     * @param image Image to process  
     * @param destinationWidth Width of the output bitmap
     * @param destinationHeight Height of the output bitmap
     * @returns 
     */
    static async getBWBitmap(
        image: string|Blob,
        destinationWidth?: number,
        destinationHeight?: number,
        threshold?: number,
        lsbFirst: boolean = false,
    ): Promise<BWBitmap> {
        const {
            data,
            width,
            height,
            bitsPerPixel
        } = await this.getPixels(
            image,
            destinationWidth != null && destinationHeight != null
                ? { width: destinationWidth, height: destinationHeight }
                : undefined
        )

        // Auto-crop transparent margins for RGBA sources so content isn't shrunk to a few pixels when resizing.
        // Only applies when alpha channel is present.
        let cropX0 = 0
        let cropY0 = 0
        let cropX1 = width - 1
        let cropY1 = height - 1

        if (bitsPerPixel > 3) {
            let found = false
            let minX = width
            let minY = height
            let maxX = -1
            let maxY = -1

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const a = data[(y * width * bitsPerPixel) + (x * bitsPerPixel) + 3]
                    if (a >= DEFAULT_CROP_ALPHA_THRESHOLD) {
                        found = true
                        if (x < minX) minX = x
                        if (y < minY) minY = y
                        if (x > maxX) maxX = x
                        if (y > maxY) maxY = y
                    }
                }
            }

            if (found) {
                cropX0 = minX
                cropY0 = minY
                cropX1 = maxX
                cropY1 = maxY
            }
        }

        const cropWidth = cropX1 - cropX0 + 1
        const cropHeight = cropY1 - cropY0 + 1
    
        const dim = getSizePreserveAspect(cropWidth, cropHeight, destinationWidth, destinationHeight)
        // Number of pixels width and height => number of bits for each row and number of rows
        const dWidth = dim.width
        const dHeight = dim.height
    
        const differenceToDividable = dWidth % 8 == 0 ? 0 : (8 - (dWidth % 8))
        const dividableDWidth = dWidth + differenceToDividable

        // Luminance buffer for adaptive thresholding.
        // Stored per destination pixel (including padding), 0..255.
        const luminances = new Uint8Array(dividableDWidth * dHeight)

        let destinationIndex = 0
        for (let h=0; h < dHeight; h++) {
            const srcY0 = cropY0 + Math.floor((h * cropHeight) / dHeight)
            const srcY1 = Math.max(srcY0, cropY0 + Math.floor(((h + 1) * cropHeight) / dHeight) - 1)

            for(let w=0; w < dWidth; w++) {
                const srcX0 = cropX0 + Math.floor((w * cropWidth) / dWidth)
                const srcX1 = Math.max(srcX0, cropX0 + Math.floor(((w + 1) * cropWidth) / dWidth) - 1)

                let lumSum = 0
                let count = 0
                let opaqueCount = 0
                let opaqueLumSum = 0
                let opaqueWeightSum = 0
                let minOpaqueLum = 255

                for (let sy = srcY0; sy <= srcY1; sy++) {
                    for (let sx = srcX0; sx <= srcX1; sx++) {
                        const baseIndex = (sy * width * bitsPerPixel) + (sx * bitsPerPixel)

                        const r = data[baseIndex]
                        const g = data[baseIndex + 1]
                        const b = data[baseIndex + 2]
                        const a = bitsPerPixel > 3 ? data[baseIndex + 3] : 255

                        // Composite onto white background first (important for antialiasing and transparent pixels)
                        const alpha = a / 255
                        const rC = r * alpha + 255 * (1 - alpha)
                        const gC = g * alpha + 255 * (1 - alpha)
                        const bC = b * alpha + 255 * (1 - alpha)

                        lumSum += (0.299 * rC) + (0.587 * gC) + (0.114 * bC)
                        count += 1

                        if (a > 0) {
                            opaqueCount += 1
                            const lum = (0.299 * r) + (0.587 * g) + (0.114 * b)
                            opaqueLumSum += lum * alpha
                            opaqueWeightSum += alpha
                            if (lum < minOpaqueLum) minOpaqueLum = lum
                        }
                    }
                }

                const avgLum = count > 0 ? (lumSum / count) : 255
                const avgOpaqueLum = opaqueWeightSum > 0 ? (opaqueLumSum / opaqueWeightSum) : 255
                const opaqueRatio = count > 0 ? (opaqueCount / count) : 0
                const luminance = opaqueCount === 0
                    ? 255
                    : (opaqueRatio < 0.25 ? minOpaqueLum : avgOpaqueLum)
                luminances[destinationIndex] = Math.max(0, Math.min(255, Math.round(luminance)))

                destinationIndex += 1
            }
    
            for(let i=0; i < differenceToDividable; i++) {
                luminances[destinationIndex] = 255
                destinationIndex += 1
            }
        }

        const thresholdValue = threshold ?? this.otsuThreshold(luminances, dWidth, dividableDWidth, dHeight)

        // Size of the array has to be with * height but width has to be extended to be dividable by 8
        const bitmapData = new Uint8Array(dividableDWidth * dHeight)
        for (let h = 0; h < dHeight; h++) {
            const rowOffset = h * dividableDWidth
            for (let w = 0; w < dividableDWidth; w++) {
                const idx = rowOffset + w
                bitmapData[idx] = luminances[idx] > thresholdValue ? WHITE_PIXEL : BLACK_PIXEL
            }
        }
    
        const byteArrays = this.chunk(bitmapData,8)
        const widthInBytes = dividableDWidth / 8
    
        const bytes = byteArrays.map((b) => this.bitsToByte(b, lsbFirst))
        const finalBytes = new Uint8Array(bytes)
    
        return {
            width: widthInBytes,
            height: dHeight,
            bytes: finalBytes
        }
    }

    private static otsuThreshold(luminances: Uint8Array, contentWidth: number, rowWidth: number, height: number): number {
        // Histogram of 0..255
        const hist = new Uint32Array(256)
        let total = 0

        for (let y = 0; y < height; y++) {
            const rowOffset = y * rowWidth
            for (let x = 0; x < contentWidth; x++) {
                hist[luminances[rowOffset + x]] += 1
                total += 1
            }
        }

        if (total === 0) return DEFAULT_THRESHOLD

        let sum = 0
        for (let t = 0; t < 256; t++) sum += t * hist[t]

        let sumB = 0
        let wB = 0
        let wF = 0
        let maxBetween = -1
        let threshold = DEFAULT_THRESHOLD

        for (let t = 0; t < 256; t++) {
            wB += hist[t]
            if (wB === 0) continue
            wF = total - wB
            if (wF === 0) break

            sumB += t * hist[t]

            const mB = sumB / wB
            const mF = (sum - sumB) / wF
            const between = wB * wF * (mB - mF) * (mB - mF)

            if (between > maxBetween) {
                maxBetween = between
                threshold = t
            }
        }

        return threshold
    }

    /**
     * Splits an array into chunks.
     * @param originalArray
     * @param chunkSize
     * @returns
     */
    private static chunk(originalArray: Uint8Array, chunkSize: number): Uint8Array[] {
        const resultArray = [];

        for (let i = 0; i < originalArray.length; i += chunkSize) {
            const chunk = originalArray.slice(i, i + chunkSize);
            resultArray.push(chunk);
        }

        return resultArray;
    }

    /**
     * Converts an array of bits to a byte
     * @param bits
     * @returns
     */
    private static bitsToByte(bits: Uint8Array, lsbFirst: boolean) {
        let byteValue = 0

        if (lsbFirst) {
            for (let i = 0; i < bits.length; i++) {
                byteValue |= (bits[i] & 1) << i
            }
            return byteValue
        }

        for (let i = 0; i < bits.length; i++) {
            byteValue = (byteValue << 1) | (bits[i] & 1)
        }
        return byteValue
    }

    static dilateBWBitmap(bitmap: BWBitmap, iterations: number = 1): BWBitmap {
        let current = bitmap
        for (let i = 0; i < iterations; i++) {
            current = this.dilateOnce(current)
        }
        return current
    }

    static bwBitmapToPBM(bitmap: BWBitmap, widthDots?: number): Uint8Array {
        const widthBytes = bitmap.width
        const height = bitmap.height
        const widthBits = widthDots ?? (widthBytes * 8)
        const header = `P4\n${widthBits} ${height}\n`

        const headerBytes = new TextEncoder().encode(header)

        // PBM P4 expects 1=black, 0=white, MSB-first in each byte.
        // Our BWBitmap uses 0=black, 1=white. So we invert bits.
        const rowBytes = Math.ceil(widthBits / 8)
        const out = new Uint8Array(headerBytes.length + rowBytes * height)
        out.set(headerBytes, 0)

        const src = bitmap.bytes
        let offset = headerBytes.length

        for (let y = 0; y < height; y++) {
            const rowStart = y * widthBytes
            for (let xb = 0; xb < rowBytes; xb++) {
                const b = src[rowStart + xb] ?? 0xff
                out[offset++] = (~b) & 0xff
            }

            // If widthDots is not byte-aligned, clear the unused bits in the last byte.
            const extraBits = (rowBytes * 8) - widthBits
            if (extraBits > 0) {
                const mask = 0xff << extraBits
                out[offset - 1] = out[offset - 1] & mask
            }
        }

        return out
    }

    static async saveBWBitmapAsPBM(bitmap: BWBitmap, filePath: string, widthDots?: number): Promise<void> {
        if (typeof window !== "undefined") {
            throw new Error("pbm-export-not-supported-in-browser")
        }

        const fs = await eval("require")("fs")
        const bytes = this.bwBitmapToPBM(bitmap, widthDots)
        fs.writeFileSync(filePath, bytes)
    }

    private static dilateOnce(bitmap: BWBitmap): BWBitmap {
        const widthBytes = bitmap.width
        const widthBits = widthBytes * 8
        const height = bitmap.height

        const src = bitmap.bytes
        const dst = new Uint8Array(src.length)

        const getBit = (x: number, y: number): 0|1 => {
            if (x < 0 || y < 0 || x >= widthBits || y >= height) return 1
            const byteIndex = (y * widthBytes) + (x >> 3)
            const bitIndex = 7 - (x & 7)
            return ((src[byteIndex] >> bitIndex) & 1) as 0|1
        }

        const setBit = (x: number, y: number, value: 0|1) => {
            if (x < 0 || y < 0 || x >= widthBits || y >= height) return
            const byteIndex = (y * widthBytes) + (x >> 3)
            const mask = 1 << (7 - (x & 7))
            if (value === 1) dst[byteIndex] |= mask
            else dst[byteIndex] &= (~mask) & 0xff
        }

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < widthBits; x++) {
                // We represent black as 0, white as 1.
                const isBlack = (
                    getBit(x, y) === 0 ||
                    getBit(x - 1, y) === 0 ||
                    getBit(x + 1, y) === 0 ||
                    getBit(x, y - 1) === 0 ||
                    getBit(x, y + 1) === 0 ||
                    getBit(x - 1, y - 1) === 0 ||
                    getBit(x + 1, y - 1) === 0 ||
                    getBit(x - 1, y + 1) === 0 ||
                    getBit(x + 1, y + 1) === 0
                )
                setBit(x, y, isBlack ? 0 : 1)
            }
        }

        return {
            width: widthBytes,
            height,
            bytes: dst,
        }
    }
}