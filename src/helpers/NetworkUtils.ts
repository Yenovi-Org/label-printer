import NetworkDevice from "./NetworkDevice";

export type NetworkTarget = {
    host: string
    port?: number
}

export const getNetworkTargetsFromEnv = (): NetworkTarget[] => {
    if(typeof window !== "undefined") return []

    const raw = process.env.LABEL_PRINTER_NETWORK_TARGETS
    if(!raw) return []

    return raw
        .split(",")
        .map(s => s.trim())
        .filter(Boolean)
        .map((entry) => {
            const [host, portRaw] = entry.split(":")
            const port = portRaw ? Number(portRaw) : undefined
            return { host, port }
        })
        .filter(t => !!t.host)
}

export const createNetworkDevices = (targets: NetworkTarget[]): NetworkDevice[] => {
    return targets.map(t => new NetworkDevice(t.host, t.port))
}
