import { Command, Point, PrinterLanguage } from "@/commands";
import { isWhitespace } from "@/helpers/StringUtils";
import LabelField from "./superClasses/LabelField";
import RotatableLabelField from "./superClasses/RotatableLabelField";
import { PositionedField } from "./superClasses/interfaces";
import Line from "./Line";
import Text from "./Text";
import { PrintConfig } from "../Printable";
import { FontOption } from "../types";

export type TableCellContent = string

export type TableSize = {
    width?: number,
    height?: number
}

type SizeSpec = number|undefined

export type TableOptions = {
    size?: TableSize,
    columnWidths?: SizeSpec[],
    rowHeights?: SizeSpec[],
    lineThickness?: number,
    cellPadding?: number,
    formatted?: boolean,
    font?: FontOption
}

export default class Table extends RotatableLabelField implements PositionedField {
    private x: number
    private y: number
    private readonly rows: TableCellContent[][]

    private size: TableSize|undefined
    private columnWidths: SizeSpec[]|undefined
    private rowHeights: SizeSpec[]|undefined

    private lineThickness: number
    private cellPadding: number
    private formatted: boolean
    private font: FontOption

    constructor(x: number, y: number, rows: TableCellContent[][], options: TableOptions = {}) {
        super()
        this.x = x
        this.y = y
        this.rows = rows

        this.size = options.size
        this.columnWidths = options.columnWidths
        this.rowHeights = options.rowHeights
        this.lineThickness = options.lineThickness ?? 2
        this.cellPadding = options.cellPadding ?? 4
        this.formatted = options.formatted ?? true
        this.font = options.font ?? {name: "default", size: 10}
    }

    setSize(size: TableSize) {
        this.size = size
    }

    setColumnWidths(widths: SizeSpec[]) {
        this.columnWidths = widths
    }

    setRowHeights(heights: SizeSpec[]) {
        this.rowHeights = heights
    }

    setLineThickness(thickness: number) {
        this.lineThickness = thickness
    }

    setCellPadding(padding: number) {
        this.cellPadding = padding
    }

    setFormatted(formatted: boolean) {
        this.formatted = formatted
    }

    setFont(font: FontOption) {
        this.font = font
    }

    getPosition(): Point { return { x: this.x, y: this.y } }
    setPosition(position: Point) { this.x = position.x; this.y = position.y }

    async commandForLanguage(language: PrinterLanguage, config?: PrintConfig): Promise<Command> {
        // Table rendering is implemented by composing existing primitives:
        // - Text fields for cell contents
        // - Line fields for the grid
        const generator = this.commandGeneratorFor(language)

        const rowCount = this.rows.length
        const colCount = Math.max(0, ...this.rows.map(r => r.length))

        // Resolve column widths.
        // If the overall table width is provided, unspecified columns share the remaining width.
        // Otherwise, unspecified columns are measured from content.
        const resolvedColumnWidths = this.resolveTrackSizes({
            trackCount: colCount,
            explicitSizes: this.columnWidths,
            total: this.size?.width,
            measure: (i) => this.measureAutoColumnWidth(i, colCount, config)
        })

        // Resolve row heights.
        // If the overall table height is provided, unspecified rows share the remaining height.
        // Otherwise, unspecified rows are measured from content and the resolved column widths.
        const resolvedRowHeights = this.resolveTrackSizes({
            trackCount: rowCount,
            explicitSizes: this.rowHeights,
            total: this.size?.height,
            measure: (i) => this.measureAutoRowHeight(i, resolvedColumnWidths, config)
        })

        // Convert widths/heights into absolute X/Y positions.
        const xPositions = this.accumulatePositions(this.x, resolvedColumnWidths)
        const yPositions = this.accumulatePositions(this.y, resolvedRowHeights)

        // Total table dimensions — needed before field creation so rotatePoint can use them.
        const totalWidth = resolvedColumnWidths.reduce((a, b) => a + b, 0)
        const totalHeight = resolvedRowHeights.reduce((a, b) => a + b, 0)

        // We generate an internal list of LabelFields and then group their commands.
        // This ensures we reuse the exact behavior of the existing Text and Line fields.
        const fields: LabelField[] = []

        // Create a Text field for each cell.
        // Cell text is constrained to the cell content box, which enables wrapping.
        for(let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
            for(let colIndex = 0; colIndex < colCount; colIndex++) {
                const cellContent = this.rows[rowIndex]?.[colIndex] ?? ""
                const cellX = xPositions[colIndex]
                const cellY = yPositions[rowIndex]
                const cellWidth = resolvedColumnWidths[colIndex]
                const cellHeight = resolvedRowHeights[rowIndex]

                // Apply padding so text doesn't touch grid lines.
                const textWidth = Math.max(1, cellWidth - (this.cellPadding * 2))
                const textHeight = Math.max(1, cellHeight - (this.cellPadding * 2))

                const textPos = this.rotatePoint(
                    { x: cellX + this.cellPadding, y: cellY + this.cellPadding },
                    totalWidth, totalHeight
                )
                const text = new Text(cellContent, textPos.x, textPos.y, this.formatted)
                text.setFont(this.font)
                text.setRotation(this.rotation)
                // Multi-line text behavior matches the existing Text field:
                // - wraps when width is exceeded
                // - clips once the height constraint is reached
                // setMultiLine dimensions are unchanged for all rotations: Text interprets
                // them along its own char/line axes, which already account for rotation.
                text.setMultiLine(textWidth, textHeight)
                fields.push(text)
            }
        }

        // Vertical grid lines (including left and right borders).
        for(let colIndex = 0; colIndex <= colCount; colIndex++) {
            const isLast = colIndex === colCount
            const sx = isLast ? this.x + totalWidth : xPositions[colIndex]
            // The bar for the visual right boundary would extend beyond the table's right edge
            // by lineThickness. Shift it inward so the bar's far edge stays within bounds.
            // Which original line maps to the visual right boundary depends on rotation:
            //   0°/90°: the last column (isLast)  →  shift left
            //   180°/270°: the first column (colIndex=0)  →  shift right
            let sxBar = sx
            if (isLast && (this.rotation === 0 || this.rotation === 90)) sxBar -= this.lineThickness
            else if (!isLast && colIndex === 0 && (this.rotation === 180 || this.rotation === 270)) sxBar += this.lineThickness
            fields.push(new Line(
                this.rotatePoint({x: sxBar, y: this.y}, totalWidth, totalHeight),
                this.rotatePoint({x: sxBar, y: this.y + totalHeight}, totalWidth, totalHeight),
                this.lineThickness
            ))
        }

        // Horizontal grid lines (including top and bottom borders).
        for(let rowIndex = 0; rowIndex <= rowCount; rowIndex++) {
            const isLastRow = rowIndex === rowCount
            const sy = isLastRow ? this.y + totalHeight : yPositions[rowIndex]
            // Same boundary fix for horizontal lines:
            //   0°/270°: last row (isLastRow)  →  shift up
            //   90°/180°: first row (rowIndex=0)  →  shift down
            let syBar = sy
            if (isLastRow && (this.rotation === 0 || this.rotation === 270)) syBar -= this.lineThickness
            else if (!isLastRow && rowIndex === 0 && (this.rotation === 90 || this.rotation === 180)) syBar += this.lineThickness
            fields.push(new Line(
                this.rotatePoint({x: this.x, y: syBar}, totalWidth, totalHeight),
                this.rotatePoint({x: this.x + totalWidth, y: syBar}, totalWidth, totalHeight),
                this.lineThickness
            ))
        }

        // Finally, generate and group all underlying commands.
        const commandList = await Promise.all(fields.map(field => field.commandForLanguage(language, config)))
        return generator.commandGroup(commandList)
    }

    private rotatePoint(p: Point, totalWidth: number, totalHeight: number): Point {
        switch(this.rotation) {
            case 90:
                return { x: this.x + totalHeight - (p.y - this.y), y: this.y + (p.x - this.x) }
            case 180:
                return { x: this.x + totalWidth - (p.x - this.x), y: this.y + totalHeight - (p.y - this.y) }
            case 270:
                return { x: this.x + (p.y - this.y), y: this.y + totalWidth - (p.x - this.x) }
            default:
                return p
        }
    }

    private accumulatePositions(start: number, sizes: number[]): number[] {
        // Converts a list of track sizes (widths/heights) into absolute positions.
        // Returned array contains the starting coordinate for each track.
        const positions: number[] = []
        let current = start
        for(const s of sizes) {
            positions.push(current)
            current += s
        }
        return positions
    }

    private resolveTrackSizes(params: {
        trackCount: number,
        explicitSizes?: SizeSpec[],
        total?: number,
        measure: (trackIndex: number) => number
    }): number[] {
        if(params.trackCount == 0) return []
        
        // Resolves row/column sizes.
        // - If an explicit size is provided, it is used.
        // - If overall total is provided, any unspecified tracks share remaining space equally.
        // - Otherwise, unspecified tracks are measured from content.
        const sizes: SizeSpec[] = new Array(params.trackCount).fill(undefined)

        if(params.explicitSizes) {
            for(let i = 0; i < Math.min(params.trackCount, params.explicitSizes.length); i++) {
                sizes[i] = params.explicitSizes[i]
            }
        }

        if(params.total != undefined) {
            // Fixed + flexible: distribute remaining space among tracks with undefined size.
            const fixedTotal = sizes.reduce((sum: number, s) => sum + (s ?? 0), 0)
            const flexibleCount = sizes.filter(s => s == undefined).length

            const remaining = Math.max(0, params.total - fixedTotal)
            const flexSize = flexibleCount == 0 ? 0 : remaining / flexibleCount

            return sizes.map((s, i) => Math.max(1, s ?? flexSize ?? params.measure(i)))
        }

        return sizes.map((s, i) => Math.max(1, s ?? params.measure(i)))
    }

    private measureAutoColumnWidth(columnIndex: number, colCount: number, config?: PrintConfig): number {
        // Content-based width measurement for an auto-sized column.
        // This is a heuristic: it uses single-line text width + padding.
        const contentWidths: number[] = []

        for(const row of this.rows) {
            const content = row?.[columnIndex] ?? ""
            const plain = this.toPlainText(content)
            const w = this.textWidth(plain, config)
            contentWidths.push(w)
        }

        const maxContentWidth = contentWidths.length == 0 ? 0 : Math.max(...contentWidths)

        const minWidth = this.font.size
        const measured = Math.max(minWidth, maxContentWidth) + (this.cellPadding * 2)

        if(colCount == 0) return measured
        return measured
    }

    private measureAutoRowHeight(rowIndex: number, columnWidths: number[], config?: PrintConfig): number {
        // Content-based height measurement for an auto-sized row.
        // We estimate how many wrapped lines are needed for each cell, then take the max.
        const row = this.rows[rowIndex] ?? []
        const contentHeights: number[] = []

        for(let colIndex = 0; colIndex < columnWidths.length; colIndex++) {
            const content = row[colIndex] ?? ""
            const plain = this.toPlainText(content)
            const availableWidth = Math.max(1, columnWidths[colIndex] - (this.cellPadding * 2))
            const lineCount = this.estimateLineCount(plain, availableWidth, config)
            const lineHeight = this.font.size + 1
            contentHeights.push(lineCount * lineHeight)
        }

        const maxContentHeight = contentHeights.length == 0 ? this.font.size : Math.max(...contentHeights)
        return maxContentHeight + (this.cellPadding * 2)
    }

    private estimateLineCount(content: string, width: number, config?: PrintConfig): number {
        // Estimates wrapped line count using word-wrapping.
        // This doesn't try to exactly match printer rendering; it exists to auto-size rows.
        const normalized = content.replace("\n", " ")

        if(normalized.trim() == "") return 1

        const words: string[] = []
        let buffer = ""

        for(let i = 0; i < normalized.length; i++) {
            const ch = normalized.charAt(i)
            if(isWhitespace(ch)) {
                if(buffer != "") {
                    words.push(buffer)
                    buffer = ""
                }
                continue
            }
            buffer += ch
        }

        if(buffer != "") words.push(buffer)

        let lines = 1
        let currentLine = ""

        for(const word of words) {
            const candidate = currentLine == "" ? word : `${currentLine} ${word}`

            if(this.textWidth(candidate, config) <= width) {
                currentLine = candidate
            } else {
                if(currentLine == "") {
                    const charsPerLine = Math.max(1, Math.floor(width / Math.max(1, this.font.size)))
                    const neededLines = Math.ceil(word.length / charsPerLine)
                    lines += neededLines - 1
                    currentLine = word.substring((neededLines - 1) * charsPerLine)
                } else {
                    lines += 1
                    currentLine = word
                }
            }
        }

        return Math.max(1, lines)
    }

    private textWidth(text: string, config?: PrintConfig): number {
        // Measures text width in dots.
        // If a font is registered and PrintConfig is provided, use accurate font metrics.
        // Otherwise fall back to a simple monospace approximation.
        if(this.font.name == "default" || !config) {
            return text.length * this.font.size
        }
        return config.textWidth(text, this.font)
    }

    textContent(): string {
        return this.rows.flat().map(c => this.toPlainText(c)).join("")
    }

    private toPlainText(content: string): string {
        // Measurement helpers should ignore formatting.
        // This strips basic HTML tags used by the Text field's formatting support.
        return content.replace(/<[^>]*>/g, "")
    }
}
