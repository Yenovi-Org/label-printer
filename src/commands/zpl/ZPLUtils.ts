import { Rotation } from "@/commands"

const HEX_INDICATOR = "_"
const RESERVED = new Set(["^", "~", HEX_INDICATOR])

/**
 * Encodes content for a field sent with ^FH. Characters that ZPL would interpret (^ starts a command, ~ a control
 * command, _ is the hex indicator) and non ASCII characters are sent as hex encoded UTF-8 bytes (_XX).
 * The label format selects UTF-8 with ^CI28.
 * @param inBlock Field is inside a ^FB block, where a backslash starts an escape sequence
 */
export function encodeFieldData(content: string, inBlock: boolean = false): string {
    const encoder = new TextEncoder()
    let result = ""
    for (const char of content) {
        const cp = char.codePointAt(0)!
        if (cp < 0x20 || cp === 0x7f) {
            // Control characters can't be printed in a single line field
            result += " "
        } else if (char === "\\" && inBlock) {
            result += "\\\\"
        } else if (cp <= 0x7e && !RESERVED.has(char)) {
            result += char
        } else {
            encoder.encode(char).forEach(b => {
                result += HEX_INDICATOR + b.toString(16).padStart(2, "0").toUpperCase()
            })
        }
    }
    return result
}

export function rotationToZPL(rotation: Rotation): "N" | "R" | "I" | "B" {
    switch (rotation) {
        case 90: return "R"
        case 180: return "I"
        case 270: return "B"
        default: return "N"
    }
}

/**
 * TSPL rotates a field around its x,y anchor. ZPL rotates the field and places the upper-left corner of the
 * rotated field at ^FO. Fields are treated as boxes: `length` runs along the text (or the bars), `thickness`
 * across it. The anchor sits at `offset` along the length.
 * @returns Upper-left corner of the rotated box. ZPL doesn't accept negative coordinates, so they are clamped
 */
export function rotatedOrigin(x: number, y: number, rotation: Rotation, length: number, thickness: number, offset: number = 0): { x: number, y: number } {
    let ox: number
    let oy: number
    switch (rotation) {
        case 90:  ox = x - thickness;         oy = y - offset; break
        case 180: ox = x - (length - offset); oy = y - thickness; break
        case 270: ox = x;                     oy = y - (length - offset); break
        default:  ox = x - offset;            oy = y
    }
    return { x: Math.max(0, Math.round(ox)), y: Math.max(0, Math.round(oy)) }
}

/**
 * Builds a one line text field. `font` is the font command (^A0.. or ^A@..).
 *
 * Text rotated by 180° or 270° has to be anchored at its end, which needs its width. Estimated widths are never exact,
 * so the text goes into a left justified one line field block (^FB) that is wider than the text. The text starts at
 * the start of the block, so a wrong estimate doesn't move it. The extra height keeps it from wrapping.
 */
export function textField(x: number, y: number, rotation: Rotation, size: number, width: number | undefined, font: string, content: string): string {
    if ((rotation === 180 || rotation === 270) && width !== undefined) {
        const length = Math.min(9999, Math.max(1, Math.ceil(width + size)))
        const o = rotatedOrigin(x, y, rotation, length, size)
        return `^FO${o.x},${o.y}${font}^FB${length},1,0,L^FH^FD${encodeFieldData(content, true)}^FS`
    }
    const o = rotatedOrigin(x, y, rotation, 0, size)
    return `^FO${o.x},${o.y}${font}^FH^FD${encodeFieldData(content)}^FS`
}
