import * as fs from "fs"
import ImageUtils from "@/helpers/ImageUtils"
import { Label, Text, Line, Image, BarCode, QRCode } from "@/labels"
import { BarcodeType } from "@/commands/tspl"
import { Rotation } from "@/commands"
import { LabelOrientation } from "@/labels/types"

/**
 * Hardware test set for the ZPL implementation. All labels are 100 x 60 mm (800 x 480 dots at 203 dpi).
 * Print them with a 4 x 2.4 inch label and compare with the expected result in the comments.
 *
 *  1. Text and lines  – fonts, special characters, rotation anchors, lines
 *  2. Barcodes        – every supported symbology, human readable line, rotation
 *  3. QR and images   – QR sizes, image at all rotations
 *  4. Label 1 again, printed with the whole label rotated (container rotation)
 *
 * Run `PrinterService.printToFile` first to inspect the generated ZPL (see index.ts), then print with a printer.
 */

const ROTATIONS: Rotation[] = [0, 90, 180, 270]

const font = (file: string) => fs.readFileSync(__dirname + "/../" + file).buffer as ArrayBuffer

/** Small cross marking an anchor point, so the position of rotated fields can be checked by eye */
const cross = (x: number, y: number): Line[] => [
    new Line({ x: x - 8, y }, { x: x + 8, y }, 1),
    new Line({ x, y: y - 8 }, { x, y: y + 8 }, 1),
]

async function registerFonts(label: Label) {
    await label.registerFont({ name: "Roboto", data: font("Roboto-Regular.ttf"), weight: 400, style: "normal" })
    await label.registerFont({ name: "Roboto", data: font("Roboto-Bold.ttf"), weight: 700, style: "normal" })
    await label.registerFont({ name: "Roboto", data: font("Roboto-Italic.ttf"), weight: 400, style: "italic" })
}

/**
 * Expected: header in bold Roboto (uploaded TTF, ~DY + ^A@), same text in the printer font (^A0), a line with
 * ^ ~ _ and accented characters printed literally, a wrapped paragraph with bold/italic/underline/strike,
 * four rotated words (each starts at its cross, reading right, down, left, up), a frame, a thick bar
 * and two diagonals: one "\" and one "/".
 */
async function textAndLinesLabel(orientation: LabelOrientation = "normal"): Promise<Label> {
    const label = new Label(100, 60)
    await registerFonts(label)

    const header = new Text("<b>ZPL text test</b>", 10, 10)
    header.setFont({ name: "Roboto", size: 14 })

    const printerFont = new Text("Printer font ^A0 (size 10)", 10, 40)
    printerFont.setFont({ name: "default", size: 10 })

    const special = new Text("Special: ^ ~ _ \\ é ő ű ß € ÄÖÜ", 10, 62)
    special.setFont({ name: "Roboto", size: 10 })

    const paragraph = new Text("<b>Bold</b> <i>italic</i> <u>underline</u> <s>strike</s> and a long sentence that has to wrap into more lines", 10, 85)
    paragraph.setFont({ name: "Roboto", size: 9 })
    paragraph.setMultiLine(300)

    // Rotated words around their anchors, custom font and printer font
    const anchors: Array<[number, number]> = [[420, 30], [700, 80], [760, 200], [560, 200]]
    const rotated = ROTATIONS.map((rotation, i) => {
        const [x, y] = anchors[i]
        const t = new Text(`Rot ${rotation}`, x, y)
        t.setFont({ name: i % 2 === 0 ? "Roboto" : "default", size: 12 })
        t.setRotation(rotation)
        return t
    })

    const lines = [
        new Line({ x: 10, y: 440 }, { x: 790, y: 440 }, 1),   // horizontal
        new Line({ x: 10, y: 450 }, { x: 790, y: 450 }, 6),   // thick horizontal
        new Line({ x: 400, y: 120 }, { x: 400, y: 330 }, 2),  // vertical
        new Line({ x: 420, y: 250 }, { x: 520, y: 330 }, 3),  // "\" going right-down
        new Line({ x: 540, y: 330 }, { x: 640, y: 250 }, 3),  // "/" going right-up
        new Line({ x: 700, y: 260 }, { x: 650, y: 330 }, 3),  // "/" given right-to-left
    ]

    label.add(header, printerFont, special, paragraph, ...rotated, ...lines, ...anchors.flatMap(([x, y]) => cross(x, y)))
    label.setOrientation(orientation)
    return label
}

/**
 * Expected: each row has its name on the left and a scannable code of the same value. The EAN-13 is given
 * with the check digit (it is cut and recalculated by the printer). The last row is Code 128 rotated by
 * 90 and 270 degrees and must start at its cross.
 */
async function barcodesLabel(): Promise<Label> {
    const label = new Label(100, 60)
    const types: Array<[BarcodeType, string]> = [
        ["128", "ZPL-128"],
        ["EAN13", "5901234123457"],
        ["EAN8", "96385074"],
        ["UPCA", "036000291452"],
        ["39", "CODE39"],
        ["93", "CODE93"],
        ["25", "123456"],
        ["ITF14", "12345678901231"],
        ["CODA", "A123456A"],
        ["MSI", "1234567"],
        ["EAN128", "(01)09501101530003"],
    ]

    types.forEach(([type, value], i) => {
        const column = Math.floor(i / 6)
        const row = i % 6
        const x = 10 + column * 400
        const y = 10 + row * 70

        const name = new Text(type, x, y)
        name.setFont({ name: "default", size: 7 })

        const code = new BarCode(value, x + 80, y, type, 35, 2)
        code.setHumanReadable(i % 2 === 0 ? "center" : "none")
        label.add(name, code)
    })

    const rotate90 = new BarCode("ROT90", 440, 440, "128", 35, 2)
    rotate90.setRotation(90)
    rotate90.setHumanReadable("center")
    const rotate270 = new BarCode("ROT270", 540, 440, "128", 35, 2)
    rotate270.setRotation(270)
    rotate270.setHumanReadable("center")
    const rotate180 = new BarCode("ROT180", 700, 440, "128", 35, 2)
    rotate180.setRotation(180)
    rotate180.setHumanReadable("none")

    label.add(rotate90, rotate270, rotate180, ...cross(440, 440), ...cross(540, 440), ...cross(700, 440))
    return label
}

/**
 * Expected: a short and a long QR that both scan (content is printed under them), a QR that must not
 * overlap its neighbour, and the arrow image four times, pointing right, down, left, up (anchored at the cross).
 */
async function qrAndImagesLabel(): Promise<Label> {
    const label = new Label(100, 60)

    const short = new QRCode("https://yenovi.com", 10, 10, 120)
    const long = new QRCode("https://yenovi.com/label-printer/zpl?test=a-much-longer-url-to-force-a-larger-code&x=123456789", 160, 10, 160)
    const rotatedQR = new QRCode("rotated-90", 700, 100, 100)
    rotatedQR.setRotation(90)

    const caption = new Text("Scan: yenovi.com / long url / rotated-90", 10, 180)
    caption.setFont({ name: "default", size: 8 })

    const arrowSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60">
        <rect width="60" height="60" fill="white"/>
        <polygon points="30,5 55,30 30,55 30,40 5,40 5,20 30,20" fill="black"/>
    </svg>`
    const bitmap = await ImageUtils.getBWBitmap(arrowSvg, 60, 60)
    const anchors: Array<[number, number]> = [[100, 300], [300, 300], [500, 300], [700, 300]]
    const images = ROTATIONS.map((rotation, i) => {
        const image = new Image(anchors[i][0], anchors[i][1], bitmap)
        image.setRotation(rotation)
        return image
    })

    label.add(short, long, rotatedQR, caption, ...images, ...anchors.flatMap(([x, y]) => cross(x, y)))
    return label
}

export default async (): Promise<Label[]> => [
    await textAndLinesLabel(),
    await barcodesLabel(),
    await qrAndImagesLabel(),
    await textAndLinesLabel("right"),
]
