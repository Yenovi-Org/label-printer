import { PrinterService } from "@/printers"

jest.mock("@/helpers/USBUtils", () => {
    return {
        __esModule: true,
        getDevices: jest.fn().mockResolvedValue([]),
        requestDevice: jest.fn(),
        UsbDevice: jest.fn(),
    }
})

jest.mock("@/printers/TSPLPrinter", () => {
    return {
        __esModule: true,
        default: class TSPLPrinterMock {
            static try = jest.fn().mockResolvedValue(true)
            static discoverDevices = jest.fn().mockResolvedValue([
                {
                    opened: true,
                    openAndConfigure: jest.fn(),
                    close: jest.fn(),
                    writeData: jest.fn(),
                    writeString: jest.fn(),
                    readData: jest.fn(),
                    readString: jest.fn(),
                }
            ])
            constructor(_device: any) {}
        }
    }
})

test("PrinterService.getPrinters includes network devices in discovery", async () => {
    const printers = await PrinterService.getPrinters()
    expect(printers.length).toBe(1)
})
