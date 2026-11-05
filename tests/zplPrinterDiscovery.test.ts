import ZPLPrinter from "@/printers/ZPLPrinter"

jest.mock("@/helpers/BonjourUtils", () => {
    return {
        __esModule: true,
        discoverBonjourServices: jest.fn(),
    }
})

import { discoverBonjourServices } from "@/helpers/BonjourUtils"

describe("ZPLPrinter.discoverDevices", () => {
    afterEach(() => {
        jest.restoreAllMocks()
        delete (globalThis as any).__label_printer_require
    })

    test("returns empty list in browser environment", async () => {
        ;(global as any).window = {}
        const result = await ZPLPrinter.discoverDevices()
        expect(result).toEqual([])
        delete (global as any).window
    })

    test("probes discovered candidates and only keeps devices that respond", async () => {
        ;(discoverBonjourServices as unknown as jest.Mock).mockResolvedValue([
            { host: "10.0.0.1", port: 631, type: "ipp" },
            { host: "10.0.0.2", port: 631, type: "ipp" },
            { host: "10.0.0.3", port: 9100, type: "pdl-datastream" },
            { host: "10.0.0.4", port: 515, type: "printer" },
            { host: "10.0.0.5", port: 9100, type: "pdl-datastream" },
            { host: "10.0.0.6", port: 631, type: "ipps" },
        ])

        const trySpy = jest.spyOn(ZPLPrinter, "try")
        trySpy.mockImplementation(async (device: any) => {
            if(device.host === "10.0.0.1") return true
            if(device.host === "10.0.0.2") return false
            if(device.host === "10.0.0.3") throw new Error("boom")
            if(device.host === "10.0.0.4") return true
            if(device.host === "10.0.0.5") return false
            return true
        })

        const result = await ZPLPrinter.discoverDevices()
        expect(result.map((d: any) => d.host).sort()).toEqual(["10.0.0.1", "10.0.0.4", "10.0.0.6"].sort())
        expect(trySpy).toHaveBeenCalledTimes(6)
    })

    test("falls back to subnet scan when Bonjour returns no hosts", async () => {
        ;(discoverBonjourServices as unknown as jest.Mock).mockResolvedValue([])

        ;(globalThis as any).__label_printer_require = (module: string) => {
            if(module !== "os") throw new Error("unexpected-module")
            return {
                networkInterfaces: () => ({
                    en0: [
                        { family: "IPv4", address: "192.168.100.10", internal: false },
                    ]
                })
            }
        }

        const trySpy = jest.spyOn(ZPLPrinter, "try")
        trySpy.mockImplementation(async (device: any) => {
            return device.host === "192.168.100.1"
        })

        const result = await ZPLPrinter.discoverDevices()
        expect(result.map((d: any) => d.host)).toEqual(["192.168.100.1"])
    })

    test("subnet scan returns empty when no private IPv4 interfaces are present", async () => {
        ;(discoverBonjourServices as unknown as jest.Mock).mockResolvedValue([])

        ;(globalThis as any).__label_printer_require = (module: string) => {
            if(module !== "os") throw new Error("unexpected-module")
            return {
                networkInterfaces: () => ({
                    en0: [
                        { family: "IPv4", address: "8.8.8.8", internal: false },
                        { family: "IPv4", address: "172.15.0.1", internal: false },
                        { family: "IPv4", address: "172.32.0.1", internal: false },
                        { family: "IPv6", address: "fe80::1", internal: false },
                        { family: "IPv4", address: "192.168.1.2", internal: true },
                        { family: "IPv4", address: 1234, internal: false },
                    ]
                })
            }
        }

        const trySpy = jest.spyOn(ZPLPrinter, "try")
        const result = await ZPLPrinter.discoverDevices()
        expect(result).toEqual([])
        expect(trySpy).not.toHaveBeenCalled()
    })

    test("subnet scan supports 172.16.0.0/12 private range", async () => {
        ;(discoverBonjourServices as unknown as jest.Mock).mockResolvedValue([])

        ;(globalThis as any).__label_printer_require = (module: string) => {
            if(module !== "os") throw new Error("unexpected-module")
            return {
                networkInterfaces: () => ({
                    en0: [
                        { family: "IPv4", address: "172.16.5.4", internal: false },
                    ]
                })
            }
        }

        jest.spyOn(ZPLPrinter, "try").mockImplementation(async (device: any) => {
            return device.host === "172.16.5.1"
        })

        const result = await ZPLPrinter.discoverDevices()
        expect(result.map((d: any) => d.host)).toEqual(["172.16.5.1"])
    })
})

describe("ZPLPrinter commands", () => {
    const device = (response?: string, opened: boolean = true) => ({
        opened,
        openAndConfigure: jest.fn().mockResolvedValue(undefined),
        writeString: jest.fn().mockResolvedValue(undefined),
        readString: jest.fn().mockResolvedValue(response),
        close: jest.fn().mockResolvedValue(undefined),
    }) as any

    test("reports zpl as its language", () => {
        expect(new ZPLPrinter(device()).language).toBe("zpl")
    })

    test("feedLabel opens a closed device and sends ^PF", async () => {
        const d = device(undefined, false)
        await new ZPLPrinter(d).feedLabel()
        expect(d.openAndConfigure).toHaveBeenCalled()
        expect(d.writeString).toHaveBeenCalledWith("^PF\r\n")
    })

    test("getModelname is empty and getStatus is an error when the printer doesn't answer", async () => {
        expect(await new ZPLPrinter(device(undefined, false)).getModelname()).toBe("")
        expect(await new ZPLPrinter(device(undefined)).getStatus()).toBe("other_error")
    })

    test("getStatus is an error for an answer that is not ~HS", async () => {
        expect(await new ZPLPrinter(device("hello")).getStatus()).toBe("other_error")
    })

    test("getStatus reports combined problems, memory errors and head open", async () => {
        const hs = (first: string, second: string) => `\x02${first}\x03\r\n\x02${second}\x03\r\n\x02000,0\x03\r\n`
        const ok1 = "030,0,0,1234,000,0,0,0,000,0,0,0"
        const ok2 = "000,0,0,0,0,2,4,0,00000000,1,000"
        const status = (a: string, b: string) => new ZPLPrinter(device(hs(a, b))).getStatus()

        expect(await status("030,1,0,1234,000,0,0,0,000,0,0,0", "000,0,1,1,0,2,4,0,00000000,1,000")).toBe("out_of_ribbon_out_of_paper_head_opened")
        expect(await status("030,1,0,1234,000,0,0,0,000,0,0,0", "000,0,0,1,0,2,4,0,00000000,1,000")).toBe("out_of_ribbon_out_of_paper")
        expect(await status(ok1, "000,0,1,1,0,2,4,0,00000000,1,000")).toBe("out_of_ribbon_head_opened")
        expect(await status("030,1,0,1234,000,0,0,0,000,0,0,0", "000,0,1,0,0,2,4,0,00000000,1,000")).toBe("out_of_paper_head_opened")
        expect(await status("030,0,0,1234,000,0,0,0,000,1,0,0", ok2)).toBe("other_error")
        expect(await status("030,0,0,1234,000,0,0,0,000,0,1,0", ok2)).toBe("other_error")
        expect(await status("030,0,0,1234,000,0,0,0,000,0,0,1", ok2)).toBe("other_error")
        expect(await status(ok1, "000,0,0,0,0,2,4,0,00000003,1,000")).toBe("printing")
    })

    test("try closes the device and only accepts ~HI answers", async () => {
        const d = device("\x02ZT411-200dpi,V92.21.46Z,8,8176KB\x03\r\n", false)
        expect(await ZPLPrinter.try(d)).toBe(true)
        expect(d.openAndConfigure).toHaveBeenCalled()
        expect(d.close).toHaveBeenCalled()
        expect(await ZPLPrinter.try(device("~!I"))).toBe(false)
    })
})

describe("ZPLPrinter discovery in a bundled environment", () => {
    afterEach(() => {
        jest.restoreAllMocks()
        delete (globalThis as any).__label_printer_require
    })

    test("falls back to the global require to read the network interfaces", async () => {
        ;(discoverBonjourServices as unknown as jest.Mock).mockResolvedValue([])
        ;(globalThis as any).__label_printer_require = () => ({ networkInterfaces: () => undefined })

        const trySpy = jest.spyOn(ZPLPrinter, "try")
        expect(await ZPLPrinter.discoverDevices()).toEqual([])
        expect(trySpy).not.toHaveBeenCalled()
    })

    test("closes the device when a probe throws during the subnet scan", async () => {
        ;(discoverBonjourServices as unknown as jest.Mock).mockResolvedValue([])
        ;(globalThis as any).__label_printer_require = () => ({
            networkInterfaces: () => ({ en0: [{ family: "IPv4", address: "10.1.2.3", internal: false }] })
        })

        jest.spyOn(ZPLPrinter, "try").mockImplementation(async (device: any) => {
            if(device.host === "10.1.2.2") throw new Error("boom")
            return device.host === "10.1.2.4"
        })

        const result = await ZPLPrinter.discoverDevices()
        expect(result.map((d: any) => d.host)).toEqual(["10.1.2.4"])
    })
})
