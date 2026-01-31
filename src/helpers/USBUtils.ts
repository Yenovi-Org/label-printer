import StringUtils from "./StringUtils";

const unsupportedUsbError = "usb-unsupported"
const stringHelper = new StringUtils()

let usbAgent: USB

/**
 * @returns The appropiate USB agent based on the environment
 */
const getUSB = async (): Promise<USB> => {
    if(usbAgent) return usbAgent

    if(typeof window !== "undefined") {
        if(navigator.usb) {
            usbAgent = navigator.usb
        } else {
            throw unsupportedUsbError
        }
    } else {
        // TODO: Check how to avoid eval
        const { WebUSB } = eval("require")("usb")
        usbAgent = new WebUSB({allowAllDevices: true})
    }

    return usbAgent
}

/**
 * Returns the list of available devices
 * In node this returns all the connected devices but in the browser it will only return devices 
 * that the user already gave permission to
 * @returns A list of available devices
 */
export const getDevices = async (): Promise<UsbDevice[]> => {
    const agent = await getUSB()
    const devices = await agent.getDevices()
    return devices.map(device => new UsbDevice(device) )
}

/**
 * In node, it returns the first available device, in the browser (supported browsers only) it shows 
 * a UI for the user to choose a device
 * @returns The first available device
 */
export const requestDevice = async (): Promise<UsbDevice|undefined> => {
    const agent = await getUSB()
    const device = await agent.requestDevice({filters: []})
    if(device) {
        return new UsbDevice(device)
    } else {
        return undefined
    }
}

/**
 * Convenience wrapper for a web usb device
 * Its main purpose is to hide the details of the usb library from client code so in case
 * it needs to be switched, compatibility can be retained
 */
export class UsbDevice {
    private readonly device: USBDevice

    get opened() {
        return this.device.opened
    }

    /**
     * All available endpoints
     */
    private get endpoints() {
        return this.device.configuration?.interfaces[0].alternate.endpoints ?? []
    }

    /**
     * Endpoint for writing
     */
    private get outEndpoint() {
        return this.endpoints.find(e => e.direction == "out")?.endpointNumber
    }

    /**
     * Endpoint for reading
     */
    private get inEndpoint() {
        return this.endpoints.find(e => e.direction == "in")?.endpointNumber
    }

    constructor(device: USBDevice) {
        this.device = device
    }

    /**
     * Open the device and claim its interface
     */
    async openAndConfigure() {
        await this.device.open();
        await this.device.selectConfiguration(1);
        await this.device.claimInterface(0);
    }

    /**
     * Closes the device
     */
    async close() {
        await this.device.releaseInterface(0)
        await this.device.close()
    }

    /**
     * Write data to an USB device
     * @param data Data to write
     */
    async writeData(data: Uint8Array|ArrayBuffer): Promise<void> {
        const endpointNumber = this.outEndpoint
        if(endpointNumber == null) {
            throw new Error("usb-no-out-endpoint")
        }
        await this.device.transferOut(endpointNumber, data as BufferSource)
    }

    /**
     * Writes a text to a device
     * @param text Text to write
     */
    async writeString(text: string): Promise<void> {
        const bytes = stringHelper.toUTF8Array(text)
        await this.writeData(bytes)
    }

    /**
     * Reads bytes from the usb device
     * @param length The max length of the incoming data. 
     * @returns Bytes received as a DataView or undefined. If data is longer then `length`, undefined will be returned
     */
    async readData(length: number): Promise<DataView|undefined> {
        const endpointNumber = this.inEndpoint
        if(endpointNumber == null) {
            throw new Error("usb-no-in-endpoint")
        }
        const result = await this.device.transferIn(endpointNumber, length)

        if(result.status == "ok" && result.data) {
            return result.data
        } else {
            return undefined
        }
    }

    /**
     * Reads data from the usb device and converts it to string
     * {@see readData}
     */
    async readString(length: number): Promise<string|undefined> {
        const bytes = await this.readData(length)
        if(bytes) return stringHelper.toString(bytes)
        return undefined
    }
}
