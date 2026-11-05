import { UnitSystem } from "@/commands";
import { LabelDirection } from "@/commands/tspl";
import { mmToDot, inToDot } from "@/helpers/UnitUtils";
import ZPLCommand from "../../ZPLCommand";

export default class ZPLSetupCommand extends ZPLCommand {
    private readonly widthDots: number
    private readonly heightDots: number
    private readonly continuous: boolean
    private readonly direction: LabelDirection
    private readonly mirror: boolean
    private readonly darkness: number

    constructor(
        width: number,
        height: number,
        gap: number,
        offset: number,
        direction: LabelDirection,
        mirror: boolean,
        unitSystem: UnitSystem,
        density: number,
        dpi: number
    ) {
        super()
        this.widthDots = ZPLSetupCommand.toDots(width, dpi, unitSystem)
        this.heightDots = ZPLSetupCommand.toDots(height, dpi, unitSystem)
        // A gap of 0 means continuous media, as in TSPL. Printers measure the gap size during calibration
        this.continuous = gap <= 0
        this.direction = direction
        this.mirror = mirror
        // Map TSPL density (0–15) → ZPL ~SD (0 to 30), absolute darkness
        this.darkness = Math.min(30, Math.max(0, Math.round(density * 2)))
    }

    get commandString(): string {
        // ^CI28: field data is UTF-8
        const parts = [
            `~SD${String(this.darkness).padStart(2, "0")}`,
            `^XA`,
            `^CI28`,
            `^PW${Math.round(this.widthDots)}`,
            `^LL${Math.round(this.heightDots)}`,
            `^MN${this.continuous ? "N" : "Y"}`,
            `^PO${this.direction === "inverse" ? "I" : "N"}`,
        ]
        if (this.mirror) parts.push(`^PMY`)
        return parts.join("")
    }

    private static toDots(value: number, dpi: number, unitSystem: UnitSystem): number {
        switch (unitSystem) {
            case "dot": return value
            case "imperial": return inToDot(value, dpi)
            case "metric": return mmToDot(value, dpi)
        }
    }
}
