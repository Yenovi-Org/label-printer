import { getNetworkTargetsFromEnv } from "@/helpers/NetworkUtils"

describe("NetworkUtils.getNetworkTargetsFromEnv", () => {
    const originalEnv = process.env

    beforeEach(() => {
        process.env = { ...originalEnv }
    })

    afterEach(() => {
        process.env = originalEnv
    })

    test("returns empty list when env var is not set", () => {
        delete process.env.LABEL_PRINTER_NETWORK_TARGETS
        expect(getNetworkTargetsFromEnv()).toEqual([])
    })

    test("parses host:port entries", () => {
        process.env.LABEL_PRINTER_NETWORK_TARGETS = "192.168.0.10:9100,192.168.0.11:9101"
        expect(getNetworkTargetsFromEnv()).toEqual([
            { host: "192.168.0.10", port: 9100 },
            { host: "192.168.0.11", port: 9101 },
        ])
    })

    test("parses host without port", () => {
        process.env.LABEL_PRINTER_NETWORK_TARGETS = "printer.local"
        expect(getNetworkTargetsFromEnv()).toEqual([
            { host: "printer.local", port: undefined },
        ])
    })
})
