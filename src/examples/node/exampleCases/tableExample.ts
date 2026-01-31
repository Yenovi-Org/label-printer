import { Label } from "@/labels"
import { Table } from "@/labels/fields"
import fs from "fs"

export default async (): Promise<Label[]> => {
    const fontName = "roboto"

    const fontRegular = fs.readFileSync(__dirname+"/../Roboto-Regular.ttf").buffer
    const fontBold = fs.readFileSync(__dirname+"/../Roboto-Bold.ttf").buffer
    const fontItalic = fs.readFileSync(__dirname+"/../Roboto-Italic.ttf").buffer
    const fontBoldItalic = fs.readFileSync(__dirname+"/../Roboto-BoldItalic.ttf").buffer

    const baseFont = {name: fontName, size: 11}

    const createLabel = async (): Promise<Label> => {
        const label = new Label(20, 25)
        await label.registerFont({name: fontName, data: fontRegular, weight: 400, style: "normal"})
        await label.registerFont({name: fontName, data: fontBold, weight: 700, style: "normal"})
        await label.registerFont({name: fontName, data: fontItalic, weight: 400, style: "italic"})
        await label.registerFont({name: fontName, data: fontBoldItalic, weight: 700, style: "italic"})
        return label
    }

    const fixedLabel = await createLabel()
    const fixedSizeTable = new Table(5, 5, [
        ["Fixed", "C2", "C3", "C4"],
        ["Wrap", "This is a long text", "x", "y"],
        ["Row3", "v", "w", "z"],
    ], {
        size: { width: 150, height: 140 },
        columnWidths: [30, undefined, 20, 20],
        rowHeights: [20, undefined, 20],
        lineThickness: 2,
        cellPadding: 2,
        formatted: false,
        font: baseFont
    })
    fixedLabel.add(fixedSizeTable)

    const dynamicLabel = await createLabel()
    const dynamicSizeTable = new Table(5, 5, [
        ["Dynamic", "Auto", "Cols", "Here"],
        ["A", "BB", "CCC", "DDDD"],
        ["1", "22", "333", "4444"],
    ], {
        lineThickness: 2,
        cellPadding: 2,
        formatted: false,
        font: baseFont
    })
    dynamicLabel.add(dynamicSizeTable)

    const htmlLabel = await createLabel()
    const htmlTable = new Table(5, 5, [
        ["<b>Bold</b>", "<i>Italic</i>", "<u>U</u>", "<s>S</s>"],
        ["<b>11</b>", "<i>22</i>", "<u>33</u>", "<s>44</s>"],
        ["<b>AA</b>", "<i>BB</i>", "<u>CC</u>", "<s>DD</s>"],
    ], {
        size: { width: 150, height: 140 },
        columnWidths: [37, 37, 38, 38],
        rowHeights: [24, 24, 24],
        lineThickness: 2,
        cellPadding: 2,
        formatted: true,
        font: baseFont
    })
    htmlLabel.add(htmlTable)

    return [fixedLabel, dynamicLabel, htmlLabel]
}
