import { Command, Dimension, PrinterLanguage, zpl } from "@/commands";
import Printable, { PrintConfig } from "./Printable";
import { UnitSystem } from "@/commands";
import LabelField from "./fields/superClasses/LabelField";
import { Font, FontOption, FontStyle, IndexedFont, IndexedFontFamily, LabelOrientation, rotationForOrientation } from "./types";
import { LabelDirection } from "@/commands/tspl";
import CommandGenerator from "@/commands/CommandGenerator";
import * as fontkit from "fontkit"
import RotatableContainer from "./RotatableContainer";
import { unitToDot } from "@/helpers/UnitUtils";
import subsetFont from "subset-font";

const DEFAULT_FONT_WEIGHT = 400
const DEFAULT_FONT_STYLE = "normal"
const FONT_PREFIX = "f"

/**
 * Holds the content of a label and handles printing
 */
export default class Label extends Printable {
    /**
     * Width of label in dots, mm or inch
     */
    private readonly width: number
    /**
     * Height of label in dots, mm or inch
     */
    private readonly height: number

    /**
     * Units for width, height, gap and offset
     */
    private readonly unitSystem: UnitSystem
    private fonts: Record<string, IndexedFontFamily> = {}
    private dpi: number
    private density: number = 8
    private orientation: LabelOrientation = "normal"

    /**
    * List of fields on the label
    */
    private container: RotatableContainer
    private fontCounter = 0

    /**
     * Configuration used when generating commands
     */
    get printConfig(): PrintConfig {
        return { 
            dpi: this.dpi,
            textWidth: (text, font) => {
                const indexedFont = this.getIndexedFont(font)
                if(indexedFont == null) {
                    return text.length * font.size
                } else {
                    const fontObject = indexedFont.font
                    const run = fontObject.layout(text)

                    return font.size * run.advanceWidth / fontObject.unitsPerEm
                }
            },
            getFontName: this.getFontName.bind(this)
        }
    }

    /**
     * Change the orientation the label is printed in. This will rotate all fields in the container
     * @param orientation 
     */
    setOrientation(orientation: LabelOrientation) {
        this.orientation = orientation
        this.container.setRotation(rotationForOrientation(orientation))
    }

    constructor(
        width: number, 
        height: number, 
        dimensionUnit: UnitSystem = "metric", 
        dpi: number = 203,
        density: number = 8
    ) {
        super()
        this.width = width
        this.height = height
        this.unitSystem = dimensionUnit
        this.dpi = dpi
        this.density = density

        const widthInDots = unitToDot(width, dpi, dimensionUnit)
        const heightInDots = unitToDot(height, dpi, dimensionUnit)
        this.container = new RotatableContainer({ width: widthInDots, height: heightInDots })
    }

    async commandForLanguage(language: PrinterLanguage, config?: PrintConfig): Promise<Command> {
        return await this.container.commandForLanguage(language, config)
    }

    protected override commandGeneratorFor(language: PrinterLanguage): CommandGenerator<any> {
        if (language === "zpl") {
            return new zpl.ZPLCommandGenerator(this.dpi)
        }
        return super.commandGeneratorFor(language)
    }

    /**
     * Place fields to a label
     * @param fields 
     */
    add(...fields: LabelField[]) {
        this.container.add(...fields)
    }

    /**
     * Register a font to be used. Use the name provided in components to use the font. 
     * For example: textField.setFont('myFont.ttf', 12)
     * @param file Font file. Can be a blob or a url
     * @param name Name to be used to reference the font
     */
    async registerFont(font: Omit<Font, "font">) {
        const key = this.fontKey(font.weight, font.style)

        if(!this.fonts[font.name]) {
            this.fonts[font.name] = {
                fonts: {}
            }
        }

        const fontBuffer = Buffer.from(font.data)
        const builtFont = fontkit.create(fontBuffer)
        // @ts-ignore
        const finalFont = builtFont.fonts ? builtFont.fonts[0] : builtFont
        this.fonts[font.name].fonts[key] = {
            ...font,
            font: finalFont,
            alias: `${FONT_PREFIX}${this.fontCounter}.${this.fontExtension}`
        }
        this.fontCounter += 1
    }

    /**
     * Generate a command that is complete for printing
     * @param language Printing language to use
     * @param gap Distance between two labels. It is measured between the two points where the sensor 
     * leaves the label and enters the next one
     * @param direction Direction relative to printing direction. See documentation for more details
     * @param sets Number of sets to print. If you have counters for example, it will not change in a set
     * @param copiesPerSet Number of labels per set
     * @param mirror Mirror the label along the vertical axis
     * @param gapOffset Used with non uniform shaped labels. Is the distance between the point where the sensor leaves the label and the 
     * furthest point of the label in the direction of printing. Check documentation for more info
     * TODO: Is this too TSPL Specific?
     */
    async fullPrintCommand(language: PrinterLanguage, 
                           gap: number, 
                           direction: LabelDirection, 
                           sets: number, 
                           copiesPerSet: number = 1,
                           mirror: boolean = false, 
                           gapOffset: number = 0
                          ): Promise<Command> {

        const generator = this.commandGeneratorFor(language)
        const commands = await this.fullCommand(language, gap, direction, mirror, gapOffset, generator)
        commands.push(generator.print(sets, copiesPerSet))

        return generator.commandGroup(commands)
    }

    /**
     * Generate commands needed to display the label on the printer screen
     * @param language Printing language to use
     * @param direction Direction relative to printing direction. See documentation for more details
     * @param mirror Mirror the label along the vertical axis
     */
    async fullDisplayCommand(language: PrinterLanguage, direction: LabelDirection, mirror: boolean = false) {
        const generator = this.commandGeneratorFor(language)
        const commands = await this.fullCommand(language, 0, direction, mirror, 0, generator)
        commands.push(generator.display())
        
        return generator.commandGroup(commands)
    }

    /**
     * Helper function that generates common commands for print and display
     */
    private async fullCommand(language: PrinterLanguage, 
                              gap: number,  
                              direction: LabelDirection, 
                              mirror: boolean = false, 
                              gapOffset: number = 0, 
                              generator: CommandGenerator<any>) {
        let finalDimations: Dimension
        if(this.orientation == "normal" || this.orientation == "upside-down") {
            finalDimations = { width: this.width, height: this.height }
        } else {
            finalDimations = { width: this.height, height: this.width }
        }

        const commands = [
            await this.fontUploadCommands(generator),
            generator.setUp(
                finalDimations.width, 
                finalDimations.height, 
                gap, 
                gapOffset, 
                direction, 
                mirror, 
                this.unitSystem,
                this.density
            ),
            (await this.commandForLanguage(language, this.printConfig)),
        ]
        return commands
    }

    private async fontUploadCommands(generator: CommandGenerator<any>): Promise<Command> {
        const text = this.container.collectCharacters()
        const families = Object.keys(this.fonts)
        const commands = await Promise.all(families.flatMap(family => {
            const familyFonts = this.fonts[family].fonts
            const fontNames = Object.keys(familyFonts)

            return fontNames.map(async name => {
                const font = familyFonts[name]
                // @ts-ignore
                const data: ArrayBuffer = text.length > 0
                    ? (await subsetFont(Buffer.from(font.data), text, { targetFormat: "truetype" })).buffer
                    : font.data
                return generator.upload(font.alias, data)
            })
        }))

        return generator.commandGroup(commands)
    }

    private getIndexedFont(font: FontOption): IndexedFont|null  {
        const family = this.fonts[font.name]
        if (!family) return null
        
        const style = font.style ?? DEFAULT_FONT_STYLE
        const weight = font.weight ?? DEFAULT_FONT_WEIGHT

        const fontKeys = Object.keys(family.fonts)
        const exactMatch = fontKeys.find(key => 
            family.fonts[key].style == style &&
            family.fonts[key].weight == weight
        )

        // If there is a font that matches exactly the requested one we return that
        // otherwise we find the one that is the closest in weight
        // if there is no font with the same style, we return the first normal font in the family
        if(exactMatch) {
            return family.fonts[exactMatch]
        } else {
            const sameStyleKeys = fontKeys.filter(key => family.fonts[key].style == style)

            if(sameStyleKeys.length > 0){
                let weigthDiff = 99999999
                let selectedKey = ""

                sameStyleKeys.forEach(key => {
                    const diff = Math.abs(weight - family.fonts[key].weight)
                    if(diff < weigthDiff) {
                        weigthDiff = diff
                        selectedKey = key
                    }
                })

                return family.fonts[selectedKey]
            } else {
                return family.fonts[fontKeys[0]]
            }
        }
    }

    private getFontName(font: FontOption) {
        // We don't access values directly passed in to make sure the font name we return exists
        const indexedFont = this.getIndexedFont(font)
        if(indexedFont == null) {
            return font.name
        }
        return indexedFont.alias
        // return this.getFontNameForIndexed({name: font.name, weight: indexedFont.weight, style: indexedFont.style})
    }

    /// This can be extended when we want support multiple fonts
    private get fontExtension() {
        return "TTF"
    }

    private fontKey(weight: number, style?: FontStyle) {
        return `${weight}${style ?? DEFAULT_FONT_STYLE}`
    }
}