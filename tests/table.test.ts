import { Label } from "@/labels"
import { Table } from "@/labels/fields"

function commandStrings(label: Label) {
    return label.commandForLanguage("tspl").then(cmd => {
        const lines: string[] = []
        cmd.print((c) => lines.push(c))
        return lines
    })
}

test("Table generates grid lines and cell texts", async () => {
    const label = new Label(50, 25)

    const table = new Table(10, 10, [
        ["A1", "A2"],
        ["B1", "B2"],
    ], {
        size: { width: 200, height: 100 },
        columnWidths: [80, 120],
        rowHeights: [40, 60],
        lineThickness: 2,
        cellPadding: 4,
        formatted: false,
        font: { name: "default", size: 10 }
    })

    label.add(table)

    const lines = await commandStrings(label)

    expect(lines.some(l => l.startsWith("DIAGONAL"))).toBe(true)
    expect(lines.filter(l => l.startsWith("DIAGONAL")).length).toBe(6)

    expect(lines.some(l => l.startsWith("TEXT"))).toBe(true)
    expect(lines.filter(l => l.startsWith("TEXT")).length).toBe(4)
})

test("Table wraps text by limiting cell width", async () => {
    const label = new Label(50, 25)

    const table = new Table(0, 0, [
        ["This is a long text that should wrap"],
    ], {
        size: { width: 60, height: 40 },
        columnWidths: [60],
        rowHeights: [40],
        cellPadding: 2,
        formatted: false,
        font: { name: "default", size: 10 }
    })

    label.add(table)

    const lines = await commandStrings(label)
    expect(lines.filter(l => l.startsWith("TEXT")).length).toBeGreaterThan(1)
})
