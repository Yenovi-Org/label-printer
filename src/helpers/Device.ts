export type DeviceReadResult = DataView|undefined

/**
 * Transport-agnostic device interface.
 *
 * Implementations can represent a USB device (browser/node) or a network socket (node).
 * Commands write to this interface so printers can be used over different transports.
 */
export default interface Device {
    get opened(): boolean

    openAndConfigure(): Promise<void>
    close(): Promise<void>

    writeData(data: Uint8Array|ArrayBuffer): Promise<void>
    writeString(text: string): Promise<void>

    readData(length: number): Promise<DeviceReadResult>
    readString(length: number): Promise<string|undefined>
}
