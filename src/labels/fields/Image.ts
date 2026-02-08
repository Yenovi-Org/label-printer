import { Command, PrinterLanguage } from "@/commands";
import { PrintConfig } from "../Printable";
import LabelField from "./LabelField";
import ImageUtils, { BitmapLike } from "@/helpers/ImageUtils";

export default class Image extends LabelField {
    /**
     * X coordinate in dots
     */
    private readonly x: number
    /**
     * Y coordinate in dots
     */
    private readonly y: number

    private readonly image: BitmapLike

    constructor(x: number, y: number, image: BitmapLike) {
        super()
        this.x = x
        this.y = y
        this.image = image
    }

    async commandForLanguage(language: PrinterLanguage, _config?: PrintConfig | undefined): Promise<Command> {
        return await this.commandGeneratorFor(language).image(this.image, this.x, this.y)
    }

    /**
     * Create an image field for an image
     * @param image 
     * @param x 
     * @param y 
     * @param width 
     * @param height 
     * @returns 
     */
    static async create(image: string|Blob, x: number, y: number, width?: number, height?: number): Promise<Image> {
        const bitmap = await ImageUtils.getBWBitmap(image, width, height)

        return new Image(x, y, bitmap)
    }
}