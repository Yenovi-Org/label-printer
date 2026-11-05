import { Rotation } from "@/commands";
import ZPLVisualCommand from "../ZPLVisualCommand";
import { encodeFieldData, rotatedOrigin } from "../../ZPLUtils";

/**
 * ^BQ only supports the normal orientation. Rotated codes scan the same, so only the anchor is adjusted.
 */
export default class ZPLQRCommand extends ZPLVisualCommand {
    private readonly content: string
    private readonly magnification: number
    private readonly rotation: Rotation
    private readonly size: number

    /**
     * @param size Expected side of the code in dots. Used to anchor rotated codes
     */
    constructor(content: string, x: number, y: number, magnification: number, rotation: Rotation = 0, size: number = 0) {
        super(x, y)
        this.content = content
        this.magnification = Math.max(1, Math.min(10, Math.round(magnification)))
        this.rotation = rotation
        this.size = size
    }

    get commandString(): string {
        const o = rotatedOrigin(this.x, this.y, this.rotation, this.size, this.size)
        // Data: error correction level (H), automatic input (A), comma, content
        return `^FO${o.x},${o.y}^BQN,2,${this.magnification},H^FH^FDHA,${encodeFieldData(this.content)}^FS`
    }
}
