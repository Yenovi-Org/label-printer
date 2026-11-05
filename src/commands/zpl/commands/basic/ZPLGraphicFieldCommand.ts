import { BitmapLike } from "@/helpers/ImageUtils";
import ZPLVisualCommand from "../ZPLVisualCommand";

export default class ZPLGraphicFieldCommand extends ZPLVisualCommand {
    private readonly bitmap: BitmapLike

    constructor(bitmap: BitmapLike, x: number, y: number) {
        super(x, y)
        this.bitmap = bitmap
    }

    get commandString(): string {
        const rowBytes = this.bitmap.width
        const total = rowBytes * this.bitmap.height
        const hexData = ZPLGraphicFieldCommand.toInvertedHex(this.bitmap.bytes)
        return `^FO${this.x},${this.y}^GFA,${total},${total},${rowBytes},${hexData}^FS`
    }

    /**
     * Converts BWBitmap bytes to ZPL hex format.
     * BWBitmap uses 0=black, 1=white; ZPL ^GF uses 1=black, 0=white — so each byte is inverted.
     */
    private static toInvertedHex(bytes: Uint8Array): string {
        let hex = ""
        for (let i = 0; i < bytes.length; i++) {
            hex += ((bytes[i] ^ 0xFF) & 0xFF).toString(16).padStart(2, "0").toUpperCase()
        }
        return hex
    }
}
