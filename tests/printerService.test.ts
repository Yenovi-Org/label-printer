import { PrinterService } from "@/printers"
import TSPLPrinter from "@/printers/TSPLPrinter"

jest.mock("@/helpers/USBUtils", () => {
    const actual = jest.requireActual("@/helpers/USBUtils")
    return {
        __esModule: true,
        ...actual,
        getDevices: jest.fn(),
        requestDevice: jest.fn(),
    }
})

import { getDevices } from "@/helpers/USBUtils"

test("getPrinters skips devices that throw during probing", async () => {
    ;(getDevices as unknown as jest.Mock).mockResolvedValue([
        { deviceId: "bad" } as any,
        { deviceId: "good" } as any,
    ])

    jest.spyOn(TSPLPrinter as any, "discoverDevices").mockResolvedValue([])

    jest.spyOn(TSPLPrinter, "try").mockImplementation(async (device: any) => {
        if(device.deviceId == "bad") {
            throw new Error("usb-no-out-endpoint")
        }
        return true
    })

    const printers = await PrinterService.getPrinters()
    expect(printers.length).toBe(1)

    ;(TSPLPrinter.try as unknown as jest.Mock).mockRestore?.()
    ;((TSPLPrinter as any).discoverDevices as unknown as jest.Mock).mockRestore?.()
})
