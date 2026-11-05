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

    test("ZPL fullPrintCommand wraps in ^XA/^XZ and includes font upload", async () => {
        const label = new Label(50, 30, "metric", 203)

        await label.registerFont({
            name: "MyFont",
            data: new ArrayBuffer(4),
            weight: 400,
            style: "normal",
        })

        const cmd = await label.fullPrintCommand("zpl", 2, "normal", 1, 2)

        const printed: string[] = []
        cmd.print((s) => printed.push(s))

        const fullOutput = printed.join("\n")
        expect(fullOutput).toContain("^XA")
        expect(fullOutput).toContain("^PW")
        expect(fullOutput).toContain("^LL")
        expect(fullOutput).toContain("^XZ")
        expect(printed.some((s) => s.startsWith("~DYR:f0,B,T"))).toBe(true)
        expect(printed.some((s) => s.includes("^PQ2^XZ"))).toBe(true)
    })

    test("ZPL fullPrintCommand converts mm to dots using label DPI", async () => {
        // 25.4mm × 203 dpi = 203 dots
        const label = new Label(25.4, 25.4, "metric", 203)
        const cmd = await label.fullPrintCommand("zpl", 0, "normal", 1)

        const printed: string[] = []
        cmd.print((s) => printed.push(s))
        const fullOutput = printed.join("\n")

        expect(fullOutput).toContain("^PW203")
        expect(fullOutput).toContain("^LL203")
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
