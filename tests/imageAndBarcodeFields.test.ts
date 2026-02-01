import { Label } from "@/labels"
import Image from "@/labels/fields/Image"
import BarCode from "@/labels/fields/BarCode"

jest.mock("@/helpers/ImageUtils", () => {
    return {
        __esModule: true,
        default: {
            getBWBitmap: jest.fn(),
        }
    }
})

import ImageUtils from "@/helpers/ImageUtils"

function commandStrings(label: Label) {
    return label.commandForLanguage("tspl").then(cmd => {
        const lines: string[] = []
        cmd.print((c) => lines.push(c))
        return lines
    })
}

test("Image.commandForLanguage uses BITMAP command", async () => {
    const label = new Label(50, 25)

    const image = new Image(1, 2, { width: 1, height: 1, bytes: new Uint8Array([0x41]) })
    label.add(image)

    const lines = await commandStrings(label)
    expect(lines.some(l => l.startsWith("BITMAP"))).toBe(true)
})

test("Image.create calls ImageUtils.getBWBitmap", async () => {
    ;(ImageUtils.getBWBitmap as unknown as jest.Mock).mockResolvedValue({
        width: 2,
        height: 3,
        bytes: new Uint8Array([0x00, 0x01]),
    })

    const img = await Image.create("x", 10, 20, 30, 40)
    expect(ImageUtils.getBWBitmap).toHaveBeenCalledWith("x", 30, 40)

    const label = new Label(50, 25)
    label.add(img)
    const lines = await commandStrings(label)
    expect(lines.some(l => l.startsWith("BITMAP"))).toBe(true)
})

test("BarCode.commandForLanguage generates BARCODE command and respects setters", async () => {
    const label = new Label(50, 25)

    const bc = new BarCode("ABC", 1, 2, "CODE128", 50)
    bc.setRotation(90)
    bc.setHumanReadable("center")
    label.add(bc)

    const lines = await commandStrings(label)
    const barcode = lines.find(l => l.startsWith("BARCODE"))
    expect(barcode).toBeTruthy()
    expect(barcode).toContain('"CODE128"')
    expect(barcode).toContain(',90,')
})
