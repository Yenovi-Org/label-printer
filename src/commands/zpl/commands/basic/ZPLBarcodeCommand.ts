import { Rotation } from "@/commands";
import { BarcodeHumanReable, BarcodeType } from "@/commands/tspl";
import ZPLVisualCommand from "../ZPLVisualCommand";
import { encodeFieldData, rotatedOrigin, rotationToZPL } from "../../ZPLUtils";

type Symbology = {
    /** Width of the code in modules when fixed. Needed to anchor rotated codes */
    modules?: number
    /** Number of digits ZPL expects. The printer calculates the check digit, so longer data is cut on the right */
    dataLength?: number
    /** Wide to narrow ratio. Only variable ratio symbologies use it */
    ratio?: number
    format: (o: string, h: number, f: string) => string
}

const CODE128: Symbology = { format: (o, h, f) => `^BC${o},${h},${f},N,N` }

const SYMBOLOGIES: Partial<Record<BarcodeType, Symbology>> = {
    "128": CODE128,
    // GS1-128: mode D accepts application identifiers
    "EAN128": { format: (o, h, f) => `^BC${o},${h},${f},N,N,D` },
    "EAN13": { modules: 95, dataLength: 12, format: (o, h, f) => `^BE${o},${h},${f},N` },
    "EAN8": { modules: 67, dataLength: 7, format: (o, h, f) => `^B8${o},${h},${f},N` },
    "UPCA": { modules: 95, dataLength: 11, format: (o, h, f) => `^BU${o},${h},${f},N,Y` },
    "UPCE": { modules: 51, format: (o, h, f) => `^B9${o},${h},${f},N,Y` },
    "39": { ratio: 3, format: (o, h, f) => `^B3${o},N,${h},${f},N` },
    "39C": { ratio: 3, format: (o, h, f) => `^B3${o},Y,${h},${f},N` },
    "93": { format: (o, h, f) => `^BA${o},${h},${f},N,N` },
    "25": { ratio: 3, format: (o, h, f) => `^B2${o},${h},${f},N,N` },
    "25C": { ratio: 3, format: (o, h, f) => `^B2${o},${h},${f},N,Y` },
    "ITF14": { ratio: 3, format: (o, h, f) => `^B2${o},${h},${f},N,N` },
    "CODA": { ratio: 3, format: (o, h, f) => `^BK${o},N,${h},${f},N` },
    "MSI": { ratio: 3, format: (o, h, f) => `^BM${o},B,${h},${f},N` },
    "MSIC": { ratio: 3, format: (o, h, f) => `^BM${o},A,${h},${f},N` },
    "PLESSEY": { ratio: 3, format: (o, h, f) => `^BP${o},N,${h},${f},N` },
    "11": { ratio: 3, format: (o, h, f) => `^B1${o},N,${h},${f},N` },
}

// Add-on digits (+2, +5) aren't supported, the base code is printed
const BASE_TYPES: Partial<Record<BarcodeType, BarcodeType>> = {
    "EAN13+2": "EAN13", "EAN13+5": "EAN13",
    "EAN8+2": "EAN8", "EAN8+5": "EAN8",
    "UPCA+2": "UPCA", "UPCA+5": "UPCA",
    "UPCE+2": "UPCE", "UPCE+5": "UPCE",
}

// Estimated height of the human readable line per module width. Used to anchor rotated codes
const INTERPRETATION_DOTS_PER_MODULE = 10

export default class ZPLBarcodeCommand extends ZPLVisualCommand {
    private readonly content: string
    private readonly type: BarcodeType
    private readonly height: number
    private readonly rotation: Rotation
    private readonly humanReadable: boolean
    private readonly barWidth: number

    constructor(
        content: string,
        x: number,
        y: number,
        type: BarcodeType,
        height: number,
        rotation: Rotation,
        humanReadable: BarcodeHumanReable,
        barWidth: number
    ) {
        super(x, y)
        this.content = content
        this.type = type
        this.height = Math.max(1, Math.round(height))
        this.rotation = rotation
        this.humanReadable = humanReadable !== "none"
        this.barWidth = Math.min(10, Math.max(1, Math.round(barWidth)))
    }

    get commandString(): string {
        const symbology = SYMBOLOGIES[BASE_TYPES[this.type] ?? this.type] ?? CODE128
        const rot = rotationToZPL(this.rotation)
        const hr = this.humanReadable ? "Y" : "N"

        const data = symbology.dataLength !== undefined && this.content.length > symbology.dataLength
            ? this.content.substring(0, symbology.dataLength)
            : this.content

        const ratio = (symbology.ratio ?? 2).toFixed(1)
        const body = `^BY${this.barWidth},${ratio},${this.height}${symbology.format(rot, this.height, hr)}^FH^FD${encodeFieldData(data)}^FS`

        // ^FO is the upper-left corner of the rotated box, so it needs the length of the code. That is only known for
        // fixed width symbologies, and 0° and 90° don't need it. ^FT is fixed to the content (start of the bars) whatever
        // the rotation, so it is used for 180° and 270°. It sits at the bottom of the bars in the direction of the code
        if (this.rotation === 180) return `^FT${Math.max(0, Math.round(this.x))},${Math.max(0, Math.round(this.y - this.height))}${body}`
        if (this.rotation === 270) return `^FT${Math.max(0, Math.round(this.x + this.height))},${Math.max(0, Math.round(this.y))}${body}`

        const length = (symbology.modules ?? 0) * this.barWidth
        const thickness = this.height + (this.humanReadable ? INTERPRETATION_DOTS_PER_MODULE * this.barWidth : 0)
        const o = rotatedOrigin(this.x, this.y, this.rotation, length, thickness)
        return `^FO${o.x},${o.y}${body}`
    }
}
