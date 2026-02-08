import {
    TSPLBarCommand,
    TSPLBlockCommand,
    TSPLCLSCommand,
    TSPLDiagonal,
    TSPLDirectionCommand,
    TSPLDisplay,
    TSPLDownload,
    TSPLGapCommand,
    TSPLPrintCommand,
    TSPLQRCommand,
    TSPLSizeCommand,
    TSPLTextCommand,
} from "@/commands/tspl/commands"

import { UsbDevice } from "@/helpers/USBUtils"

import MockUSBDevice from "./mocks/MockUSBDevice"

test("TSPLPrintCommand formats PRINT", () => {
    expect(new TSPLPrintCommand(2, 3).commandString).toBe("PRINT 2, 3")
})

test("TSPLSizeCommand adds unit suffix in metric", () => {
    expect(new TSPLSizeCommand(50, 25, "metric").commandString).toBe("SIZE 50 mm, 25 mm")
})

test("TSPLGapCommand adds unit suffix in dot", () => {
    expect(new TSPLGapCommand(10, 2, "dot").commandString).toBe("GAP 10 dot, 2 dot")
})

test("TSPLDirectionCommand maps normal/inverse and mirror", () => {
    expect(new TSPLDirectionCommand("normal", false).commandString).toBe("DIRECTION 1, 0")
    expect(new TSPLDirectionCommand("inverse", true).commandString).toBe("DIRECTION 0, 1")
})

test("TSPLCLSCommand is CLS", () => {
    expect(new TSPLCLSCommand().commandString).toBe("CLS")
})

test("TSPLDisplay formats DISPLAY", () => {
    expect(new TSPLDisplay("IMAGE").commandString).toBe("DISPLAY IMAGE")
})

test("TSPLDiagonal formats DIAGONAL", () => {
    expect(new TSPLDiagonal({ x: 1, y: 2 }, { x: 3, y: 4 }, 5).commandString).toBe("DIAGONAL 1, 2, 3, 4, 5")
})

test("TSPLTextCommand formats TEXT with alignment number", () => {
    const cmd = new TSPLTextCommand("Hi", 10, 20, "0", 0, 1, 1, "left")
    expect(cmd.commandString).toBe('TEXT 10,20,"0",0,1,1,1,"Hi"')
})

test("TSPLBlockCommand formats BLOCK", () => {
    const cmd = new TSPLBlockCommand("Hello", 1, 2, 100, 50, "0", 0, 1, 1, 2, "center")
    expect(cmd.commandString).toBe('BLOCK 1,2,100, 50,"0",0,1,1,2,2,"Hello"')
})

test("TSPLBarCommand formats BAR", () => {
    expect(new TSPLBarCommand(1, 2, 3, 4).commandString).toBe("BAR 1, 2, 3, 4")
})

test("TSPLQRCommand validates mask and formats QRCODE", () => {
    expect(() => new TSPLQRCommand("DATA", 1, 2, 3, "H", "M", 0, "M2", 9)).toThrow("Invalid mask")

    const cmd = new TSPLQRCommand("DATA", 1, 2, 3, "H", "M", 0, "M2", 7)
    expect(cmd.commandString).toBe('QRCODE 1, 2, H, 3, M, 0, M2, "DATA"')
})

test("TSPLDownload writes header + bytes + terminator", async () => {
    const cmd = new TSPLDownload("F.TTF", new Uint8Array([1, 2, 3, 4]))

    const writes: any[] = []
    MockUSBDevice.writeCallback = (bytes: BufferSource) => {
        writes.push(bytes)
    }

    const device = new UsbDevice(MockUSBDevice)
    await cmd.writeTo(device)

    // Header is written via writeString, which ends up as writeData with UTF-8 bytes
    // and terminator (LF) at the end.
    expect(writes.length).toBe(3)

    // Payload bytes should be the second call
    expect(writes[1]).toEqual(new Uint8Array([1, 2, 3, 4]))
})
