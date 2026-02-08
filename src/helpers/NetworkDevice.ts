import StringUtils from "./StringUtils";
import type Device from "./Device";

const unsupportedNetworkError = "network-unsupported"
const stringHelper = new StringUtils()

type NetSocket = {
    write(data: Uint8Array|ArrayBuffer|string, cb?: (err?: Error) => void): boolean
    end(): void
    destroy(): void
    on(event: "data", listener: (data: Buffer) => void): any
    on(event: "error", listener: (err: Error) => void): any
    once(event: "data", listener: (data: Buffer) => void): any
    once(event: "error", listener: (err: Error) => void): any
    removeListener(event: "data"|"error", listener: (...args: any[]) => void): any
}

type NetModule = {
    createConnection(options: { host: string, port: number }, listener?: () => void): NetSocket
}

const getNet = (): NetModule => {
    if(typeof window !== "undefined") {
        throw unsupportedNetworkError
    }

    // TODO: Check how to avoid eval
    return eval("require")("net") as NetModule
}

export default class NetworkDevice implements Device {
    private socket?: NetSocket
    private readonly host: string
    private readonly port: number
    private readonly connectTimeoutMs: number
    private readonly readTimeoutMs: number

    /**
     * Create a TCP-based device.
     *
     * This is intended for raw printing ports (typically 9100). It is Node-only.
     *
     * @param host Hostname or IP
     * @param port TCP port (defaults to 9100)
     * @param connectTimeoutMs Connection timeout
     * @param readTimeoutMs Read timeout used by `readData`/`readString`
     */
    constructor(host: string, port: number = 9100, connectTimeoutMs: number = 2000, readTimeoutMs: number = 500) {
        this.host = host
        this.port = port
        this.connectTimeoutMs = connectTimeoutMs
        this.readTimeoutMs = readTimeoutMs
    }

    get opened(): boolean {
        return !!this.socket
    }

    async openAndConfigure(): Promise<void> {
        if(this.socket) return

        const net = getNet()

        await new Promise<void>((resolve, reject) => {
            let settled = false
            const timeout = setTimeout(() => {
                if(settled) return
                settled = true
                try { this.socket?.destroy() } catch (_e) {}
                this.socket = undefined
                reject(new Error("network-connect-timeout"))
            }, this.connectTimeoutMs)

            try {
                const socket = net.createConnection({ host: this.host, port: this.port }, () => {
                    if(settled) return
                    settled = true
                    clearTimeout(timeout)
                    resolve()
                })

                socket.once("error", (err) => {
                    if(settled) return
                    settled = true
                    clearTimeout(timeout)
                    this.socket = undefined
                    reject(err)
                })

                this.socket = socket
            } catch (e) {
                if(settled) return
                settled = true
                clearTimeout(timeout)
                this.socket = undefined
                reject(e)
            }
        })
    }

    async close(): Promise<void> {
        if(!this.socket) return
        const socket = this.socket
        this.socket = undefined

        try {
            socket.end()
        } catch (_e) {
            try { socket.destroy() } catch (_e2) {}
        }
    }

    async writeData(data: Uint8Array|ArrayBuffer): Promise<void> {
        if(!this.socket) {
            throw new Error("network-not-open")
        }

        await new Promise<void>((resolve, reject) => {
            try {
                this.socket!.write(data as any, (err?: Error) => {
                    if(err) reject(err)
                    else resolve()
                })
            } catch (e) {
                reject(e)
            }
        })
    }

    async writeString(text: string): Promise<void> {
        const bytes = stringHelper.toUTF8Array(text)
        await this.writeData(bytes)
    }

    async readData(length: number): Promise<DataView|undefined> {
        if(!this.socket) {
            throw new Error("network-not-open")
        }

        const socket = this.socket
        const buffer = await new Promise<Buffer|undefined>((resolve, reject) => {
            let settled = false

            const onData = (data: Buffer) => {
                if(settled) return
                settled = true
                cleanup()
                resolve(data)
            }

            const onError = (err: Error) => {
                if(settled) return
                settled = true
                cleanup()
                reject(err)
            }

            const cleanup = () => {
                clearTimeout(timeout)
                socket.removeListener("data", onData)
                socket.removeListener("error", onError)
            }

            const timeout = setTimeout(() => {
                if(settled) return
                settled = true
                cleanup()
                resolve(undefined)
            }, this.readTimeoutMs)

            socket.once("data", onData)
            socket.once("error", onError)
        })

        if(!buffer) return undefined
        if(buffer.byteLength > length) return undefined

        return new DataView(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength))
    }

    async readString(length: number): Promise<string|undefined> {
        const bytes = await this.readData(length)
        if(bytes) return stringHelper.toString(bytes)
        return undefined
    }
}
