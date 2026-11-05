import ZPLVisualCommand from "../ZPLVisualCommand";
import { Point } from "@/commands";

export default class ZPLGraphicDiagonalCommand extends ZPLVisualCommand {
    private readonly boxWidth: number
    private readonly boxHeight: number
    private readonly thickness: number
    private readonly orientation: "R" | "L"

    constructor(start: Point, end: Point, thickness: number) {
        const bboxX = Math.min(start.x, end.x)
        const bboxY = Math.min(start.y, end.y)
        super(bboxX, bboxY)

        this.boxWidth = Math.round(Math.abs(end.x - start.x))
        this.boxHeight = Math.round(Math.abs(end.y - start.y))
        this.thickness = Math.max(1, Math.round(thickness))

        // ZPL: L leans like \ (top-left to bottom-right), R leans like / (bottom-left to top-right)
        const goesRightDown = (start.x <= end.x && start.y <= end.y) || (start.x >= end.x && start.y >= end.y)
        this.orientation = goesRightDown ? "L" : "R"
    }

    get commandString(): string {
        return `^FO${this.x},${this.y}^GD${this.boxWidth},${this.boxHeight},${this.thickness},B,${this.orientation}^FS`
    }
}
