import TSPLPrinter from "@/printers/TSPLPrinter"

jest.mock("@/commands/tspl", () => {
    const actual = jest.requireActual("@/commands/tspl")
    return {
        __esModule: true,
        ...actual,
        TSPLRawCommand: jest.fn().mockImplementation((body: string) => {
            return {
                commandString: body,
                write: jest.fn().mockResolvedValue(undefined),
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
