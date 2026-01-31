import tsplGenerator from "@/commands/tspl/TSPLCommandGenerator"
import { TSPLBitmapCommand } from "@/commands/tspl/commands"
import TSPLBarcodeCommand from "@/commands/tspl/commands/basic/TSPLBarcodeCommand"
import { UsbDevice } from "@/helpers/USBUtils"
import MockUSBDevice from "./mocks/MockUSBDevice"

jest.mock("@/helpers/ImageUtils", () => {
    return {
        __esModule: true,
        default: {
            getBWBitmap: jest.fn(),
        }
    }
})

import ImageUtils from "@/helpers/ImageUtils"

test("TSPLCommandGenerator.qrCode picks cell width based on mapping", () => {
    const cmd = tsplGenerator.qrCode("HELLO", 210, 1, 2)
    // content length 5 => mapping 10 -> 21 cells => cellWidth = 210/21 = 10
    expect(cmd.commandString).toContain("QRCODE 1, 2")
    expect(cmd.commandString).toContain(", 10, ")
    expect(cmd.commandString).toContain('"AHELLO"')
})

test("TSPLCommandGenerator.setUp groups SIZE/GAP/DIRECTION/CLS", () => {
    const cmd = tsplGenerator.setUp(50, 25, 2, 0, "normal", false, "metric")
    const lines: string[] = []
    cmd.print((c) => lines.push(c))

    expect(lines).toEqual([
        "SIZE 50 mm, 25 mm",
        "GAP 2 mm, 0 mm",
        "DIRECTION 1, 0",
        "CLS",
    ])
})

test("TSPLBarcodeCommand formats BARCODE with correct HR/alignment numbers", () => {
    const cmd = new TSPLBarcodeCommand(1, 2, "CODE128", 100, 1, 2, "ABC", 90, "center", "right")
    expect(cmd.commandString).toBe('BARCODE 1, 2, "CODE128", 100, 2,90, 1, 2,3, "ABC"')
})

test("TSPLBitmapCommand writes header + bytes + terminator and supports mode values", async () => {
    const bitmap = {
        width: 1,
        height: 1,
        bytes: new Uint8Array([0x41, 0x42, 0x43]),
    }

    const cmd = new TSPLBitmapCommand(bitmap, 10, 20, "xor")
    expect(cmd.commandString).toContain("BITMAP 10, 20,1,1,2,")

    const writes: any[] = []
    MockUSBDevice.writeCallback = (bytes: BufferSource) => {
        writes.push(bytes)
    }

    const device = new UsbDevice(MockUSBDevice)
    await cmd.write(device)

    expect(writes.length).toBe(3)
    expect(writes[1]).toEqual(new Uint8Array([0x41, 0x42, 0x43]))
})

test("TSPLBitmapCommand.forImageUrl calls ImageUtils.getBWBitmap", async () => {
    ;(ImageUtils.getBWBitmap as unknown as jest.Mock).mockResolvedValue({
        width: 1,
        height: 1,
        bytes: new Uint8Array([0x00]),
    })

    const cmd = await TSPLBitmapCommand.forImageUrl("x", 1, 2, 3, 4, "or")
    expect(ImageUtils.getBWBitmap).toHaveBeenCalledWith("x", 3, 4)
    expect(cmd.commandString).toContain("BITMAP 1, 2,1,1,1,")
})
