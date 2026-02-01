import Label from "@/labels/Label";

jest.mock("fontkit", () => ({
    create: () => ({
        fonts: [
            {
                unitsPerEm: 1000,
                layout: () => ({ advanceWidth: 500 }),
            },
        ],
    }),
}));

describe("Label full commands", () => {
    test("fullPrintCommand includes setup, font upload, and print", async () => {
        const label = new Label(50, 30, "metric", 203)

        await label.registerFont({
            name: "MyFont",
            data: new ArrayBuffer(4),
            weight: 400,
            style: "normal",
        })

        const cmd = await label.fullPrintCommand("tspl", 2, "normal", 1, 2)

        const printed: string[] = []
        cmd.print((s) => printed.push(s))

        expect(printed.some((s) => s.startsWith("DOWNLOAD \"f0.TTF\""))).toBe(true)
        expect(printed.some((s) => s.startsWith("SIZE "))).toBe(true)
        expect(printed.some((s) => s.startsWith("GAP "))).toBe(true)
        expect(printed).toContain("PRINT 1, 2")
    })

    test("fullDisplayCommand includes setup and display commands", async () => {
        const label = new Label(50, 30, "metric", 203)

        const cmd = await label.fullDisplayCommand("tspl", "normal")

        const printed: string[] = []
        cmd.print((s) => printed.push(s))

        expect(printed).toContain("DISPLAY CLS")
        expect(printed).toContain("DISPLAY IMAGE")
    })

    test("getFontName falls back to requested name when font is not registered", async () => {
        const label = new Label(50, 30, "metric", 203)

        expect(label.printConfig.getFontName({ name: "UnknownFont", size: 10 })).toBe("UnknownFont")

        await label.registerFont({
            name: "MyFont",
            data: new ArrayBuffer(4),
            weight: 400,
            style: "normal",
        })

        expect(label.printConfig.getFontName({ name: "MyFont", size: 10 })).toBe("f0.TTF")
    })
})
