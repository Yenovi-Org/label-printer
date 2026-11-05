import { Rotation } from "@/commands";
import ZPLVisualCommand from "../ZPLVisualCommand";
import { encodeFieldData, rotatedOrigin, rotationToZPL } from "../../ZPLUtils";

export default class ZPLCustomFontTextCommand extends ZPLVisualCommand {
    private readonly content: string
    private readonly fontFile: string
    private readonly size: number
    private readonly rotation: Rotation
    private readonly width?: number

    /**
     * @param fontFile Alias of a font uploaded with ZPLDownloadCommand, like "f0.TTF"
     * @param size Height of the text in dots
     * @param width Width of the text in dots. Needed to anchor 180° and 270° rotated text
     */
    constructor(content: string, x: number, y: number, fontFile: string, size: number, rotation: Rotation = 0, width?: number) {
        super(x, y)
        this.content = content
        this.fontFile = fontFile
        this.size = Math.max(10, Math.round(size))
        this.rotation = rotation
        this.width = width
    }

    get commandString(): string {
        const rot = rotationToZPL(this.rotation)
        const o = rotatedOrigin(this.x, this.y, this.rotation, this.width ?? 0, this.size)
        return `^FO${o.x},${o.y}^A@${rot},${this.size},${this.size},R:${this.fontFile}^FH^FD${encodeFieldData(this.content)}^FS`
    }
}
