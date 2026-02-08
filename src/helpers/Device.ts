export type DeviceReadResult = DataView|undefined

export default interface Device {
    get opened(): boolean

    openAndConfigure(): Promise<void>
    close(): Promise<void>

    writeData(data: Uint8Array|ArrayBuffer): Promise<void>
    writeString(text: string): Promise<void>

    readData(length: number): Promise<DeviceReadResult>
    readString(length: number): Promise<string|undefined>
}
