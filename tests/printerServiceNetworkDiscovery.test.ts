import { PrinterService } from "@/printers"

jest.mock("@/helpers/USBUtils", () => {
    return {
        __esModule: true,
        getDevices: jest.fn().mockResolvedValue([]),
        requestDevice: jest.fn(),
        UsbDevice: jest.fn(),
    }
})

jest.mock("@/helpers/NetworkUtils", () => {
    return {
        __esModule: true,
        getNetworkTargetsFromEnv: jest.fn().mockReturnValue([
            { host: "192.168.0.10", port: 9100 },
        ]),
    }
})

jest.mock("@/helpers/NetworkDevice", () => {
    return {
        __esModule: true,
        default: jest.fn().mockImplementation(() => {
            return {
                opened: true,
                openAndConfigure: jest.fn(),
                close: jest.fn(),
                writeData: jest.fn(),
                writeString: jest.fn(),
                readData: jest.fn(),
                readString: jest.fn(),
            }
        })
    }
})

jest.mock("@/printers/TSPLPrinter", () => {
    return {
        __esModule: true,
        default: class TSPLPrinterMock {
            static try = jest.fn().mockResolvedValue(true)
            constructor(_device: any) {}
        }
    }
})

test("PrinterService.getPrinters includes network devices in discovery", async () => {
    const printers = await PrinterService.getPrinters()
    expect(printers.length).toBe(1)
})
