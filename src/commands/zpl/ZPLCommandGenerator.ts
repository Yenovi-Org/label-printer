import { BitmapLike } from "@/helpers/ImageUtils";
import { Point, UnitSystem } from "..";
import CommandGenerator from "../CommandGenerator";
import ZPLCommand from "./ZPLCommand";
import {
    ZPLCommandGroup,
    ZPLSetupCommand,
    ZPLPrintCommand,
    ZPLTextCommand,
    ZPLCustomFontTextCommand,
    ZPLGraphicBoxCommand,
    ZPLGraphicDiagonalCommand,
    ZPLGraphicFieldCommand,
    ZPLBarcodeCommand,
    ZPLQRCommand,
    ZPLDownloadCommand,
} from "./commands";
import { Alignment, BarcodeHumanReable, BarcodeType, GraphicMode, LabelDirection } from "../tspl";
import { Rotation } from "@/commands";
import { pointsToDots } from "@/helpers/UnitUtils";
import { QRLengthMapping } from "@/helpers/QRCodeUtils";

class ZPLCommandGenerator implements CommandGenerator<ZPLCommand> {
    private readonly dpi: number

    constructor(dpi: number = 203) {
        this.dpi = dpi
    }

    get textWidthCorrectionFactor(): number | undefined {
        return undefined
    }

    commandGroup(commands: ZPLCommand[]): ZPLCommandGroup {
        return new ZPLCommandGroup(commands)
    }

    print(sets: number, copiesPerSet: number): ZPLCommand {
        return new ZPLPrintCommand(sets, copiesPerSet)
    }

    text(content: string, x: number, y: number, font: string | "default", size: number, rotation?: Rotation, width?: number): ZPLCommand {
        // The label gives the size in points, ZPL works in dots
        const sizeInDots = pointsToDots(size, this.dpi)
        if (font === "default") {
            return new ZPLTextCommand(content, x, y, sizeInDots, rotation ?? 0, width)
        }
        return new ZPLCustomFontTextCommand(content, x, y, font, sizeInDots, rotation ?? 0, width)
    }

    upload(name: string, data: ArrayBuffer | Uint8Array): ZPLCommand {
        return new ZPLDownloadCommand(name, data)
    }

    setUp(
        width: number,
        height: number,
        gap: number,
        offset: number,
        direction: LabelDirection,
        mirror: boolean,
        unitSystem: UnitSystem,
        density: number
    ): ZPLCommand {
        return new ZPLSetupCommand(width, height, gap, offset, direction, mirror, unitSystem, density, this.dpi)
    }

    display(): ZPLCommand {
        throw new Error("Operation not supported: ZPL printers cannot display a label on their screen")
    }

    line(start: Point, end: Point, thickness: number): ZPLCommand {
        if (start.x === end.x) {
            const y = Math.min(start.y, end.y)
            const height = Math.abs(end.y - start.y)
            return new ZPLGraphicBoxCommand(start.x, y, thickness, height, thickness)
        }
        if (start.y === end.y) {
            const x = Math.min(start.x, end.x)
            const width = Math.abs(end.x - start.x)
            return new ZPLGraphicBoxCommand(x, start.y, width, thickness, thickness)
        }
        return new ZPLGraphicDiagonalCommand(start, end, thickness)
    }

    image(image: BitmapLike, x: number, y: number, _mode?: GraphicMode): ZPLCommand {
        return new ZPLGraphicFieldCommand(image, x, y)
    }

    qrCode(content: string, width: number, x: number, y: number, rotation?: Rotation): ZPLCommand {
        const cellCount = this.cellCount(content)
        const magnification = Math.max(1, Math.min(10, Math.round(width / cellCount)))
        return new ZPLQRCommand(content, x, y, magnification, rotation ?? 0, cellCount * magnification)
    }

    barCode(
        content: string,
        x: number,
        y: number,
        type: BarcodeType,
        height: number,
        rotation: Rotation,
        humanReadable: BarcodeHumanReable,
        _alignment: Alignment,
        barWidth: number = 2
    ): ZPLCommand {
        return new ZPLBarcodeCommand(content, x, y, type, height, rotation, humanReadable, barWidth)
    }

    private cellCount(content: string): number {
        const limits = Object.keys(QRLengthMapping).map(limit => Number(limit)).sort((a, b) => a - b)
        const contentLength = content.length

        let i = 0
        while (limits[i] < contentLength && i < limits.length - 1) {
            i++
        }

        return QRLengthMapping[limits[i] as keyof typeof QRLengthMapping]
    }
}

export { ZPLCommandGenerator }
export default new ZPLCommandGenerator()
