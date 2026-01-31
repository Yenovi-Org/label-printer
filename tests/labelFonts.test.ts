import { Label } from "@/labels"

jest.mock("fontkit", () => {
    return {
        __esModule: true,
        create: jest.fn(() => {
            return {
                unitsPerEm: 1000,
                layout: (_text: string) => ({ advanceWidth: 500 }),
            }
        })
    }
})

test("Label printConfig.textWidth uses fallback when font not registered", () => {
    const label = new Label(50, 25, "metric", 203)

    const width = label.printConfig.textWidth("abcd", { name: "missing", size: 10 })
    expect(width).toBe(4 * 10)
})

test("Label printConfig.textWidth uses registered font and converts points to dots", async () => {
    const label = new Label(50, 25, "metric", 203)

    await label.registerFont({
        name: "test",
        data: new Uint8Array([0, 1, 2, 3]).buffer,
        weight: 400,
        style: "normal",
    })

    const width = label.printConfig.textWidth("A", { name: "test", size: 10, weight: 400, style: "normal" })

    // size=10 dots => dotToPoint(10,203) rounds to 4 points
    // scaledWidth=4 * 500 / 1000 = 2 points => pointsToDots(2,203) = 2*203/72
    expect(width).toBeCloseTo((2 * 203) / 72)
})

test("Label printConfig.getFontName returns font alias for registered fonts", async () => {
    const label = new Label(50, 25)

    await label.registerFont({
        name: "test",
        data: new Uint8Array([0, 1, 2, 3]).buffer,
        weight: 400,
        style: "normal",
    })

    const fontName = label.printConfig.getFontName({ name: "test", size: 12, weight: 400, style: "normal" })
    expect(fontName.startsWith("f0.")).toBe(true)
})
