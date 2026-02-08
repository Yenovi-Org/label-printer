import { PrinterService } from "@/printers"
import TSPLPrinter from "@/printers/TSPLPrinter"
import NetworkDevice from "@/helpers/NetworkDevice"

jest.mock("@/helpers/USBUtils", () => {
    const actual = jest.requireActual("@/helpers/USBUtils")
    return {
        __esModule: true,
        ...actual,
        getDevices: jest.fn(),
        requestDevice: jest.fn(),
        requestDeviceWithFilters: jest.fn(),
    }
})

import { getDevices, requestDeviceWithFilters } from "@/helpers/USBUtils"

test("PrinterService.connect({network}) returns TSPLPrinter when TSPL probe passes", async () => {
    jest.spyOn(TSPLPrinter, "try").mockResolvedValue(true)

    const printer = await PrinterService.connect({ network: { host: "192.168.0.10" } })
    expect(printer).toBeInstanceOf(TSPLPrinter)

    expect(TSPLPrinter.try).toHaveBeenCalled()
    const calledWith = (TSPLPrinter.try as unknown as jest.Mock).mock.calls[0][0]
    expect(calledWith).toBeInstanceOf(NetworkDevice)

    ;(TSPLPrinter.try as unknown as jest.Mock).mockRestore?.()
})

test("PrinterService.connectTSPL({network}) uses default port 9100 and allows override", async () => {
    jest.spyOn(TSPLPrinter, "try").mockResolvedValue(true)

    await PrinterService.connectTSPL({ network: { host: "192.168.0.10" } })
    const calledWithDefault = (TSPLPrinter.try as unknown as jest.Mock).mock.calls[0][0]
    expect(calledWithDefault).toBeInstanceOf(NetworkDevice)

    ;(TSPLPrinter.try as unknown as jest.Mock).mockClear()

    await PrinterService.connectTSPL({ network: { host: "192.168.0.10", port: 9101 } })
    const calledWithOverride = (TSPLPrinter.try as unknown as jest.Mock).mock.calls[0][0]
    expect(calledWithOverride).toBeInstanceOf(NetworkDevice)

    ;(TSPLPrinter.try as unknown as jest.Mock).mockRestore?.()
})

test("PrinterService.connect({usb}) filters in node using getDevices and vendor/product/serial", async () => {
    ;(getDevices as unknown as jest.Mock).mockResolvedValue([
        { vendorId: 1, productId: 2, serialNumber: "aaa", opened: true } as any,
        { vendorId: 1234, productId: 5678, serialNumber: "xyz", opened: true } as any,
    ])

    jest.spyOn(TSPLPrinter, "try").mockResolvedValue(true)

    const printer = await PrinterService.connect({ usb: { vendorId: 1234, productId: 5678, serialNumber: "xyz" } })
    expect(printer).toBeInstanceOf(TSPLPrinter)

    const calledWith = (TSPLPrinter.try as unknown as jest.Mock).mock.calls[0][0]
    expect(calledWith.vendorId).toBe(1234)
    expect(calledWith.productId).toBe(5678)
    expect(calledWith.serialNumber).toBe("xyz")

    ;(TSPLPrinter.try as unknown as jest.Mock).mockRestore?.()
})

test("PrinterService.connect({usb}) uses WebUSB requestDeviceWithFilters when vendor/product are provided", async () => {
    ;(requestDeviceWithFilters as unknown as jest.Mock).mockResolvedValue({ opened: true } as any)

    jest.spyOn(TSPLPrinter, "try").mockResolvedValue(true)

    const oldWindow = (globalThis as any).window
    ;(globalThis as any).window = {}

    try {
        const printer = await PrinterService.connect({ usb: { vendorId: 1234, productId: 5678 } })
        expect(printer).toBeInstanceOf(TSPLPrinter)
        expect(requestDeviceWithFilters).toHaveBeenCalledWith([{ vendorId: 1234, productId: 5678 }])
    } finally {
        ;(globalThis as any).window = oldWindow
        ;(TSPLPrinter.try as unknown as jest.Mock).mockRestore?.()
    }
})
