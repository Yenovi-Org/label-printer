import ZPLVisualCommand from "../ZPLVisualCommand";

export default class ZPLGraphicBoxCommand extends ZPLVisualCommand {
    private readonly width: number
    private readonly height: number
    private readonly thickness: number

    constructor(x: number, y: number, width: number, height: number, thickness: number) {
        super(x, y)
        this.thickness = Math.max(1, Math.round(thickness))
        // ^GB needs width and height of at least the thickness
        this.width = Math.max(this.thickness, Math.round(width))
        this.height = Math.max(this.thickness, Math.round(height))
    }

    get commandString(): string {
        return `^FO${this.x},${this.y}^GB${this.width},${this.height},${this.thickness},B,0^FS`
    }
}
