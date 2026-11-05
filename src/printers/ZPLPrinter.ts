import { PrinterLanguage } from "@/commands"
import Printer, { PrinterStatus } from "./Printer"
import Device from "@/helpers/Device"
import NetworkDevice from "@/helpers/NetworkDevice"
import { discoverBonjourServices } from "@/helpers/BonjourUtils"

export default class ZPLPrinter extends Printer {
    get language(): PrinterLanguage {
        return "zpl"
    }

    async feedLabel(): Promise<void> {
        if (!this.device.opened) await this.device.openAndConfigure()
        await this.device.writeString("^PF\r\n")
    }

    async getModelname(): Promise<string> {
        if (!this.device.opened) await this.device.openAndConfigure()
        await this.device.writeString("~HI\r\n")

        const response = await this.device.readString(256)
        return ZPLPrinter.parseHostIdentification(response)?.model ?? ""
    }

    async getStatus(): Promise<PrinterStatus> {
        if (!this.device.opened) await this.device.openAndConfigure()
        await this.device.writeString("~HS\r\n")

        const response = await this.device.readString(512)
        if (!response) return "other_error"
        return ZPLPrinter.parseStatus(response)
    }

    /**
     * ~HI answers with <STX>model,firmware,dpi,memory,...<ETX> (not quoted)
     */
    private static parseHostIdentification(response: string | undefined): { model: string, firmware: string } | undefined {
        if (!response) return undefined
        const match = response.replace(/[\x02\x03]/g, "\n").match(/^\s*([^,\r\n]+),\s*(V?\d[^,\r\n]*),\s*(\d+)/m)
        if (!match) return undefined
        return { model: match[1].trim(), firmware: match[2].trim() }
    }

    /**
     * ~HS answers with three <STX>...<ETX> strings. The first two are used:
     * 1. aaa,b,c,dddd,eee,f,g,h,iii,j,k,l: b paper out, c pause, eee formats in buffer, j corrupt RAM,
     *    k under temperature, l over temperature
     * 2. mmm,n,o,p,q,r,s,t,uuuuuuuu,v,www: o head up, p ribbon out, uuuuuuuu labels left in batch
     */
    private static parseStatus(response: string): PrinterStatus {
        const strings = response
            .split(/[\x02\x03]/)
            .map(l => l.trim())
            .filter(l => l.length > 0)
            .map(l => l.split(",").map(f => f.trim()))

        if (strings.length < 2 || strings[0].length < 12 || strings[1].length < 9) return "other_error"
        const [first, second] = strings
        const flag = (fields: string[], i: number) => fields[i] === "1"

        const paperOut = flag(first, 1)
        const headOpen = flag(second, 2)
        const ribbonOut = flag(second, 3)

        if (ribbonOut && paperOut) return headOpen ? "out_of_ribbon_out_of_paper_head_opened" : "out_of_ribbon_out_of_paper"
        if (ribbonOut) return headOpen ? "out_of_ribbon_head_opened" : "out_of_ribbon"
        if (paperOut) return headOpen ? "out_of_paper_head_opened" : "out_of_paper"
        if (headOpen) return "head_opened"
        if (flag(first, 9) || flag(first, 10) || flag(first, 11)) return "other_error"
        if (flag(first, 2)) return "paused"
        if ((parseInt(first[4], 10) || 0) > 0 || (parseInt(second[8], 10) || 0) > 0) return "printing"
        return "normal"
    }

    static async try(device: Device): Promise<boolean> {
        if (!device.opened) await device.openAndConfigure()

        // The line break ends the line on printers that don't speak ZPL, so the unknown command
        // doesn't stick to the next one they receive
        await device.writeString("~HI\r\n")
        const response = await device.readString(64)
        await device.close()

        return ZPLPrinter.parseHostIdentification(response) !== undefined
    }

    static async discoverDevices(): Promise<NetworkDevice[]> {
        if (typeof window !== "undefined") return []

        const services = await discoverBonjourServices([
            "pdl-datastream",
            "printer",
            "ipp",
            "ipps",
        ])

        let uniqueHosts = Array.from(new Set(services.map(s => s.host).filter(Boolean)))

        if (uniqueHosts.length === 0) {
            uniqueHosts = await ZPLPrinter.discoverHostsBySubnetScan()
        }

        const candidates = uniqueHosts.map(host => ({ host, port: 9100 }))
        const concurrency = 5
        const verified: NetworkDevice[] = []

        for (let i = 0; i < candidates.length; i += concurrency) {
            const batch = candidates.slice(i, i + concurrency)
            const results = await Promise.all(batch.map(async (c) => {
                const device = new NetworkDevice(c.host, c.port, 4000, 1000)
                try {
                    const ok = await ZPLPrinter.try(device)
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

    private static async discoverHostsBySubnetScan(): Promise<string[]> {
        if (typeof window !== "undefined") return []

        const req = ZPLPrinter.getNodeRequire()
        if (!req) return []

        const os: any = req("os")
        const networkInterfaces: any = os.networkInterfaces?.() ?? {}

        const privatePrefixes = new Set<string>()

        const isPrivateIpv4 = (ip: string): boolean => {
            if (ip.startsWith("10.")) return true
            if (ip.startsWith("192.168.")) return true
            const m = ip.match(/^172\.(\d+)\./)
            if (m) {
                const n = Number(m[1])
                return n >= 16 && n <= 31
            }
            return false
        }

        for (const key of Object.keys(networkInterfaces)) {
            const infos = networkInterfaces[key] ?? []
            for (const info of infos) {
                if (info?.internal) continue
                if (info?.family !== "IPv4") continue
                if (typeof info?.address !== "string") continue
                if (!isPrivateIpv4(info.address)) continue
                const parts = info.address.split(".")
                if (parts.length !== 4) continue
                privatePrefixes.add(`${parts[0]}.${parts[1]}.${parts[2]}`)
            }
        }

        const prefixes = Array.from(privatePrefixes).slice(0, 2)
        if (prefixes.length === 0) return []

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
            if (Date.now() - startedAt > maxDurationMs) break
            if (verifiedHosts.length > 0) break
            const batch = hosts.slice(i, i + concurrency)
            const results = await Promise.all(batch.map(async (host) => {
                const device = new NetworkDevice(host, 9100, 800, 800)
                try {
                    const ok = await ZPLPrinter.try(device)
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

    private static getNodeRequire(): ((module: string) => any) | undefined {
        if (typeof window !== "undefined") return undefined
        const override = (globalThis as any).__label_printer_require
        if (typeof override === "function") return override
        // TODO: Check how to avoid eval
        return eval("require")
    }
}
