import ZPLCommand from "../../ZPLCommand";

/**
 * Downloads a TrueType font into the printer's RAM (R:).
 * ~DYd:name,b,x,t,w,data  with b=B (binary), x=T (TrueType), t=size, w=(empty, only used for graphics)
 * The font data is sent as raw bytes.
 */
export default class ZPLDownloadCommand extends ZPLCommand {
    private readonly name: string
    private readonly data: ArrayBuffer | Uint8Array

    constructor(name: string, data: ArrayBuffer | Uint8Array) {
        super()
        this.name = name
        this.data = data
    }

    private get bytes(): Uint8Array {
        return this.data instanceof Uint8Array ? this.data : new Uint8Array(this.data)
    }

    /** File name without the extension, as ~DY expects the extension as a separate parameter */
    private get baseName(): string {
        return this.name.replace(/\.[^.]*$/, "")
    }

    get commandString(): string {
        return `~DYR:${this.baseName},B,T,${this.bytes.length},,`
    }

    get commandBytes(): Uint8Array {
        const header = new TextEncoder().encode(this.commandString)
        const data = this.bytes
        const terminator = this.commandTerminatorBytes
        const result = new Uint8Array(header.length + data.length + terminator.length)
        result.set(header, 0)
        result.set(data, header.length)
        result.set(terminator, header.length + data.length)
        return result
    }

    async writeTo(device: import("@/helpers/Device").default): Promise<void> {
        await this.writeString(this.commandString, device)
        await this.writeBytes(this.data, device)
        await this.terminateCommand(device)
    }
}
