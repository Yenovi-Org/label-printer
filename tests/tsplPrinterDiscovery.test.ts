import TSPLPrinter from "@/printers/TSPLPrinter"

jest.mock("@/helpers/BonjourUtils", () => {
    return {
        __esModule: true,
        discoverBonjourServices: jest.fn(),
    }
})

import { discoverBonjourServices } from "@/helpers/BonjourUtils"

describe("TSPLPrinter.discoverDevices", () => {
    afterEach(() => {
        jest.restoreAllMocks()
        delete (globalThis as any).__label_printer_require
    })

    test("returns empty list in browser environment", async () => {
        ;(global as any).window = {}
        const result = await TSPLPrinter.discoverDevices()
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

        const trySpy = jest.spyOn(TSPLPrinter, "try")
        trySpy.mockImplementation(async (device: any) => {
            if(device.host === "10.0.0.1") return true
            if(device.host === "10.0.0.2") return false
            if(device.host === "10.0.0.3") throw new Error("boom")
            if(device.host === "10.0.0.4") return true
            if(device.host === "10.0.0.5") return false
            return true
        })

        const result = await TSPLPrinter.discoverDevices()
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

        const trySpy = jest.spyOn(TSPLPrinter, "try")
        trySpy.mockImplementation(async (device: any) => {
            return device.host === "192.168.100.1"
        })

        const result = await TSPLPrinter.discoverDevices()
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

        const trySpy = jest.spyOn(TSPLPrinter, "try")
        const result = await TSPLPrinter.discoverDevices()
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

        jest.spyOn(TSPLPrinter, "try").mockImplementation(async (device: any) => {
            return device.host === "172.16.5.1"
        })

        const result = await TSPLPrinter.discoverDevices()
        expect(result.map((d: any) => d.host)).toEqual(["172.16.5.1"])
    })
})
