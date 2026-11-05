import {
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
} from "@/commands/zpl/commands"

// ── Setup ──────────────────────────────────────────────────────────────────

test("ZPLSetupCommand opens label format with ^XA and ^PW/^LL in dots", () => {
    const cmd = new ZPLSetupCommand(50, 30, 2, 0, "normal", false, "metric", 8, 203)
    const str = cmd.commandString
    expect(str).toContain("^XA")
    expect(str).toContain("^PW")
    expect(str).toContain("^LL")
    expect(str).toContain("^PON")
})

test("ZPLSetupCommand converts mm to dots (203 dpi)", () => {
    // 25.4mm = 1 inch = 203 dots
    const cmd = new ZPLSetupCommand(25.4, 25.4, 2, 0, "normal", false, "metric", 8, 203)
    expect(cmd.commandString).toContain("^PW203")
    expect(cmd.commandString).toContain("^LL203")
})

test("ZPLSetupCommand uses dot values as-is for 'dot' unit system", () => {
    const cmd = new ZPLSetupCommand(400, 300, 2, 0, "normal", false, "dot", 8, 203)
    expect(cmd.commandString).toContain("^PW400")
    expect(cmd.commandString).toContain("^LL300")
})

test("ZPLSetupCommand maps inverse direction to ^POI", () => {
    const cmd = new ZPLSetupCommand(50, 30, 2, 0, "inverse", false, "metric", 8, 203)
    expect(cmd.commandString).toContain("^POI")
})

test("ZPLSetupCommand maps mirror to ^PMY and keeps the print orientation", () => {
    const cmd = new ZPLSetupCommand(50, 30, 2, 0, "normal", true, "metric", 8, 203)
    expect(cmd.commandString).toContain("^PMY")
    expect(cmd.commandString).toContain("^PON")
})

test("ZPLSetupCommand selects UTF-8 with ^CI28", () => {
    expect(new ZPLSetupCommand(50, 30, 2, 0, "normal", false, "metric", 8, 203).commandString).toContain("^CI28")
})

test("ZPLSetupCommand sets media tracking from the gap", () => {
    expect(new ZPLSetupCommand(50, 30, 2, 0, "normal", false, "metric", 8, 203).commandString).toContain("^MNY")
    expect(new ZPLSetupCommand(50, 30, 0, 0, "normal", false, "metric", 8, 203).commandString).toContain("^MNN")
})

test("ZPLSetupCommand maps density 0-15 to absolute ~SD 00-30", () => {
    expect(new ZPLSetupCommand(50, 30, 2, 0, "normal", false, "metric", 8, 203).commandString).toMatch(/^~SD16\^XA/)
    expect(new ZPLSetupCommand(50, 30, 2, 0, "normal", false, "metric", 15, 203).commandString).toContain("~SD30")
})

// ── Print ──────────────────────────────────────────────────────────────────

test("ZPLPrintCommand closes label format with ^XZ", () => {
    const cmd = new ZPLPrintCommand(1, 1)
    expect(cmd.commandString).toContain("^XZ")
})

test("ZPLPrintCommand includes sets and copies", () => {
    expect(new ZPLPrintCommand(2, 3).commandString).toBe("^PQ6^XZ")
})

// ── Text ───────────────────────────────────────────────────────────────────

test("ZPLTextCommand uses built-in font A0 with correct format", () => {
    const cmd = new ZPLTextCommand("Hello", 10, 20, 30)
    expect(cmd.commandString).toBe("^FO10,20^A0N,30,30^FH^FDHello^FS")
})

test("ZPLTextCommand maps rotations correctly", () => {
    expect(new ZPLTextCommand("x", 0, 0, 10, 0).commandString).toContain("^A0N")
    expect(new ZPLTextCommand("x", 0, 0, 10, 90).commandString).toContain("^A0R")
    expect(new ZPLTextCommand("x", 0, 0, 10, 180).commandString).toContain("^A0I")
    expect(new ZPLTextCommand("x", 0, 0, 10, 270).commandString).toContain("^A0B")
})

test("ZPLTextCommand escapes reserved and non ASCII characters", () => {
    const cmd = new ZPLTextCommand("a^b~c_d é", 0, 0, 20)
    expect(cmd.commandString).toContain("^FDa_5Eb_7Ec_5Fd _C3_A9^FS")
})

test("ZPLTextCommand anchors rotated text at its rotation point", () => {
    // size 20, width 100: 90° box is 20 wide to the left of the anchor
    expect(new ZPLTextCommand("x", 50, 60, 20, 90, 100).commandString).toContain("^FO30,60")
    expect(new ZPLTextCommand("x", 150, 60, 20, 180, 100).commandString).toContain("^FO50,40")
    expect(new ZPLTextCommand("x", 50, 160, 20, 270, 100).commandString).toContain("^FO50,60")
})

test("ZPLCustomFontTextCommand uses ^A@ with font file reference", () => {
    const cmd = new ZPLCustomFontTextCommand("Hello", 10, 20, "f0.TTF", 30)
    expect(cmd.commandString).toBe("^FO10,20^A@N,30,30,R:f0.TTF^FH^FDHello^FS")
})

// ── Lines / Boxes ──────────────────────────────────────────────────────────

test("ZPLGraphicBoxCommand generates ^GB for a horizontal bar", () => {
    const cmd = new ZPLGraphicBoxCommand(10, 20, 100, 5, 5)
    expect(cmd.commandString).toBe("^FO10,20^GB100,5,5,B,0^FS")
})

test("ZPLGraphicDiagonalCommand generates ^GD with L orientation (\\) for top-left to bottom-right", () => {
    const cmd = new ZPLGraphicDiagonalCommand({ x: 10, y: 20 }, { x: 110, y: 70 }, 3)
    const str = cmd.commandString
    expect(str).toContain("^GD")
    expect(str).toContain(",L^FS")
})

test("ZPLGraphicDiagonalCommand generates ^GD with R orientation (/) for bottom-left to top-right", () => {
    const cmd = new ZPLGraphicDiagonalCommand({ x: 10, y: 70 }, { x: 110, y: 20 }, 3)
    const str = cmd.commandString
    expect(str).toContain(",R^FS")
})

// ── Bitmap ─────────────────────────────────────────────────────────────────

test("ZPLGraphicFieldCommand generates ^GF with inverted hex-encoded bytes", () => {
    // 2 bytes wide, 1 row: 0xFF, 0x00 → inverted → 0x00, 0xFF → "00FF"
    const bitmap = { width: 2, height: 1, bytes: new Uint8Array([0xFF, 0x00]) }
    const cmd = new ZPLGraphicFieldCommand(bitmap, 5, 10)
    const str = cmd.commandString
    expect(str).toContain("^FO5,10")
    expect(str).toContain("^GFA,2,2,2,")
    expect(str).toContain("00FF^FS")
})

test("ZPLGraphicFieldCommand total bytes = width * height", () => {
    const bitmap = { width: 3, height: 4, bytes: new Uint8Array(12) }
    const cmd = new ZPLGraphicFieldCommand(bitmap, 0, 0)
    expect(cmd.commandString).toContain("^GFA,12,12,3,")
})

// ── Barcode ────────────────────────────────────────────────────────────────

test("ZPLBarcodeCommand generates ^BC for Code 128", () => {
    const cmd = new ZPLBarcodeCommand("12345", 10, 20, "128", 50, 0, "left", 2)
    const str = cmd.commandString
    expect(str).toContain("^FO10,20")
    expect(str).toContain("^BC")
    expect(str).toContain("^FD12345^FS")
})

test("ZPLBarcodeCommand generates ^BE for EAN-13", () => {
    const cmd = new ZPLBarcodeCommand("123456789012", 0, 0, "EAN13", 50, 0, "none", 2)
    expect(cmd.commandString).toContain("^BE")
    expect(cmd.commandString).toContain(",N,")
})

test("ZPLBarcodeCommand generates ^B3 for Code 39", () => {
    const cmd = new ZPLBarcodeCommand("ABC", 0, 0, "39", 50, 0, "none", 2)
    expect(cmd.commandString).toContain("^B3")
})

test("ZPLBarcodeCommand human readable flag maps from the alignment", () => {
    expect(new ZPLBarcodeCommand("12345", 0, 0, "128", 50, 0, "left", 2).commandString).toContain("^BCN,50,Y,N,N")
    expect(new ZPLBarcodeCommand("12345", 0, 0, "128", 50, 0, "none", 2).commandString).toContain("^BCN,50,N,N,N")
})

test("ZPLBarcodeCommand uses the correct commands for other symbologies", () => {
    const cmd = (type: any) => new ZPLBarcodeCommand("1234", 0, 0, type, 50, 0, "none", 2).commandString
    expect(cmd("93")).toContain("^BAN,")
    expect(cmd("25")).toContain("^B2N,")
    expect(cmd("ITF14")).toContain("^B2N,")
    expect(cmd("CODA")).toContain("^BKN,N,50,N,N")
    expect(cmd("MSI")).toContain("^BMN,")
    expect(cmd("PLESSEY")).toContain("^BPN,")
    expect(cmd("UPCA")).toContain("^BUN,50,N,N,Y")
    expect(cmd("EAN13+2")).toContain("^BEN,")
})

test("ZPLBarcodeCommand cuts check digits and escapes data", () => {
    expect(new ZPLBarcodeCommand("1234567890128", 0, 0, "EAN13", 50, 0, "none", 2).commandString).toContain("^FD123456789012^FS")
    expect(new ZPLBarcodeCommand("A^B", 0, 0, "128", 50, 0, "none", 2).commandString).toContain("^FH^FDA_5EB^FS")
})

test("ZPLBarcodeCommand anchors rotated fixed width codes", () => {
    // EAN13 at module 2 is 190 dots long, 50 dots high
    expect(new ZPLBarcodeCommand("123456789012", 100, 300, "EAN13", 50, 90, "none", 2).commandString).toContain("^FO50,300")
    expect(new ZPLBarcodeCommand("123456789012", 300, 100, "EAN13", 50, 180, "none", 2).commandString).toContain("^FO110,50")
})

// ── QR Code ────────────────────────────────────────────────────────────────

test("ZPLQRCommand generates ^BQ with magnification and error correction in the data", () => {
    const cmd = new ZPLQRCommand("hello", 10, 20, 5)
    const str = cmd.commandString
    expect(str).toContain("^FO10,20")
    expect(str).toContain("^BQN,2,5,H")
    expect(str).toContain("^FDHA,hello^FS")
})

test("ZPLQRCommand clamps magnification to 1-10", () => {
    expect(new ZPLQRCommand("x", 0, 0, 0).commandString).toContain(",1,")
    expect(new ZPLQRCommand("x", 0, 0, 99).commandString).toContain(",10,")
})

test("ZPLQRCommand keeps the normal orientation and moves the anchor when rotated", () => {
    const str = new ZPLQRCommand("x", 100, 20, 3, 90, 60).commandString
    expect(str).toContain("^BQN,")
    expect(str).toContain("^FO40,20")
})

// ── Download ───────────────────────────────────────────────────────────────

test("ZPLDownloadCommand generates ~DY header for a TrueType font without extension in the name", () => {
    const cmd = new ZPLDownloadCommand("f0.TTF", new Uint8Array([0xDE, 0xAD]))
    expect(cmd.commandString).toBe("~DYR:f0,B,T,2,,")
})

test("ZPLDownloadCommand sends raw bytes after the header", () => {
    const bytes = new ZPLDownloadCommand("f1.TTF", new Uint8Array([0x00, 0xFF]).buffer).commandBytes
    const header = new TextEncoder().encode("~DYR:f1,B,T,2,,")
    expect(Array.from(bytes.slice(0, header.length))).toEqual(Array.from(header))
    expect(Array.from(bytes.slice(header.length, header.length + 2))).toEqual([0x00, 0xFF])
})

// ── Printer responses ──────────────────────────────────────────────────────

import ZPLPrinter from "@/printers/ZPLPrinter"

const fakeDevice = (response: string | undefined) => ({
    opened: true,
    openAndConfigure: jest.fn(),
    writeString: jest.fn(),
    readString: jest.fn().mockResolvedValue(response),
    close: jest.fn(),
}) as any

const hs = (first: string, second: string) => `\x02${first}\x03\r\n\x02${second}\x03\r\n\x02000,0\x03\r\n`

test("ZPLPrinter recognises ~HI answers and reads the model", async () => {
    const answer = "\x02ZD420-203dpi,V84.20.18Z,8,8192KB\x03\r\n"
    expect(await ZPLPrinter.try(fakeDevice(answer))).toBe(true)
    expect(await new (ZPLPrinter as any)(fakeDevice(answer)).getModelname()).toBe("ZD420-203dpi")
    expect(await ZPLPrinter.try(fakeDevice(""))).toBe(false)
    expect(await ZPLPrinter.try(fakeDevice("garbage"))).toBe(false)
})

test("ZPLPrinter parses ~HS status", async () => {
    const status = (first: string, second: string) => new (ZPLPrinter as any)(fakeDevice(hs(first, second))).getStatus()
    const ok1 = "030,0,0,1234,000,0,0,0,000,0,0,0"
    const ok2 = "000,0,0,0,0,2,4,0,00000000,1,000"
    expect(await status(ok1, ok2)).toBe("normal")
    expect(await status("030,1,0,1234,000,0,0,0,000,0,0,0", ok2)).toBe("out_of_paper")
    expect(await status(ok1, "000,0,1,0,0,2,4,0,00000000,1,000")).toBe("head_opened")
    expect(await status(ok1, "000,0,0,1,0,2,4,0,00000000,1,000")).toBe("out_of_ribbon")
    expect(await status("030,0,1,1234,000,0,0,0,000,0,0,0", ok2)).toBe("paused")
    expect(await status("030,0,0,1234,002,0,0,0,000,0,0,0", ok2)).toBe("printing")
})

test("ZPL display is not supported", async () => {
    const { Label } = await import("@/labels")
    await expect(new Label(50, 30).fullDisplayCommand("zpl", "normal")).rejects.toThrow("Operation not supported")
})
