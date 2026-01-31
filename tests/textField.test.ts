import { Label } from "@/labels"
import { Text } from "@/labels/fields"

function commandStrings(label: Label) {
    return label.commandForLanguage("tspl").then(cmd => {
        const lines: string[] = []
        cmd.print((c) => lines.push(c))
        return lines
    })
}

test("Text unformatted generates single TEXT command", async () => {
    const label = new Label(50, 25)
    const text = new Text("Hello", 10, 10, false)
    label.add(text)

    const lines = await commandStrings(label)
    expect(lines.filter(l => l.startsWith("TEXT"))).toHaveLength(1)
})

test("Text formatted underline/strike generates extra line commands", async () => {
    const label = new Label(50, 25)

    const text = new Text("<u>U</u><s>S</s>", 10, 10, true)
    text.setFont({ name: "default", size: 20 })
    label.add(text)

    const lines = await commandStrings(label)

    // underline and strike are implemented via generator.line => DIAGONAL commands
    expect(lines.some(l => l.startsWith("DIAGONAL"))).toBe(true)
    expect(lines.filter(l => l.startsWith("TEXT")).length).toBeGreaterThanOrEqual(2)
})

test("Text multiline wraps when width is small", async () => {
    const label = new Label(50, 25)

    const text = new Text("This is a long text that should wrap", 0, 0, false)
    text.setFont({ name: "default", size: 10 })
    text.setMultiLine(40, 60)
    label.add(text)

    const lines = await commandStrings(label)
    expect(lines.filter(l => l.startsWith("TEXT")).length).toBeGreaterThan(1)
})
