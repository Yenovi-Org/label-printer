import { Command, PrinterLanguage } from "@/commands";
import { LabelDirection } from "@/commands/tspl";
import Device from "@/helpers/Device";
import { Label } from "@/labels"

/**
 * Base class that encapsulates functionality of all printers
 */
export default abstract class Printer {
    private readonly device: Device

    /**
     * Printer language used by the type of printer the subclass represents
     */
    abstract get language(): PrinterLanguage

    /**
     * When called, it will feed the labels to the beginig of the next label
     */
    abstract feedLabel(): Promise<void>

    constructor(device: Device) {
        this.device = device
    }

    /**
     * Close the printer USB
     */
    async close() {
        await this.device.close()
    }

    /**
     * Prints a label
     * @param label 
     */
    async print(label: Label, 
                sets: number,
                gap: number, 
                copiesPerSet: number = 1,
                direction: LabelDirection = "normal",
                mirror: boolean = false, 
                gapOffset: number = 0) {
        const commands = await label.fullPrintCommand(this.language, gap, direction, sets, copiesPerSet, mirror, gapOffset)
        await this.writeCommand(commands)
    }

    /**
     * Display label on the printer's screen
     * @param label 
     */
    async display(label: Label, direction: LabelDirection = "normal", mirror: boolean = false) {
        const command = await label.fullDisplayCommand(this.language, direction, mirror)
        await this.writeCommand(command)
    }

    /**
     * Writes a command to the printers usb
     * @param command Command to send to the usb
     */
    async writeCommand(command: Command): Promise<void> {
        if(!this.device.opened) await this.device.openAndConfigure()
        await command.writeTo(this.device)
    }

    /**
     * Check if the device is indeed a printer
     * @param device 
     */
    static try(_device: Device): Promise<boolean> {
        throw new Error("try(device:) should be implemented")
    }
}