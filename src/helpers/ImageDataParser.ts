

export interface ImageData {
  width: number;
  height: number;
  data: Uint8Array;
  bitsPerPixel: number;
}

export function parsePNG(buffer: Buffer): ImageData {
  const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  if (!buffer.subarray(0, 8).equals(pngSignature)) {
    throw new Error('Invalid PNG file');
  }

  let width = 0, height = 0, bitDepth = 0, colorType = 0;
  let compressionMethod = 0, filterMethod = 0, interlaceMethod = 0;
  let palette: Buffer | null = null;
  let transparency: Buffer | null = null; // <-- Add this
  let idatChunks: Buffer[] = [];

  let offset = 8;
  while (offset < buffer.length) {
    const chunkLength = buffer.readUInt32BE(offset);
    const chunkType = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const chunkData = buffer.subarray(offset + 8, offset + 8 + chunkLength);

    if (chunkType === 'IHDR') {
      width = chunkData.readUInt32BE(0);
      height = chunkData.readUInt32BE(4);
      bitDepth = chunkData.readUInt8(8);
      colorType = chunkData.readUInt8(9);
      compressionMethod = chunkData.readUInt8(10);
      filterMethod = chunkData.readUInt8(11);
      interlaceMethod = chunkData.readUInt8(12);
    } else if (chunkType === 'PLTE') {
      palette = chunkData;
    } else if (chunkType === 'tRNS') {
      transparency = chunkData;
    } else if (chunkType === 'IDAT') {
      idatChunks.push(chunkData);
    } else if (chunkType === 'IEND') {
      break;
    }
    offset += 8 + chunkLength + 4; // chunk header + data + CRC
  }

  if (compressionMethod !== 0) throw new Error('Unsupported PNG compression method');
  if (filterMethod !== 0) throw new Error('Unsupported PNG filter method');
  if (interlaceMethod !== 0) throw new Error('Interlaced PNGs not supported');
  if (idatChunks.length === 0) throw new Error('No image data found in PNG');

  const compressedData = Buffer.concat(idatChunks);
  let decompressedData: Buffer;
  try {
    const zlib = require('zlib');
    decompressedData = zlib.inflateSync(compressedData);
  } catch (error) {
    throw new Error('Failed to decompress PNG data: ' + error);
  }

  if (bitDepth !== 8) throw new Error('Only 8-bit PNGs are supported in this parser');

  let bytesPerPixel: number;
  let channels: number;
  let outputChannels = 4;
  switch (colorType) {
    case 0: channels = 1; bytesPerPixel = 1; break; // Grayscale
    case 2: channels = 3; bytesPerPixel = 3; break; // RGB
    case 3: channels = 1; bytesPerPixel = 1; break; // Palette
    case 4: channels = 2; bytesPerPixel = 2; break; // Grayscale+Alpha
    case 6: channels = 4; bytesPerPixel = 4; break; // RGBA
    default: throw new Error(`Unsupported PNG color type: ${colorType}`);
  }

  const scanlineLength = width * bytesPerPixel;
  const data = new Uint8Array(width * height * outputChannels);

  // PNG filters are applied relative to the *unfiltered* previous scanline.
  // Keep the previous unfiltered scanline buffer to decode correctly.
  let prevUnfilteredScanline: Buffer = Buffer.alloc(scanlineLength);

  for (let y = 0; y < height; y++) {
    const scanlineStart = y * (scanlineLength + 1);
    const filterType = decompressedData[scanlineStart];
    const scanline = decompressedData.subarray(scanlineStart + 1, scanlineStart + 1 + scanlineLength);

    const unfilteredScanline = applyPNGFilter(filterType, scanline, prevUnfilteredScanline, bytesPerPixel);
    prevUnfilteredScanline = unfilteredScanline as Buffer;

    for (let x = 0; x < width; x++) {
      const outIdx = (y * width + x) * outputChannels;

      if (colorType === 0) { // Grayscale
        const gray = unfilteredScanline[x];
        data[outIdx] = gray;
        data[outIdx + 1] = gray;
        data[outIdx + 2] = gray;
        data[outIdx + 3] = 255;
      } else if (colorType === 2) { // RGB
        data[outIdx] = unfilteredScanline[x * 3];
        data[outIdx + 1] = unfilteredScanline[x * 3 + 1];
        data[outIdx + 2] = unfilteredScanline[x * 3 + 2];
        data[outIdx + 3] = 255;
      } else if (colorType === 3) { // Palette
        if (!palette) throw new Error('Palette PNG missing PLTE chunk');
        const idx = unfilteredScanline[x];
        data[outIdx] = palette[idx * 3];
        data[outIdx + 1] = palette[idx * 3 + 1];
        data[outIdx + 2] = palette[idx * 3 + 2];
        data[outIdx + 3] = transparency && idx < transparency.length ? transparency[idx] : 255;
      } else if (colorType === 4) { // Grayscale + Alpha
        const gray = unfilteredScanline[x * 2];
        data[outIdx] = gray;
        data[outIdx + 1] = gray;
        data[outIdx + 2] = gray;
        data[outIdx + 3] = unfilteredScanline[x * 2 + 1];
      } else if (colorType === 6) { // RGBA
        data[outIdx] = unfilteredScanline[x * 4];
        data[outIdx + 1] = unfilteredScanline[x * 4 + 1];
        data[outIdx + 2] = unfilteredScanline[x * 4 + 2];
        data[outIdx + 3] = unfilteredScanline[x * 4 + 3];
      }
    }
  }

  return {
    data,
    width,
    height,
    bitsPerPixel: outputChannels
  };
}
/**
 * Apply PNG filter to scanline
 * @param filterType PNG filter type (0-4)
 * @param scanline Current scanline data
 * @param prevScanline Previous scanline data
 * @param bytesPerPixel Bytes per pixel
 * @returns Unfiltered scanline
 */
function applyPNGFilter(filterType: number, scanline: Buffer, prevScanline: Buffer, bytesPerPixel: number): Buffer {
    const result = Buffer.alloc(scanline.length);

    for (let i = 0; i < scanline.length; i++) {
        let filtered = scanline[i];
        let a = i >= bytesPerPixel ? result[i - bytesPerPixel] : 0; // Left pixel
        let b = prevScanline[i] || 0; // Above pixel
        let c = (i >= bytesPerPixel && prevScanline[i - bytesPerPixel]) ? prevScanline[i - bytesPerPixel] : 0; // Above-left pixel
        
        switch (filterType) {
        case 0: // None
            result[i] = filtered;
            break;
        case 1: // Sub
            result[i] = (filtered + a) & 0xFF;
            break;
        case 2: // Up
            result[i] = (filtered + b) & 0xFF;
            break;
        case 3: // Average
            result[i] = (filtered + Math.floor((a + b) / 2)) & 0xFF;
            break;
        case 4: // Paeth
            const p = a + b - c;
            const pa = Math.abs(p - a);
            const pb = Math.abs(p - b);
            const pc = Math.abs(p - c);
            let paeth;
            if (pa <= pb && pa <= pc) {
            paeth = a;
            } else if (pb <= pc) {
            paeth = b;
            } else {
            paeth = c;
            }
            result[i] = (filtered + paeth) & 0xFF;
            break;
        default:
            result[i] = filtered;
        }
    }

    return result;
}
