import { discoverBonjourServices } from "@/helpers/BonjourUtils"

describe("BonjourUtils.discoverBonjourServices", () => {
    test("returns empty list in browser environment", async () => {
        ;(global as any).window = {}
        const result = await discoverBonjourServices(["printer"], 10)
        expect(result).toEqual([])
        delete (global as any).window
    })
})
