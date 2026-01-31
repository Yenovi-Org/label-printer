import { Label } from "@/labels"
import { Table } from "@/labels/fields"
import fs from "fs"

export default async (): Promise<Label> => {
    const fontName = "roboto"

    const fontRegular = fs.readFileSync(__dirname+"/Roboto-Regular.ttf").buffer
    const fontBold = fs.readFileSync(__dirname+"/Roboto-Bold.ttf").buffer
    const fontItalic = fs.readFileSync(__dirname+"/Roboto-Italic.ttf").buffer
    const fontBoldItalic = fs.readFileSync(__dirname+"/Roboto-BoldItalic.ttf").buffer

    const label = new Label(50, 25)

    await label.registerFont({name: fontName, data: fontRegular, weight: 400, style: "normal"})
    await label.registerFont({name: fontName, data: fontBold, weight: 700, style: "normal"})
    await label.registerFont({name: fontName, data: fontItalic, weight: 400, style: "italic"})
    await label.registerFont({name: fontName, data: fontBoldItalic, weight: 700, style: "italic"})

    const baseFont = {name: fontName, size: 16}

    const fixedSizeTable = new Table(10, 10, [
        ["Fixed", "80/auto"],
        ["Wrap", "This is a long text that should wrap into multiple lines"],
    ], {
        size: { width: 360, height: 70 },
        columnWidths: [80, undefined],
        rowHeights: [28, undefined],
        lineThickness: 2,
        cellPadding: 6,
        formatted: false,
        font: baseFont
    })

    const dynamicSizeTable = new Table(10, 90, [
        ["Dynamic", "Column widths"],
        ["Auto", "Sized from content"],
    ], {
        lineThickness: 2,
        cellPadding: 6,
        formatted: false,
        font: baseFont
    })

    const htmlTable = new Table(10, 150, [
        ["<b>Bold</b>", "<i>Italic</i>"],
        ["<u>Underline</u>", "<s>Strike</s>"],
    ], {
        size: { width: 360, height: 60 },
        columnWidths: [180, 180],
        rowHeights: [30, 30],
        lineThickness: 2,
        cellPadding: 6,
        formatted: true,
        font: baseFont
    })

    label.add(fixedSizeTable, dynamicSizeTable, htmlTable)

    return label
}
