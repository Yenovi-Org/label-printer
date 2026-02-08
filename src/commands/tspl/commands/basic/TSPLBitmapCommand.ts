import ImageUtils, { BWBitmap } from "@/helpers/ImageUtils";
import { GraphicMode } from "../../types";
import TSPLVisualCommand from "../TSPLVisualCommand";
import Device from "@/helpers/Device";

/**
 * Represents a bitmap command. Can be used to draw an image to the label
 * {@link /documentsions/TSPL.pdf}
 */
export default class TSPLBitmapCommand extends TSPLVisualCommand {
    /**
     * Bitmap to present. 
     * TSPL only supports black and write printing so this bitmap contains a matrix of 1 (White pixel)
     * and 0 (Black pixel) values
     */
    private readonly bitmap: BWBitmap
    private readonly mode: GraphicMode

    /**
     * @param bitmap Bitmap to present. 
     * @param x X coordinates in dots
     * @param y Y Coordinates in dots
     * @param mode Represents the strategy to use when two bitmaps overlap. The final value will be determined by
     * either overwriting the first bitmap's value with the second one or performing an 'or' or 'xor' operation on the values
     */
    constructor(bitmap: BWBitmap, x: number, y: number, mode?: GraphicMode) {
        super(x, y);
        this.bitmap = bitmap;
        this.mode = mode ?? "overwrite"
    }

    get commandString(): string {
        const textDecoder = new TextDecoder('utf-8')
        const bytesString = textDecoder.decode(this.bitmap.bytes)

        return `${this.commandWithoutBytes}${bytesString.slice(0,5)}...\n`;
    }

    private get commandWithoutBytes(): string {
        return `BITMAP ${this.x}, ${this.y},${this.bitmap.width},${this.bitmap.height},${this.modeValue},`
    }

    private get modeValue(): 0|1|2 {
        switch (this.mode) {
            case "overwrite": return 0
            case "or": return 1
            case "xor": return 2
        }
    }

    async writeTo(device: Device): Promise<void> {
        await this.writeString(this.commandWithoutBytes, device)
        await this.writeBytes(this.bitmap.bytes, device)
        await this.terminateCommand(device)
    }

    /**
     * Create a new bitmap command for the given image url
     * @param image Image to create command for 
     * @param x X coordinate of the image
     * @param y Y coordinate of the image
     * @param imageWidth Desired width of the image
     * @param imageHeight Desired height of the image
     * @param mode Graphics mode
     * @returns 
     */
    static async forImageUrl(image: string, x: number, y: number, imageWidth?: number, imageHeight?: number, mode?: GraphicMode) {
        const bitmap = await ImageUtils.getBWBitmap(image, imageWidth, imageHeight)
        return new TSPLBitmapCommand(bitmap, x, y, mode)
    }
}