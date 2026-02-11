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

test("Text formatted supports <p> tags for newlines", async () => {
    const label = new Label(50, 25)

    const text = new Text("<p>First</p><p>Second</p>", 10, 10, true)
    text.setFont({ name: "default", size: 20 })
    label.add(text)

    const lines = await commandStrings(label)
    const textLines = lines.filter(l => l.startsWith("TEXT"))
    expect(textLines.length).toBeGreaterThanOrEqual(2)

    const ys = textLines.map(l => {
        const match = l.match(/^TEXT\s+\d+,(\d+),/)
        if(!match) throw new Error(`Unexpected TEXT command: ${l}`)
        return Number(match[1])
    })

    // There should be at least two distinct y positions (paragraphs printed on different lines)
    expect(new Set(ys).size).toBeGreaterThanOrEqual(2)
})

test("Text formatted supports <br/> for newlines", async () => {
    const label = new Label(50, 25)

    const text = new Text("Hello<br/>World", 10, 10, true)
    text.setFont({ name: "default", size: 20 })
    label.add(text)

    const lines = await commandStrings(label)
    const textLines = lines.filter(l => l.startsWith("TEXT"))
    expect(textLines.length).toBeGreaterThanOrEqual(2)

    const ys = textLines.map(l => {
        const match = l.match(/^TEXT\s+\d+,(\d+),/)
        if(!match) throw new Error(`Unexpected TEXT command: ${l}`)
        return Number(match[1])
    })
    expect(new Set(ys).size).toBeGreaterThanOrEqual(2)
})

test("Text formatted <p> ending with <br> does not add an extra newline", async () => {
    const label = new Label(50, 25)

    const text = new Text("<p>First<br/></p><p>Second</p>", 10, 10, true)
    text.setFont({ name: "default", size: 20 })
    label.add(text)

    const lines = await commandStrings(label)
    const textLines = lines.filter(l => l.startsWith("TEXT"))
    expect(textLines.length).toBeGreaterThanOrEqual(2)

    const ys = textLines.map(l => {
        const match = l.match(/^TEXT\s+\d+,(\d+),/)
        if(!match) throw new Error(`Unexpected TEXT command: ${l}`)
        return Number(match[1])
    }).sort((a,b) => a-b)

    // Expect exactly two y positions (one per paragraph), not three (which would imply a double newline)
    expect(new Set(ys).size).toBe(2)
})

test("Text formatted <p> ending with nested <br> does not add an extra newline", async () => {
    const label = new Label(50, 25)

    const text = new Text("<p>First<i><br/></i></p><p>Second</p>", 10, 10, true)
    text.setFont({ name: "default", size: 20 })
    label.add(text)

    const lines = await commandStrings(label)
    const textLines = lines.filter(l => l.startsWith("TEXT"))
    expect(textLines.length).toBeGreaterThanOrEqual(2)

    const ys = textLines.map(l => {
        const match = l.match(/^TEXT\s+\d+,(\d+),/)
        if(!match) throw new Error(`Unexpected TEXT command: ${l}`)
        return Number(match[1])
    })

    expect(new Set(ys).size).toBe(2)
})

test("Text formatted consecutive <p> tags do not create empty lines", async () => {
    const label = new Label(50, 25)

    const text = new Text("<p>One</p><p>Two</p><p>Three</p>", 10, 10, true)
    text.setFont({ name: "default", size: 20 })
    label.add(text)

    const lines = await commandStrings(label)
    const textLines = lines.filter(l => l.startsWith("TEXT"))

    const ys = textLines.map(l => {
        const match = l.match(/^TEXT\s+\d+,(\d+),/)
        if(!match) throw new Error(`Unexpected TEXT command: ${l}`)
        return Number(match[1])
    })

    // No blank line between paragraphs => should use exactly 3 line y positions
    expect(new Set(ys).size).toBe(3)
})
