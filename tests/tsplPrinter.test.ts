import TSPLPrinter from "@/printers/TSPLPrinter"

jest.mock("@/commands/tspl", () => {
    const actual = jest.requireActual("@/commands/tspl")
    return {
        __esModule: true,
        ...actual,
        TSPLRawCommand: jest.fn().mockImplementation((body: string) => {
            return {
                commandString: body,
                writeTo: jest.fn().mockResolvedValue(undefined),
            }
        })
    }
})

test("TSPLPrinter.try opens, writes query, reads response, closes", async () => {
    const device: any = {
        opened: false,
        openAndConfigure: jest.fn().mockResolvedValue(undefined),
        readString: jest.fn().mockResolvedValue("OK"),
        close: jest.fn().mockResolvedValue(undefined),
    }

    const result = await TSPLPrinter.try(device)
    expect(result).toBe(true)
    expect(device.openAndConfigure).toHaveBeenCalled()
    expect(device.readString).toHaveBeenCalledWith(64)
    expect(device.close).toHaveBeenCalled()
})

test("TSPLPrinter.try returns false when no response", async () => {
    const device: any = {
        opened: true,
        openAndConfigure: jest.fn(),
        readString: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
    }

    const result = await TSPLPrinter.try(device)
    expect(result).toBe(false)
})

test("TSPLPrinter.getModelname writes ~!T and returns trimmed response", async () => {
    const device: any = {
        opened: true,
        openAndConfigure: jest.fn(),
        readString: jest.fn().mockResolvedValue("  TSC DA210  \n"),
        writeData: jest.fn(),
    }

    const printer = new TSPLPrinter(device)
    const model = await printer.getModelname()
    expect(model).toBe("TSC DA210")
    expect(device.readString).toHaveBeenCalledWith(256)
})

test("TSPLPrinter.getStatus sends ESC!? and maps code", async () => {
    const device: any = {
        opened: true,
        openAndConfigure: jest.fn(),
        writeData: jest.fn().mockResolvedValue(undefined),
        readData: jest.fn().mockResolvedValue(new DataView(new Uint8Array([0x04]).buffer)),
    }

    const printer = new TSPLPrinter(device)
    const status = await printer.getStatus()

    expect(device.writeData).toHaveBeenCalledWith(new Uint8Array([0x1b, 0x21, 0x3f, 0x0a]))
    expect(device.readData).toHaveBeenCalledWith(1)
    expect(status).toBe("out_of_paper")
})

test("TSPLPrinter.getStatus decodes unknown combination bitmask into composed message", async () => {
    const device: any = {
        opened: true,
        openAndConfigure: jest.fn(),
        writeData: jest.fn().mockResolvedValue(undefined),
        readData: jest.fn().mockResolvedValue(new DataView(new Uint8Array([0x2c]).buffer)),
    }

    const printer = new TSPLPrinter(device)
    const status = await printer.getStatus()

    expect(status).toBe("other_error")
})

test("TSPLPrinter.getStatus returns Other error message for unknown code without known bits", async () => {
    const device: any = {
        opened: true,
        openAndConfigure: jest.fn(),
        writeData: jest.fn().mockResolvedValue(undefined),
        readData: jest.fn().mockResolvedValue(new DataView(new Uint8Array([0x40]).buffer)),
    }

    const printer = new TSPLPrinter(device)
    const status = await printer.getStatus()

    expect(status).toBe("other_error")
})

test("TSPLPrinter.getStatus maps paused", async () => {
    const device: any = {
        opened: true,
        openAndConfigure: jest.fn(),
        writeData: jest.fn().mockResolvedValue(undefined),
        readData: jest.fn().mockResolvedValue(new DataView(new Uint8Array([0x10]).buffer)),
    }

    const printer = new TSPLPrinter(device)
    const status = await printer.getStatus()

    expect(status).toBe("paused")
})
