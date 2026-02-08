import { PrinterService } from "@/printers"
import TSPLPrinter from "@/printers/TSPLPrinter"

jest.mock("@/helpers/USBUtils", () => {
    const actual = jest.requireActual("@/helpers/USBUtils")
    return {
        __esModule: true,
        ...actual,
        requestDevice: jest.fn(),
        requestDeviceWithFilters: jest.fn(),
    }
})

import { requestDevice } from "@/helpers/USBUtils"

test("printerForDevice returns TSPLPrinter when TSPLPrinter.try returns true", async () => {
    const device: any = { opened: true }

    jest.spyOn(TSPLPrinter, "try").mockResolvedValue(true)

    const printer = await PrinterService.printerForDevice(device)
    expect(printer).toBeInstanceOf(TSPLPrinter)

    ;(TSPLPrinter.try as unknown as jest.Mock).mockRestore?.()
})

test("printerForDevice returns undefined when TSPLPrinter.try returns false", async () => {
    const device: any = { opened: true }

    jest.spyOn(TSPLPrinter, "try").mockResolvedValue(false)

    const printer = await PrinterService.printerForDevice(device)
    expect(printer).toBeUndefined()

    ;(TSPLPrinter.try as unknown as jest.Mock).mockRestore?.()
})

test("requestPrinter returns undefined when requestDevice returns undefined", async () => {
    ;(requestDevice as unknown as jest.Mock).mockResolvedValue(undefined)
    const printer = await PrinterService.requestPrinter()
    expect(printer).toBeUndefined()
})

test("requestPrinter delegates to printerForDevice when a device is selected", async () => {
    const device: any = { opened: true }
    ;(requestDevice as unknown as jest.Mock).mockResolvedValue(device)

    jest.spyOn(TSPLPrinter, "try").mockResolvedValue(true)

    const printer = await PrinterService.requestPrinter()
    expect(printer).toBeInstanceOf(TSPLPrinter)

    ;(TSPLPrinter.try as unknown as jest.Mock).mockRestore?.()
})
