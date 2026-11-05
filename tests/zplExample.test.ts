import zplExample from "@/examples/node/exampleCases/zplExample"

test("ZPL example labels generate complete ZPL", async () => {
    const labels = await zplExample()
    expect(labels).toHaveLength(5)

    for (const label of labels) {
        const lines: string[] = []
        const command = await label.fullPrintCommand("zpl", 2, "normal", 1)
        command.print(l => lines.push(l))
        const output = lines.join("\n")

        expect(output).toContain("^XA^CI28")
        expect(output.trimEnd().endsWith("^PQ1^XZ")).toBe(true)
        // Every field is closed (graphic fields too)
        const fields = (output.match(/\^FO/g) ?? []).length
        expect(fields).toBeGreaterThan(5)
        expect((output.match(/\^FS/g) ?? []).length).toBe(fields)
        expect(output).not.toContain("NaN")
        expect(output).not.toContain("undefined")
    }
}, 30000)
