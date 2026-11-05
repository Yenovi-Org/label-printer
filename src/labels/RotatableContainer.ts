import RotatableLabelField from "./fields/superClasses/RotatableLabelField";
import { RotatableField, PositionedField } from "./fields/superClasses/interfaces";
import LabelField from "./fields/superClasses/LabelField";
import { PrintConfig } from "./Printable";
import { Command, Dimension, Point, PrinterLanguage, Rotation } from "@/commands";

export default class RotatableContainer extends RotatableLabelField {
    private fields: LabelField[] = []
    private size: Dimension

    /**
     * @param size Size in dots
     */
    constructor(size: Dimension) {
        super()
        this.size = size
    }

    /**
    * Place fields in the container
    * @param fields
    */
    add(...fields: LabelField[]) {
        this.fields.push(...fields)
    }

    collectCharacters(): string {
        return this.fields.map(f => f.textContent()).join("")
    }

    async commandForLanguage(language: PrinterLanguage, config?: PrintConfig): Promise<Command> {
        const commandList = await Promise.all(this.fields.map(field => this.rotationAdjustedCommand(field, language, config)))
        return this.commandGeneratorFor(language).commandGroup(commandList)
    }

    async rotationAdjustedCommand(field: LabelField, language: PrinterLanguage, config?: PrintConfig): Promise<Command> {
        let originalRotation: Rotation|undefined = undefined
        let originalPosition: Point|undefined = undefined

        if(field.hasOwnProperty("rotation")) {
            const rotatableField = field as unknown as RotatableField
            originalRotation = (rotatableField).getRotation()
            
            rotatableField.setRotation((originalRotation + this.rotation) % 360 as Rotation)
        }
        if(typeof (field as any).getPosition === "function" && typeof (field as any).setPosition === "function") {
            const positionedField = field as unknown as PositionedField
            originalPosition = positionedField.getPosition()
            positionedField.setPosition(this.adjustPosition(originalPosition))
        }

        const command = await field.commandForLanguage(language, config)

        if(originalRotation !== undefined) {
            const rotatableField = field as unknown as RotatableField
            rotatableField.setRotation(originalRotation)
        }
        if(originalPosition !== undefined) {
            const positionedField = field as unknown as PositionedField
            positionedField.setPosition(originalPosition)
        }

        return command
    }

    adjustPosition(position: Point): Point {
        switch(this.rotation) {
            case 90:
                return { x: this.size.height - position.y, y: position.x }
            case 180:
                return { x: this.size.width - position.x, y: this.size.height - position.y }
            case 270:
                return { x: position.y, y: this.size.width -position.x }
            default:
                return position
        }
    }
}