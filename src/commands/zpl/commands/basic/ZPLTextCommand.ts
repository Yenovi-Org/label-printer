import { Rotation } from "@/commands";
import ZPLVisualCommand from "../ZPLVisualCommand";
import { rotationToZPL, textField } from "../../ZPLUtils";

// The scalable font accepts 10 to 32000 dots
const MIN_SIZE = 10
const MAX_SIZE = 32000

export default class ZPLTextCommand extends ZPLVisualCommand {
    private readonly content: string
    private readonly size: number
    private readonly rotation: Rotation
    private readonly width?: number

    /**
     * @param size Height of the text in dots
     * @param width Width of the text in dots. Needed to anchor 180° and 270° rotated text
     */
    constructor(content: string, x: number, y: number, size: number, rotation: Rotation = 0, width?: number) {
        super(x, y)
        this.content = content
        this.size = Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(size)))
        this.rotation = rotation
        this.width = width
    }

    get commandString(): string {
        const font = `^A0${ZPLTextCommand.rotationToZPL(this.rotation)},${this.size},${this.size}`
        return textField(this.x, this.y, this.rotation, this.size, this.width, font, this.content)
    }

    static rotationToZPL(rotation: Rotation): string {
        return rotationToZPL(rotation)
    }
}
