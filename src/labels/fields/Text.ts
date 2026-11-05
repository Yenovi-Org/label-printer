import { Command, Point, PrinterLanguage } from "@/commands"
import { PrintConfig } from "../Printable"
import { dotToPoint } from "@/helpers/UnitUtils"
import CommandGenerator from "@/commands/CommandGenerator"
import { isWhitespace, isBreakAfterChar } from "@/helpers/StringUtils"
import { NodeType, parse, HTMLElement, Node } from "node-html-parser"
import { FontOption } from "../types"
import RotatableLabelField from "./superClasses/RotatableLabelField"
import { PositionedField } from "./superClasses/interfaces"

export type TextFieldType = "singleline"|"multiline"
type Context = {
    language: PrinterLanguage,
    generator: CommandGenerator<any>,
    config?: PrintConfig
}

type TextDecoration = "underline"|"strike"

const BOLD_WEIGTH = 700
const BOLD_TAG = "b"
const ITALIC_TAG = "i"
const UNDERLINE_TAG = "u"
const STRIKE_TAG = ["s", "del", "strike"]
const PARAGRAPH_TAG = "p"
const BREAK_TAG = "br"

// TODO: The implementation of rotation can be simplified by integrating the RotatableContainer component
/**
 * Presents a piece of text on the label
 */
export default class Text extends RotatableLabelField implements PositionedField {
    private static MIN_WORD_BREAK_CHARS = 2

    private readonly content: string
    /**
     * X coordinate in dots
     */
    private x: number
    /**
     * Y coordinate in dots
     */
    private y: number
    /**
     * If true, basic html elements will be interpreted, otherwise the raw string is printed out
     */
    private readonly formatted: boolean
    private font: FontOption = {name: "default", size: 10}
    private type: TextFieldType = "singleline"
    private context: Context|undefined = undefined
    private readonly lineSpacing = 1

    /**
     * Width of the text. 
     * If set, the text will be clipped to this size
     * If the type is set to multiline, this is where the text is split to a newline
     */
    private width: number|undefined
    /**
     * Height of the text box, if empty and the type is multiline, the box can grow infinitely
     */
    private height: number|undefined

    constructor(content: string, x: number, y: number, formatted: boolean = true) {
        super()
        this.content = content.replace("\n", "").replace("\"", "\\\"") // Newline can break text generation
        this.x = x
        this.y = y
        this.formatted = formatted
    }

    setPosition(position: Point): void {
        this.x = position.x
        this.y = position.y
    }

    getPosition(): Point {
        return { x: this.x, y: this.y }
    }

    /**
     * Sets the field to single line
     * @param width Max width of the text. Leave it undefined to allow the field to grow 
     */
    setSingleLine(width?: number) {
        this.type = "singleline"
        this.width = width
        this.height = undefined
    }

    /**
     * Sets the field to multi line
     * @param width Max width of text before it gets wrapped to a new line
     * @param height Max height of the text box, leave undefined to allow the text box to grow infinitly
     */
    setMultiLine(width: number, height?: number) {
        this.type = "multiline"
        this.width = width
        this.height = height
    }

    /**
     * Set a font to use as a base. If no formatting is set on the text with a html tag, this will be used
     * Note: The font name either has to be a built in font on your printer or a font
     * that is registered on the label using 'registerFont'.
     */
    setFont(font: FontOption) {
        this.font = font
    }

    textContent(): string {
        return this.content.replace(/<[^>]*>/g, "")
    }

    /**
     * Generate the commands. Main entry point
     * @param language 
     * @param config 
     * @returns 
     */
    async commandForLanguage(language: PrinterLanguage, config?: PrintConfig): Promise<Command> {
        this.context = {
            config,
            language,
            generator: this.commandGeneratorFor(language)
        }

        let command: Command
        if(this.formatted) {
            command = this.generateFormattedText()
        } else {
            command = this.generatePlainText()
        }
        this.context = undefined
  
        return command
    }

    /**
     * Generate commands for formatted text
     * @returns 
     */
    private generateFormattedText(): Command {
        if(!this.context) throw "context-not-set"
        
        const rootNode = parse(this.content)
        const { command } = this.generateFormattedRecursive(this.x, this.y, rootNode, this.normalizedFont(this.font), [])
        return command
    }

    /**
     * Generate commands for plain text
     * @returns 
     */
    private generatePlainText(): Command {
        const { command } = this.generatePlainTextCore(this.content, this.x, this.y, this.normalizedFont(this.font))
        return command
    }

    // --- Rotation-aware position helpers ---

    /** Advance cursor by `amount` along the character direction */
    private advanceChar(x: number, y: number, amount: number): {x: number, y: number} {
        switch (this.rotation) {
            case 0:   return {x: x + amount, y}
            case 90:  return {x, y: y + amount}   // 90° CW: chars go downward
            case 180: return {x: x - amount, y}
            case 270: return {x, y: y - amount}   // 270° CW: chars go upward
        }
    }

    /** Advance to the next line (reset char axis, advance in line direction) */
    private advanceLine(x: number, y: number, lineHeight: number): {x: number, y: number} {
        switch (this.rotation) {
            case 0:   return {x: this.x, y: y + lineHeight}
            case 90:  return {x: x - lineHeight, y: this.y}  // 90° CW: lines stack leftward (-x)
            case 180: return {x: this.x, y: y - lineHeight}
            case 270: return {x: x + lineHeight, y: this.y}  // 270° CW: lines stack rightward (+x)
        }
    }

    /** How far into the current line the cursor is (for width constraint calc) */
    private charOffset(x: number, y: number): number {
        switch (this.rotation) {
            case 0:   return x - this.x
            case 90:  return y - this.y   // 90° CW: char axis is +y
            case 180: return this.x - x
            case 270: return this.y - y   // 270° CW: char axis is -y
        }
    }

    /** How many lines deep we are (for height constraint calc) */
    private lineOffset(x: number, y: number): number {
        switch (this.rotation) {
            case 0:   return y - this.y
            case 90:  return this.x - x  // 90° CW: line axis is -x
            case 180: return this.y - y
            case 270: return x - this.x  // 270° CW: line axis is +x
        }
    }

    /** Whether the cursor is at the start of its line (char axis at origin) */
    private atLineStart(x: number, y: number): boolean {
        switch (this.rotation) {
            case 0:
            case 180: return x === this.x
            case 90:
            case 270: return y === this.y
        }
    }

    // --- Text helpers ---

    /**
     * Check if a node ends in a brake tag or empty 
     * @param node 
     * @returns 
     */
    private endsWithBreak(node: Node): boolean {
        if(node.nodeType == NodeType.TEXT_NODE) {
            return node.innerText.trim() == ""
        }

        const elementNode = node as HTMLElement
        if(elementNode.rawTagName == BREAK_TAG) return true

        const children = elementNode.childNodes
        for(let i = children.length - 1; i >= 0; i--) {
            const child = children[i]
            if(child.nodeType == NodeType.TEXT_NODE) {
                if(child.innerText.trim() == "") continue
                return false
            }

            if(this.endsWithBreak(child)) return true
            return false
        }

        return false
    }

    // --- Command generation ---

    /**
     * Iterats the nodes in a html text and generates text commands for it
     */
    private generateFormattedRecursive(initialX: number, initialY: number, rootNode: Node, font: FontOption, features: TextDecoration[]): {x: number, y: number, command: Command} {
        if(rootNode.nodeType == NodeType.TEXT_NODE) {
            const result = this.generatePlainTextCore(rootNode.innerText, initialX, initialY, font, features)
            return result
        } else {
            const elementNode = rootNode as HTMLElement
            const tag = elementNode.rawTagName

            if(tag == BREAK_TAG) {
                const linePos = this.advanceLine(initialX, initialY, font.size + this.lineSpacing)
                return {
                    x: linePos.x,
                    y: linePos.y,
                    command: this.context!.generator.commandGroup([])
                }
            }

            let commands: Command[] = []
            let currentX = initialX
            let currentY = initialY

            let baseFont = {...font}
            let baseFeatures = [...features]
            
            if(tag == UNDERLINE_TAG) {
                baseFeatures.push("underline")
            } else if(STRIKE_TAG.includes(tag)) {
                baseFeatures.push("strike")
            } else if(tag == BOLD_TAG) {
                baseFont.weight = BOLD_WEIGTH
            } else if(tag == ITALIC_TAG) {
                baseFont.style = "italic"
            }

            // Treat paragraphs as block-level elements: start and end on a new line.
            // Avoid adding an extra leading newline if the paragraph starts at the field origin.
            if(tag == PARAGRAPH_TAG) {
                if(!this.atLineStart(initialX, initialY)) {
                    const linePos = this.advanceLine(initialX, initialY, baseFont.size + this.lineSpacing)
                    currentX = linePos.x
                    currentY = linePos.y
                }
            }

            elementNode.childNodes.forEach(node => {
                const {x,y,command} = this.generateFormattedRecursive(currentX, currentY, node, baseFont, baseFeatures)
                currentX = x
                currentY = y
                commands.push(command)
            })

            if(tag == PARAGRAPH_TAG) {
                if(!this.endsWithBreak(elementNode)) {
                    const linePos = this.advanceLine(currentX, currentY, baseFont.size + this.lineSpacing)
                    currentX = linePos.x
                    currentY = linePos.y
                }
            }

            return {
                x: currentX,
                y: currentY,
                command: this.context!.generator.commandGroup(commands)
            }
        }
    }

    /**
     * Generate commands for plain text
     * @param config 
     * @returns 
     */
    private generatePlainTextCore(content: string, initialX: number, initialY: number, font: FontOption, features: TextDecoration[] = []): {x: number, y: number, command: Command} {
        if(!this.context) throw "context-not-set"

        let currentTextFullWidth = this.textWidthFunction(content, font)


        // If there is no width constraint, just print the text and return the end position
        if(!this.width) {
            const end = this.advanceChar(initialX, initialY, currentTextFullWidth)
            return {
                x: end.x,
                y: end.y,
                command: this.textCommand(content, initialX, initialY, font, features)
            }
        }

        const initialPadding = this.charOffset(initialX, initialY)
        // Because we may start from further in the row, the first rows width may be smaller
        let availableWidth = this.width - initialPadding
        // In theory rowWidth should not be negative, but for some reason it happens.. as a quick work around we make sure it is not negative
        if(availableWidth <= 0) {
            availableWidth = this.width
            const linePos = this.advanceLine(initialX, initialY, font.size + this.lineSpacing)
            initialX = linePos.x
            initialY = linePos.y
        }

        // Make sure we don't print spaces at the beginning of a row
        if(this.atLineStart(initialX, initialY)) {
            content = content.trimStart()
            currentTextFullWidth = this.textWidthFunction(content, font)
        }

        // We may not start from the beginning of the textbox so we have to offset
        // by our current position
        if(currentTextFullWidth <= availableWidth) {
            if (this.height !== undefined) {
                const lineTop = this.lineOffset(initialX, initialY)
                if ((lineTop + font.size) > this.height) {
                    return { x: initialX, y: initialY, command: this.context!.generator.commandGroup([]) }
                }
            }
            const end = this.advanceChar(initialX, initialY, currentTextFullWidth)
            return {
                x: end.x,
                y: end.y,
                command: this.textCommand(content, initialX, initialY, font, features)
            }
        }

        // Edge cases handled, ready to generate multi-line output if needed

        const commands: Command[] = []
        
        let x = initialX
        let y = initialY
        let remainingContent = content
        let remainingContentWidth = currentTextFullWidth
        let currentHeight = 0

        let finalX = x
        let finalY = y

        do {
            // Skip this line if it would overflow the height constraint
            if (this.height !== undefined) {
                const lineTop = this.lineOffset(x, y)
                if ((lineTop + font.size) > this.height) break
            }

            // This will be the last row of the text.
            if(remainingContentWidth < availableWidth) {
                const end = this.advanceChar(x, y, remainingContentWidth)
                finalX = end.x
                finalY = end.y

                commands.push(this.textCommand(remainingContent,  x, y, font, features))
                remainingContent = ""
            } else {
                let rowEndIndex = this.searchForFittingText(remainingContent, font, availableWidth)
                let originalRowEndIndex = rowEndIndex

                // Even the first character doesn't fit — advance to the next line
                if (rowEndIndex < 0) {
                    const linePos = this.advanceLine(x, y, font.size + this.lineSpacing)
                    availableWidth = this.width
                    x = linePos.x
                    y = linePos.y
                    continue
                }

                // Walk backward from rowEndIndex to find the end of the last complete word
                while(rowEndIndex > 0 && !this.isAtWordBoundary(rowEndIndex, remainingContent))
                { rowEndIndex -- }

                let nextRowStartIndex = rowEndIndex + 1
                const foundWordBoundary = this.isAtWordBoundary(rowEndIndex, remainingContent)

                if (!foundWordBoundary) {
                    // No word boundary at all — mid-word break at binary-search result
                    rowEndIndex = originalRowEndIndex
                    nextRowStartIndex = originalRowEndIndex + 1

                    // Ensure at least MIN_WORD_BREAK_CHARS go to next line
                    let wordEnd = originalRowEndIndex + 1
                    while (wordEnd < remainingContent.length && !isWhitespace(remainingContent.charAt(wordEnd))) {
                        wordEnd++
                    }
                    const charsOnNext = wordEnd - originalRowEndIndex - 1
                    if (charsOnNext > 0 && charsOnNext < Text.MIN_WORD_BREAK_CHARS) {
                        const adjusted = originalRowEndIndex - (Text.MIN_WORD_BREAK_CHARS - charsOnNext)
                        if (adjusted >= 0) {
                            rowEndIndex = adjusted
                            nextRowStartIndex = adjusted + 1
                        }
                    }
                } else if (originalRowEndIndex > rowEndIndex) {
                    // Word boundary found but binary search could fit more characters.
                    // First, check if the FULL next word fits within a relaxed limit
                    // based on the correction factor (compensates for fontkit overestimation).
                    let wordStart = rowEndIndex + 1
                    while (wordStart <= originalRowEndIndex && isWhitespace(remainingContent.charAt(wordStart))) {
                        wordStart++
                    }

                    // Find the end of the full word
                    let fullWordEnd = wordStart
                    while (fullWordEnd < remainingContent.length && !isWhitespace(remainingContent.charAt(fullWordEnd))) {
                        fullWordEnd++
                    }

                    const nextWord = remainingContent.substring(wordStart, fullWordEnd)

                    // Check if the line including the full word fits within rowWidth.
                    // The global correction factor (applied in textWidth) already reduces
                    // measurements, so we just check against the actual line width here.
                    const lineWithFullWord = this.textWidthFunction(remainingContent.substring(0, fullWordEnd), font)
                    if (lineWithFullWord <= availableWidth) {
                        // Full word fits within tolerance — include it
                        rowEndIndex = fullWordEnd - 1
                        nextRowStartIndex = fullWordEnd
                        // Skip leading whitespace on the next row (mirrors the else branch below)
                        while (
                            isWhitespace(remainingContent.charAt(nextRowStartIndex)) &&
                            nextRowStartIndex < remainingContent.length
                        ) { nextRowStartIndex++ }
                    } else {
                        // Full word doesn't fit even with tolerance — try mid-word break.
                        // Use a fresh binary search within the word to find the optimal
                        // break point (avoids issues when originalRowEndIndex lands on whitespace).
                        let lo2 = wordStart, hi2 = fullWordEnd - 1
                        let midBreak = -1
                        while (lo2 <= hi2) {
                            const mid2 = Math.floor((lo2 + hi2) / 2)
                            if (this.textWidthFunction(remainingContent.substring(0, mid2 + 1), font) <= availableWidth) {
                                midBreak = mid2
                                lo2 = mid2 + 1
                            } else {
                                hi2 = mid2 - 1
                            }
                        }

                        let usedMidWordBreak = false
                        if (midBreak >= wordStart) {
                            let charsOnLine = midBreak - wordStart + 1
                            let charsOnNext = fullWordEnd - midBreak - 1

                            // Ensure at least MIN_WORD_BREAK_CHARS on next line
                            if (charsOnNext > 0 && charsOnNext < Text.MIN_WORD_BREAK_CHARS) {
                                midBreak -= (Text.MIN_WORD_BREAK_CHARS - charsOnNext)
                                charsOnLine = midBreak - wordStart + 1
                            }

                            if (charsOnLine >= Text.MIN_WORD_BREAK_CHARS) {
                                rowEndIndex = midBreak
                                nextRowStartIndex = midBreak + 1
                                usedMidWordBreak = true
                            }
                        }

                        if (!usedMidWordBreak) {
                            // Can't mid-word break — fall back to word boundary
                            nextRowStartIndex = rowEndIndex + 1
                            while(
                                isWhitespace(remainingContent.charAt(nextRowStartIndex)) &&
                                nextRowStartIndex < remainingContent.length
                            ) { nextRowStartIndex ++ }
                        }
                    }
                } else {
                    // Skip leading whitespace on the next row
                    while(
                        isWhitespace(remainingContent.charAt(nextRowStartIndex)) &&
                        nextRowStartIndex < remainingContent.length
                    ) { nextRowStartIndex ++ }
                }

                const thisRow = remainingContent.substring(0, rowEndIndex + 1)
                commands.push(this.textCommand(thisRow, x, y, font, features))

                {
                    const end = this.advanceChar(x, y, this.textWidthFunction(thisRow, font))
                    finalX = end.x
                    finalY = end.y
                }

                // Move cursor to the start of the next line
                const linePos = this.advanceLine(x, y, font.size + this.lineSpacing)
                x = linePos.x
                y = linePos.y
                availableWidth = this.width
                currentHeight = this.lineOffset(x, y)

                remainingContent = remainingContent.substring(nextRowStartIndex)
                remainingContentWidth = this.textWidthFunction(remainingContent, font)
            }
        } while(
            // We don't have a height constraint or we are still within bounds 
            // and there is still content 
            // and we are supporting multiline
            (this.height == undefined || (currentHeight + font.size) <= this.height) &&
            (remainingContent != "") &&
            this.type == "multiline"
        )

        return {
            x: finalX,
            y: finalY,
            command: this.context!.generator.commandGroup(commands)
        }
    }

    private textCommand(text: string, x: number, y: number, font: FontOption, features: TextDecoration[]) {
        if(!this.context) throw "no-context"
        const finalFontSize = dotToPoint(font.size, this.context!.config?.dpi ?? 203)
        const finalFont = this.getFontName(font)
        const finalX = Math.round(x)
        const finalY = Math.round(y)

        let commands: Command[] = []
        const textCommand = this.context!.generator.text(text, finalX, finalY, finalFont, finalFontSize, this.rotation, this.textWidthFunction(text, font))

        if(features.length == 0) {
            return textCommand
        } else {
            let lineHeight = font.size * 0.1
            let textWidth = this.textWidthFunction(text, font)

            if(features.includes("strike")) {
                commands.push(this.textLineCommand(textWidth, x, y, lineHeight, 0.5, font.size))
            }

            if(features.includes("underline")) {
                commands.push(this.textLineCommand(textWidth, x, y, lineHeight, 0.9, font.size))
            }

            commands.push(textCommand)
        }

        return this.context.generator.commandGroup(commands)
    }

    private textLineCommand(width: number, x: number, y: number, lineHeight: number, linePercentage: number, fontSize: number): Command {
        const offset = Math.round(fontSize * linePercentage - lineHeight / 2)
        let start: {x: number, y: number}
        let end: {x: number, y: number}
        switch (this.rotation) {
            case 0:
                start = {x: Math.round(x), y: Math.round(y) + offset}
                end   = {x: Math.round(x) + Math.round(width), y: start.y}
                break
            case 90:
                // 90° CW: chars go downward (+y), lines stack leftward (-x); underline offset in -x
                start = {x: Math.round(x) - offset, y: Math.round(y)}
                end   = {x: start.x, y: Math.round(y) + Math.round(width)}
                break
            case 180:
                start = {x: Math.round(x), y: Math.round(y) - offset}
                end   = {x: Math.round(x) - Math.round(width), y: start.y}
                break
            case 270:
                // 270° CW: chars go upward (-y), lines stack rightward (+x); underline offset in +x
                start = {x: Math.round(x) + offset, y: Math.round(y)}
                end   = {x: start.x, y: Math.round(y) - Math.round(width)}
                break
        }
        return this.context!.generator.line(start!, end!, lineHeight)
    }

    private getFontName(font: FontOption) {
        if(!this.context) throw "no-context"
        if(font.name == "default") {
            return "default"
        } else {
            return this.context!.config?.getFontName(font)!
        }
    }

    private normalizedFont(font: FontOption): FontOption {
        const normalizer = this.context?.generator?.normalizeFontSizeInDots
        if (!normalizer) return font
        const dpi = this.context?.config?.dpi ?? 203
        const effectiveSize = normalizer(font.size, font.name, dpi)
        if (effectiveSize === font.size) return font
        return { ...font, size: effectiveSize }
    }

    private textWidthFunction(text: string, font: FontOption) {
        const widthFunction = this._textWidthFunction
        const rawWidth = widthFunction(text, font)

        const correctionFactor = this.context?.generator.textWidthCorrectionFactor ?? 1
        if(this.font.name == "default") {
            return rawWidth
        } else {
            const correctedWidth = rawWidth * correctionFactor
            return correctedWidth
        }
    }

    private get _textWidthFunction() {
        if(this.font.name == "default") {
            return (text: string, font: FontOption) => this.defaultTextWidth(text, font)
        } else {
            return this.context?.config?.textWidth ?? ((text: string, font: FontOption) => this.defaultTextWidth(text, font))
        }
    }

    /**
     * Fallback width estimate when no font metrics are available.
     * Uses the TSPL x-multiplication value (dotToPoint of the dot size) as
     * the per-character width, which matches the rendered width of font "0".
     */
    private defaultTextWidth(text: string, font: FontOption): number {
        const dpi = this.context?.config?.dpi ?? 203
        return text.length * dotToPoint(font.size, dpi)
    }

    // ---- Text algorithm helper functions ----

    /**
     * Binary search for the last character index that fits within the current
     * row width. This correctly handles proportional fonts where characters
     * have different widths, unlike a simple character-count estimate.
     * @returns 
     */
    private searchForFittingText(remainingContent: string, font: FontOption, rowWidth: number): number {
        let lo = 0, hi = remainingContent.length - 1
        let rowEndIndex = -1
        while (lo <= hi) {
            const mid = Math.floor((lo + hi) / 2)
            const w = this.textWidthFunction(remainingContent.substring(0, mid + 1), font)
            const fits = w <= rowWidth
            if (fits) {
                rowEndIndex = mid
                lo = mid + 1
            } else {
                hi = mid - 1
            }
        }
        return rowEndIndex
    }

    /**
     * Check if the current point is a correct braking point, meaning it is either at the end of a word or at a break character.
     * @param index 
     * @returns 
     */
    private isAtWordBoundary(index: number, content: string): boolean {
        const char = content.charAt(index);
        const nextChar = content.charAt(index + 1);
        const isLastChar = index === content.length - 1;

        const isEndOfWord = !isWhitespace(char) && (isLastChar || isWhitespace(nextChar));
        const isBreakPoint = isBreakAfterChar(char);

        const result = isEndOfWord || isBreakPoint;
        return result;
    }
}