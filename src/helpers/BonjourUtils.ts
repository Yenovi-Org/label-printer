const unsupportedBonjourError = "bonjour-unsupported"

type BonjourBrowser = {
    stop(): void
    on(event: "up", listener: (service: any) => void): any
}

type BonjourInstance = {
    find(options: { type: string }, cb?: (service: any) => void): BonjourBrowser
    destroy(): void
}

const getBonjour = (): (() => BonjourInstance) => {
    if(typeof window !== "undefined") {
        throw unsupportedBonjourError
    }

    // TODO: Check how to avoid eval
    const mod: any = eval("require")("bonjour")
    const factory: any = (mod && (mod.default ?? mod))
    if(typeof factory !== "function") {
        throw new Error("bonjour-invalid-module")
    }
    return factory as () => BonjourInstance
}

export type BonjourService = {
    host: string
    port: number
    name?: string
    type?: string
}

/**
 * Discover services using Bonjour/mDNS.
 *
 * This is a Node-only helper. It dynamically requires the `bonjour` module so the library can
 * still be imported/bundled in browser contexts.
 *
 * @param types Bonjour service types without the leading underscore (e.g. `printer`, `ipp`)
 * @param timeoutMs Discovery window
 */
export const discoverBonjourServices = async (types: string[], timeoutMs: number = 1500): Promise<BonjourService[]> => {
    if(typeof window !== "undefined") return []

    const factory = getBonjour()
    const bonjour = factory()

    try {
        const results: BonjourService[] = []
        const seen = new Set<string>()

        const browsers: BonjourBrowser[] = types.map((type) => {
            return bonjour.find({ type }, (service: any) => {
                const host = service?.referer?.address || service?.host
                const port = service?.port
                if(!host || !port) return

                const key = `${host}:${port}`
                if(seen.has(key)) return
                seen.add(key)

                results.push({ host, port, name: service?.name, type })
            })
        })

        await new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))

        for (const browser of browsers) {
            try { browser.stop() } catch (_e) {}
        }

        return results
    } finally {
        try { bonjour.destroy() } catch (_e) {}
    }
}
