import Device from "@/helpers/Device"
import { getDevices, requestDevice, requestDeviceWithFilters } from "@/helpers/USBUtils"
import NetworkDevice from "@/helpers/NetworkDevice"
import TSPLPrinter from "./TSPLPrinter"
import Printer from "./Printer"

export type PrinterServiceUsbConnectOptions = {
    vendorId?: number
    productId?: number
    serialNumber?: string
}

export type PrinterServiceNetworkConnectOptions = {
    host: string
    port?: number
}

export type PrinterServiceConnectOptions =
    | { usb: PrinterServiceUsbConnectOptions }
    | { network: PrinterServiceNetworkConnectOptions }

export class PrinterService {
    /**
     * Try each type of printer and return the one that mathces the usb device
     * @param device 
     * @returns 
     */
    static async printerForDevice(device: Device): Promise<Printer|undefined> {
        const classes = [TSPLPrinter]

        for (const key in classes) {
            try {
                if(await classes[key].try(device)) {
                    return new classes[key](device)
                }
            } catch (_e) {
                return undefined
            }
        }

        return undefined
    }

    /**
     * Discover devices using printer-specific discovery hooks.
     *
     * Each printer class may optionally implement `static discoverDevices(): Promise<Device[]>`
     * to find candidates over non-USB transports.
     *
     * Candidates returned here are still verified by `printerForDevice` via the printer
     * class' `try(device)` method.
     */
    private static async discoverDevices(): Promise<Device[]> {
        const classes = [TSPLPrinter]

        const discoveryResults = await Promise.all(classes.map(async (cls) => {
            const discoverer = (cls as any).discoverDevices
            if(typeof discoverer === "function") {
                try {
                    return await discoverer.call(cls)
                } catch (_e) {
                    return []
                }
            }
            return []
        }))

        return discoveryResults.flat()
    }

    /**
     * @returns List of available printers
     */
    static async getPrinters(): Promise<Printer[]> {
        const usbDevices = await getDevices()
        const discoveredDevices = await PrinterService.discoverDevices()
        const devices: Device[] = [...usbDevices, ...discoveredDevices]

        const optionalPrinters = await Promise.all(devices.map(PrinterService.printerForDevice))
        return optionalPrinters.filter(printer => !!printer) as Printer[]
    }

    /**
     * This is intended to be used in the browser although it also works in node
     * In the browser, it provides a UI for the user to choose a USB device and if it is a
     * printer, it returns a new printer instance. In Node however, this will try to create
     * a printer for the first available device and returns it. This means that even if there is a 
     * printer, it may return undefined. In node, use `getPrinters` instead
     */
    static async requestPrinter(): Promise<Printer|undefined> {
        const device = await requestDevice()
        if(device) {
            return PrinterService.printerForDevice(device)
        }
    }

    /**
     * Create a printer instance using explicit connection information.
     *
     * This is useful when you already know your printer's network address or USB identifiers
     * and want to bypass discovery.
     *
     * Behavior differs by environment:
     * - **Node.js**
     *   - `network`: connects via TCP (defaults to port `9100`)
     *   - `usb`: selects the first connected USB device matching the provided filters
     * - **Browser**
     *   - `usb`: shows the WebUSB picker (optionally filtered by `vendorId`/`productId`)
     *   - `network`: not supported (will throw if network transport is used in the browser)
     */
    static async connect(options: PrinterServiceConnectOptions): Promise<Printer|undefined> {
        const device = await PrinterService.deviceForConnectOptions(options)
        if(!device) return undefined
        return PrinterService.printerForDevice(device)
    }

    /**
     * Create a TSPL printer instance using explicit connection information.
     *
     * This still verifies the target by probing it with the TSPL identify command (`~!I`).
     * If the probe fails, `undefined` is returned.
     */
    static async connectTSPL(options: PrinterServiceConnectOptions): Promise<TSPLPrinter|undefined> {
        const device = await PrinterService.deviceForConnectOptions(options)
        if(!device) return undefined

        const ok = await TSPLPrinter.try(device)
        if(!ok) return undefined
        return new TSPLPrinter(device)
    }

    /**
     * Convert user-facing connect options into a concrete device.
     *
     * This keeps transport details (USB vs TCP socket) out of the public API.
     */
    private static async deviceForConnectOptions(options: PrinterServiceConnectOptions): Promise<Device|undefined> {
        if("network" in options) {
            const port = options.network.port ?? 9100
            return new NetworkDevice(options.network.host, port)
        }

        const filters = [{ vendorId: options.usb.vendorId, productId: options.usb.productId }].filter(f => f.vendorId != null || f.productId != null)

        if(typeof window !== "undefined") {
            if(filters.length > 0) return requestDeviceWithFilters(filters as any)
            return requestDevice()
        }

        const devices = await getDevices()

        const matching = devices.filter(d => {
            if(options.usb.vendorId != null && d.vendorId !== options.usb.vendorId) return false
            if(options.usb.productId != null && d.productId !== options.usb.productId) return false
            if(options.usb.serialNumber != null && d.serialNumber !== options.usb.serialNumber) return false
            return true
        })

        return matching[0]
    }
}