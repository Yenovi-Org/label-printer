import { TSPLRawCommand } from "@/commands/tspl";
import { PrinterLanguage } from "@/commands"
import Printer, { PrinterStatus } from "./Printer";
import Device from "@/helpers/Device";
import NetworkDevice from "@/helpers/NetworkDevice";
import { discoverBonjourServices } from "@/helpers/BonjourUtils";

export default class TSPLPrinter extends Printer {
    get language(): PrinterLanguage {
        return "tspl"
    }

    async feedLabel(): Promise<void> {
        const feedCommand = new TSPLRawCommand("FORMFEED")
        await this.writeCommand(feedCommand)
    }

    async getModelname(): Promise<string> {
        if(!this.device.opened) await this.device.openAndConfigure()
        const command = new TSPLRawCommand("~!T")
        await command.writeTo(this.device)

        const response = await this.device.readString(256)
        return (response ?? "").trim()
    }

    async getStatus(): Promise<PrinterStatus> {
        if(!this.device.opened) await this.device.openAndConfigure()

        await this.device.writeData(new Uint8Array([0x1b, 0x21, 0x3f, 0x0a]))

        const data = await this.device.readData(1)
        const raw = data ? data.getUint8(0) : 0x80

        return TSPLPrinter.statusFor(raw)
    }

    private static statusFor(code: number): PrinterStatus {
        const map: Record<number, PrinterStatus> = {
            0x00: "normal",
            0x01: "head_opened",
            0x02: "paper_jam",
            0x03: "paper_jam_head_opened",
            0x04: "out_of_paper",
            0x05: "out_of_paper_head_opened",
            0x08: "out_of_ribbon",
            0x09: "out_of_ribbon_head_opened",
            0x0A: "out_of_ribbon_paper_jam",
            0x0B: "out_of_ribbon_paper_jam_head_opened",
            0x0C: "out_of_ribbon_out_of_paper",
            0x0D: "out_of_ribbon_out_of_paper_head_opened",
            0x10: "paused",
            0x20: "printing",
            0x80: "other_error",
        }

        return map[code] ?? "other_error"
    }

    static async try(device: Device): Promise<boolean> {
        if(!device.opened) await device.openAndConfigure()
        const testCommand = new TSPLRawCommand("~!I")
        await testCommand.writeTo(device)

        const response = await device.readString(64)
        await device.close()
        // If there is a response, we have a TSPL printer
        return !!response
    }

    /**
     * Discover TSPL-capable printers on the local network.
     *
     * Strategy:
     * - Use Bonjour/mDNS to discover "printer-ish" services to obtain a set of candidate hosts.
     * - For each unique host, probe TCP/9100 by sending the TSPL identify command (~!I).
     * - Only return devices that respond to the TSPL probe.
     * - If Bonjour yields no candidates (e.g. mDNS is blocked), fall back to a conservative
     *   subnet scan on local private /24 networks (still verified by the same TSPL probe).
     */
    static async discoverDevices(): Promise<NetworkDevice[]> {
        if(typeof window !== "undefined") return []

        const services = await discoverBonjourServices([
            "pdl-datastream",
            "printer",
            "ipp",
            "ipps",
        ])

        let uniqueHosts = Array.from(new Set(services.map(s => s.host).filter(Boolean)))

        if(uniqueHosts.length === 0) {
            uniqueHosts = await TSPLPrinter.discoverHostsBySubnetScan()
        }

        const candidates = uniqueHosts.map(host => ({ host, port: 9100 }))

        const concurrency = 5
        const verified: NetworkDevice[] = []

        for (let i = 0; i < candidates.length; i += concurrency) {
            const batch = candidates.slice(i, i + concurrency)

            const results = await Promise.all(batch.map(async (c) => {
                const device = new NetworkDevice(c.host, c.port, 4000, 1000)
                try {
                    const ok = await TSPLPrinter.try(device)
                    return ok ? device : undefined
                } catch (_e) {
                    try { await device.close() } catch (_e2) {}
                    return undefined
                }
            }))

            verified.push(...(results.filter(Boolean) as NetworkDevice[]))
        }

        return verified
    }

    /**
     * Fallback discovery mechanism used when Bonjour/mDNS returns no printer candidates.
     *
     * It derives local private IPv4 /24 prefixes from the current machine's network interfaces
     * and probes TCP/9100 using the TSPL identify command.
     *
     * The scan is intentionally conservative:
     * - Limited number of prefixes
     * - Concurrency limits
     * - Total time cap
     * - Early-exit when at least one printer is found
     */
    private static async discoverHostsBySubnetScan(): Promise<string[]> {
        if(typeof window !== "undefined") return []

        const req = TSPLPrinter.getNodeRequire()
        if(!req) return []

        const os: any = req("os")
        const networkInterfaces: any = os.networkInterfaces?.() ?? {}

        const privatePrefixes = new Set<string>()

        const isPrivateIpv4 = (ip: string): boolean => {
            if(ip.startsWith("10.")) return true
            if(ip.startsWith("192.168.")) return true
            const m = ip.match(/^172\.(\d+)\./)
            if(m) {
                const n = Number(m[1])
                return n >= 16 && n <= 31
            }
            return false
        }

        for (const key of Object.keys(networkInterfaces)) {
            const infos = networkInterfaces[key] ?? []
            for (const info of infos) {
                const family = info?.family
                const address = info?.address
                const internal = info?.internal
                if(internal) continue
                if(family !== "IPv4") continue
                if(typeof address !== "string") continue
                if(!isPrivateIpv4(address)) continue

                const parts = address.split(".")
                if(parts.length !== 4) continue
                privatePrefixes.add(`${parts[0]}.${parts[1]}.${parts[2]}`)
            }
        }

        const prefixes = Array.from(privatePrefixes).slice(0, 2)
        if(prefixes.length === 0) return []

        const hosts: string[] = []
        for (const prefix of prefixes) {
            for (let i = 1; i <= 254; i++) {
                hosts.push(`${prefix}.${i}`)
            }
        }

        const concurrency = 30
        const verifiedHosts: string[] = []
        const startedAt = Date.now()
        const maxDurationMs = 15000

        for (let i = 0; i < hosts.length; i += concurrency) {
            if(Date.now() - startedAt > maxDurationMs) break
            if(verifiedHosts.length > 0) break
            const batch = hosts.slice(i, i + concurrency)
            const results = await Promise.all(batch.map(async (host) => {
                const device = new NetworkDevice(host, 9100, 800, 800)
                try {
                    const ok = await TSPLPrinter.try(device)
                    return ok ? host : undefined
                } catch (_e) {
                    try { await device.close() } catch (_e2) {}
                    return undefined
                }
            }))

            verifiedHosts.push(...(results.filter(Boolean) as string[]))
        }

        return verifiedHosts
    }

    /**
     * Returns a Node-style `require` function.
     *
     * This is used to keep runtime dependencies Node-only while still allowing the library to
     * be imported/bundled in browser contexts.
     *
     * Tests may inject a custom require implementation via `globalThis.__label_printer_require`.
     */
    private static getNodeRequire(): ((module: string) => any) | undefined {
        if(typeof window !== "undefined") return undefined

        const override = (globalThis as any).__label_printer_require
        if(typeof override === "function") return override

        // TODO: Check how to avoid eval
        return eval("require")
    }
}