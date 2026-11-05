import { Command, PrinterLanguage, tspl, zpl } from "@/commands";
import CommandGenerator from "@/commands/CommandGenerator";
import { Printer } from "@/printers";
import { FontOption } from "./types";

export type PrintConfig = {
    dpi: number,
    /** Width of the text in dots */
    textWidth: (text: string, font: FontOption) => number,
    getFontName: (font: FontOption) => string,
}

/**
 * A component that can be directly printed to label printer
 */
export default abstract class Printable {
    /**
     * Generates a printable command
     * @param language The printing language that should be used
     * @returns A promise of a command that can be printed
     */
    abstract commandForLanguage(language: PrinterLanguage, config?: PrintConfig): Promise<Command>

    /**
     * Generates printable command for the given printer. Can be used to obtain a command for fields supported by the package then customizing it before printing
     * @param printer Printer to generate the command. Important because the command is printer language specific
     * @returns A promise for a command. Most commands are synchronous but some may require to access async resources
     */
    async commandForPrinter(printer: Printer, config?: PrintConfig): Promise<Command> {
        return await this.commandForLanguage(printer.language, config)
    }

    /**
     * Obtain a command generator for the given language
     * @param language Language to get generator for
     */
    protected commandGeneratorFor(language: PrinterLanguage): CommandGenerator<any> {
        switch(language) {
            case "tspl": return tspl.commandGenerator
            case "zpl":  return zpl.commandGenerator
        }
    }
}