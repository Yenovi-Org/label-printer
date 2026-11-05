import * as fs from "fs"
import ImageUtils from "@/helpers/ImageUtils"
import { Label, Text, Line, Image, BarCode, QRCode } from "@/labels"
import { BarcodeType } from "@/commands/tspl"
import { Rotation } from "@/commands"
import { LabelOrientation } from "@/labels/types"

/**
 * Hardware test set for the ZPL implementation. All labels are 70 x 30 mm (about 560 x 240 dots at 203 dpi).
 * Print them and compare with the expected result in the comments.
 *
 *  1. Text and lines   – fonts, special characters, rotation anchors, lines
 *  2. Barcodes         – every supported symbology, human readable line
 *  3. Barcode rotation – Code 128 and EAN-13 at all rotations
 *  4. QR and images    – QR sizes, image at all rotations
 *  5. Label 1 again without lines, printed with the whole label rotated (container rotation).
 *     Lines don't follow the container rotation (also for TSPL), so they are left out
 *
 * Use it from examples/node/index.ts with PrinterService.connectZPL and displayOverPrint = false.
 */

const ROTATIONS: Rotation[] = [0, 90, 180, 270]

const font = (file: string) => fs.readFileSync(__dirname + "/../" + file).buffer as ArrayBuffer

/** Small cross marking an anchor point, so the position of rotated fields can be checked by eye */
const cross = (x: number, y: number): Line[] => [
    new Line({ x: x - 6, y }, { x: x + 6, y }, 1),
    new Line({ x, y: y - 6 }, { x, y: y + 6 }, 1),
]

async function registerFonts(label: Label) {
    await label.registerFont({ name: "Roboto", data: font("Roboto-Regular.ttf"), weight: 400, style: "normal" })
    await label.registerFont({ name: "Roboto", data: font("Roboto-Bold.ttf"), weight: 700, style: "normal" })
    await label.registerFont({ name: "Roboto", data: font("Roboto-Italic.ttf"), weight: 400, style: "italic" })
}

/**
 * Expected: header in bold Roboto (uploaded TTF, ~DY + ^A@), a line in the printer font (^A0), a line with
 * ^ ~ _ \ and accented characters printed literally, a wrapped paragraph with bold/italic/underline/strike.
 * On the right four rotated words (each starts at its cross, reading right, down, left, up), a vertical line,
 * and three diagonals: "\", "/" and a second "/" given right-to-left. Two horizontal lines at the bottom.
 */
async function textAndLinesLabel(orientation: LabelOrientation = "normal", withLines: boolean = true): Promise<Label> {
    const label = new Label(70, 30)
    await registerFonts(label)

    const header = new Text("<b>ZPL text test</b>", 8, 6)
    header.setFont({ name: "Roboto", size: 12 })

    const printerFont = new Text("Printer font ^A0 (size 8)", 8, 30)
    printerFont.setFont({ name: "default", size: 8 })

    const special = new Text("Special: ^ ~ _ \\ é ő ű ß € ÄÖÜ", 8, 50)
    special.setFont({ name: "Roboto", size: 8 })

    const paragraph = new Text("<b>Bold</b> <i>italic</i> <u>underline</u> <s>strike</s> and a long sentence that has to wrap", 8, 72)
    paragraph.setFont({ name: "Roboto", size: 7 })
    paragraph.setMultiLine(250)

    // Rotated words around their anchors, custom font and printer font alternating
    const anchors: Array<[number, number]> = [[290, 15], [400, 40], [540, 130], [440, 200]]
    const rotated = ROTATIONS.map((rotation, i) => {
        const [x, y] = anchors[i]
        const t = new Text(`Rot ${rotation}`, x, y)
        t.setFont({ name: i % 2 === 0 ? "Roboto" : "default", size: 9 })
        t.setRotation(rotation)
        return t
    })

    const lines = [
        new Line({ x: 8, y: 222 }, { x: 552, y: 222 }, 1),    // horizontal
        new Line({ x: 8, y: 228 }, { x: 552, y: 228 }, 4),    // thick horizontal
        new Line({ x: 270, y: 10 }, { x: 270, y: 210 }, 2),   // vertical
        new Line({ x: 285, y: 150 }, { x: 335, y: 200 }, 3),  // "\" going right-down
        new Line({ x: 350, y: 200 }, { x: 400, y: 150 }, 3),  // "/" going right-up
        new Line({ x: 545, y: 205 }, { x: 500, y: 150 }, 3),  // "/" given right-to-left
    ]

    label.add(header, printerFont, special, paragraph, ...rotated)
    if (withLines) label.add(...lines, ...anchors.flatMap(([x, y]) => cross(x, y)))
    label.setOrientation(orientation)
    return label
}

/**
 * Expected: each code has its name on the left and scans as the value in the comment. Every second code
 * has a human readable line. The EAN-13 and UPC-A are given with the check digit (cut and recalculated by
 * the printer). The EAN-128 must decode with its application identifier (01).
 */
async function barcodesLabel(): Promise<Label> {
    const label = new Label(70, 30)
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
        const x = 8 + column * 282
        const y = 6 + row * 38

        const name = new Text(type, x, y)
        name.setFont({ name: "default", size: 6 })

        const code = new BarCode(value, x + 48, y, type, 22, 1)
        code.setHumanReadable(i % 2 === 0 ? "center" : "none")
        label.add(name, code)
    })

    return label
}

/**
 * Expected: each code starts at its cross and extends in the direction of its rotation (right, down, left, up).
 * The rotated codes must all scan. 180 has no human readable line, the others do.
 */
async function barcodeRotationLabel(): Promise<Label> {
    const label = new Label(70, 30)

    const at = (content: string, type: BarcodeType, x: number, y: number, rotation: Rotation, hr: "none" | "center") => {
        const code = new BarCode(content, x, y, type, 25, 1)
        code.setRotation(rotation)
        code.setHumanReadable(hr)
        label.add(code, ...cross(x, y))
    }

    at("ROT0", "128", 20, 30, 0, "center")
    at("ROT90", "128", 200, 40, 90, "center")
    at("ROT180", "128", 400, 60, 180, "none")
    at("ROT270", "128", 470, 130, 270, "center")
    at("5901234123457", "EAN13", 20, 150, 0, "center")
    at("5901234123457", "EAN13", 300, 120, 90, "center")
    return label
}

/**
 * Expected: a short and a long QR that both scan (the caption lists the contents), a QR rotated by 90
 * that still scans, and the arrow image four times, pointing right, down, left, up (anchored at the cross).
 */
async function qrAndImagesLabel(): Promise<Label> {
    const label = new Label(70, 30)

    const short = new QRCode("https://yenovi.com", 8, 8, 80)
    const long = new QRCode("https://yenovi.com/label-printer/zpl?test=a-much-longer-url-to-force-a-larger-code&x=123456789", 100, 8, 110)
    const rotatedQR = new QRCode("rotated-90", 330, 60, 70)
    rotatedQR.setRotation(90)

    const caption = new Text("Scan: yenovi.com / long url / rotated-90", 8, 125)
    caption.setFont({ name: "default", size: 7 })

    const arrowSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60">
        <rect width="60" height="60" fill="white"/>
        <polygon points="30,5 55,30 30,55 30,40 5,40 5,20 30,20" fill="black"/>
    </svg>`
    const bitmap = await ImageUtils.getBWBitmap(arrowSvg, 60, 60)
    const anchors: Array<[number, number]> = [[20, 160], [150, 160], [260, 230], [300, 225]]
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
    await barcodeRotationLabel(),
    await qrAndImagesLabel(),
    await textAndLinesLabel("right", false),
]
