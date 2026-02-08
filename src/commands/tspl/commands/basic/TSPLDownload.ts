import Device from "@/helpers/Device"
import TSPLCommand from "../../TSPLCommand"

type Data = ArrayBuffer|Uint8Array
/**
 * A raw TSPL command. Can be used to use a command that is not yet supported
 */
export default class TSPLDownload extends TSPLCommand {
    /**
     * Name of the file on the printer
     */
    private readonly fileName: string
    private readonly data: Data

    /**
     * Initialize a command with a raw body
     * @param body
     */
    constructor(fileName: string, data: Data) {
        super()
        this.fileName = fileName
        this.data = data
    }

    get commandString(): string {
        return `DOWNLOAD "${this.fileName}", ${this.data.byteLength},`
    }

    async writeTo(device: Device): Promise<void> {
        await this.writeString(this.commandString, device)
        await this.writeBytes(this.data, device)
        await this.terminateCommand(device)
    }
}