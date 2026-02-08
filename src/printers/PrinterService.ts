import Device from "@/helpers/Device"
import NetworkDevice from "@/helpers/NetworkDevice"
import { getNetworkTargetsFromEnv } from "@/helpers/NetworkUtils"
import { getDevices, requestDevice } from "@/helpers/USBUtils"
import TSPLPrinter from "./TSPLPrinter"
import Printer from "./Printer"

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

    private static async getNetworkDevices(): Promise<NetworkDevice[]> {
        const targets = getNetworkTargetsFromEnv()
        return targets.map(t => new NetworkDevice(t.host, t.port))
    }

    /**
     * @returns List of available printers
     */
    static async getPrinters(): Promise<Printer[]> {
        const usbDevices = await getDevices()
        const networkDevices = await PrinterService.getNetworkDevices()
        const devices: Device[] = [...usbDevices, ...networkDevices]

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
}