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

test("Label chooses closest weight when exact match missing", async () => {
    const label = new Label(50, 25)

    await label.registerFont({
        name: "family",
        data: new Uint8Array([1]).buffer,
        weight: 400,
        style: "normal",
    })

    await label.registerFont({
        name: "family",
        data: new Uint8Array([2]).buffer,
        weight: 700,
        style: "normal",
    })

    // Request weight 600 => closer to 700 than 400
    const fontName = label.printConfig.getFontName({ name: "family", size: 12, weight: 600, style: "normal" })
    // second registered font is f1.*
    expect(fontName.startsWith("f1.")).toBe(true)
})

test("Label falls back to first font when requested style missing", async () => {
    const label = new Label(50, 25)

    await label.registerFont({
        name: "family",
        data: new Uint8Array([1]).buffer,
        weight: 400,
        style: "normal",
    })

    await label.registerFont({
        name: "family",
        data: new Uint8Array([2]).buffer,
        weight: 400,
        style: "italic",
    })

    // Request style 'oblique' doesn't exist => should fall back to first registered font key
    const fontName = label.printConfig.getFontName({ name: "family", size: 12, weight: 400, style: "oblique" as any })
    expect(fontName.startsWith("f0.")).toBe(true)
})
