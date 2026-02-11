import { Command, PrinterLanguage } from "@/commands"
import LabelField from "./LabelField"
import { PrintConfig } from "../Printable"
import { dotToPoint } from "@/helpers/UnitUtils"
import CommandGenerator from "@/commands/CommandGenerator"
import { isWhitespace } from "@/helpers/StringUtils"
import { NodeType, parse, HTMLElement, Node } from "node-html-parser"
import { FontOption } from "../types"

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

/**
 * Presents a piece of text on the label
 */
export default class Text extends LabelField {
    private readonly content: string
    /**
     * X coordinate in dots
     */
    private readonly x: number
    /**
     * Y coordinate in dots
     */
    private readonly y: number
    /**
     * If true, basic html elements will be interpretted, otherwise the raw string is printed out
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
        const { command } = this.generateFormattedRecursive(this.x, this.y, rootNode, this.font, [])
        return command
    }

    /**
     * Generate commands for plain text
     * @returns 
     */
    private generatePlainText(): Command {
        const { command } = this.generatePlainTextCore(this.content, this.x, this.y, this.font)
        return command
    }

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
                return {
                    x: this.x,
                    y: initialY + font.size + this.lineSpacing,
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
                const isAtFieldOrigin = initialX == this.x && initialY == this.y
                if(!isAtFieldOrigin) {
                    currentX = this.x
                    currentY = initialY + baseFont.size + this.lineSpacing
                }
            }

            elementNode.childNodes.forEach(node => {
                const {x,y,command} = this.generateFormattedRecursive(currentX, currentY, node, baseFont, baseFeatures)
                currentX = x
                currentY = y
                commands.push(command)
            })

            if(tag == PARAGRAPH_TAG) {
                let paragraphEndsWithBreak = false
                for(let i = elementNode.childNodes.length - 1; i >= 0; i--) {
                    const node = elementNode.childNodes[i]
                    if(node.nodeType == NodeType.TEXT_NODE) {
                        if(node.innerText.trim() == "") continue
                        break
                    }

                    const childElement = node as HTMLElement
                    if(childElement.rawTagName == BREAK_TAG) {
                        paragraphEndsWithBreak = true
                    }
                    break
                }

                if(!paragraphEndsWithBreak) {
                    currentX = this.x
                    currentY += baseFont.size + this.lineSpacing
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

        const textWidhtFunction = this.textWidthFunction
        let fullWidth = textWidhtFunction(content, font)

        if(this.width) {
            const initialPadding = initialX - this.x
            // Because we may start from further in the row, the first rows width may be smaller
            let rowWidth = this.width - initialPadding
            // In theory rowWidth should not be negative, but for some reson it happens.. as a quick work around we make sure it is not negative
            if(rowWidth <= 0) {
                rowWidth = this.width
                initialX = this.x
                initialY += font.size + this.lineSpacing
            }

            // Make sure we don't print spaces at the beginig of a row
            if(initialX == this.x) {
                content = content.trimStart()
                fullWidth = textWidhtFunction(content, font)
            }

            // We may not start from the begining of the textbox so we have to offset
            // by our current position
            if(fullWidth <= rowWidth) {
                return {
                    x: initialX + fullWidth,
                    y: initialY,
                    command: this.textCommand(content, initialX, initialY, font, features)
                }
            } else {
                const commands: Command[] = []
                
                let x = initialX
                let y = initialY
                let remainingContent = content
                let remainingWidth = fullWidth
                let currentHeight = 0

                let finalX = x
                let finalY = y

                do {
                    // This will be the last row of the text. 
                    if(remainingWidth < rowWidth) {
                        finalX = x + remainingWidth
                        finalY = y

                        commands.push(this.textCommand(remainingContent,  x, y, font, features))
                        remainingContent = ""
                    } else {
                        // On how many rows this text would fit
                        let rows = remainingWidth / rowWidth

                        // From the second row, all rows are full width
                        rowWidth = this.width
                        // Which caracter is the last if dividing into the right number of rows
                        let rowEndIndex = Math.floor(remainingContent.length / rows)
                        let originalRowEndIndex = rowEndIndex

                        // This means we have to fit a relatively short text into
                        // a lot of rows which can only happen if the row width is very small
                        // in this case, we have to go to a new line
                        // This is used to avoid having to calculate the width of the first character of the current text, to compare with the remainig length
                        if(rowEndIndex == 0) {
                            x = this.x
                            y += font.size + this.lineSpacing
                            continue
                        }

                        // Scenario 1: Current index is in a middle of row
                        // I am iron m@n
                        // End this row with the last words last character

                        // Scneraio 2: Current index is space:
                        // I am iron@man
                        // No action, but to simplify code, we threat as scenario 1

                        // Scenario 3: Current index is right before a sapce
                        // I am iro@ man
                        // Start next row from the first latter

                        // Find the end of the last word
                        while(
                            ! (
                                !isWhitespace(remainingContent.charAt(rowEndIndex)) &&
                                (
                                    rowEndIndex == remainingContent.length - 1 ||
                                    isWhitespace(remainingContent.charAt(rowEndIndex + 1))
                                )
                            ) && rowEndIndex > 0
                        ) { rowEndIndex -- }

                        let nextRowStartIndex = rowEndIndex + 1
                        // We didn't find a space, we split the text wherever we land
                        if(rowEndIndex == 0) {
                            rowEndIndex = originalRowEndIndex
                            nextRowStartIndex = originalRowEndIndex + 1
                        } else {
                            while(
                                isWhitespace(remainingContent.charAt(nextRowStartIndex)) && 
                                nextRowStartIndex < remainingContent.length
                            ) { nextRowStartIndex ++ }
                        }

                        const thisRow = remainingContent.substring(0, rowEndIndex + 1)
                        commands.push(this.textCommand(thisRow, x, y, font, features))

                        if(nextRowStartIndex == remainingContent.length) {
                            finalX = x + remainingWidth
                            finalY = y
                        }

                        // Make sure to move the cursor back to the left side of the text box
                        // as we may have started further into the row
                        x = this.x
                        y += font.size + this.lineSpacing
                        currentHeight = y - this.y

                        remainingContent = remainingContent.substring(nextRowStartIndex)
                        remainingWidth = textWidhtFunction(remainingContent, font)
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
        } else {
            return {
                x: initialX + fullWidth,
                y: initialY,
                command: this.textCommand(content, initialX, initialY, font, features)
            }
        }
    }

    private textCommand(text: string, x: number, y: number, font: FontOption, features: TextDecoration[]) {
        if(!this.context) throw "no-context"
        const finalFontSize = dotToPoint(font.size, this.context!.config?.dpi ?? 203)
        const finalFont = this.getFontName(font)
        const finalX = Math.round(x)
        const finalY = Math.round(y)

        let commands: Command[] = []
        const textCommand = this.context!.generator.text(text, finalX, finalY, finalFont, finalFontSize)

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
        const sy = Math.round(y + (fontSize * linePercentage) - (lineHeight / 2))

        const sx = Math.round(x)
        return this.context!.generator.line(
            {x: sx, y: sy}, 
            {x: sx + width, y: sy}, 
            lineHeight)
    }

    private getFontName(font: FontOption) {
        if(!this.context) throw "no-context"
        if(font.name == "default") {
            return "default"
        } else {
            return this.context!.config?.getFontName(font)!
        }
    }

    private get textWidthFunction() {
        if(this.font.name == "default") {
            return this.defaultTextWidth
        } else {
            return this.context?.config?.textWidth ?? this.defaultTextWidth
        }
    }

    /**
     * This function is used to calculate the font size if no
     * print config is provided. This will asume that the font has square characters
     */
    private defaultTextWidth(text: string, font: FontOption) {
        return text.length * font.size
    }
}