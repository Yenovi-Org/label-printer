import { UsbDevice } from "@/helpers/USBUtils";
import Command from "./Command";

/**
 * A utility class that helps grouping commands together
 * Should be implemented with a specific command type to ensure only commands for the same language are
 * grouped together
 */
export default abstract class CommandGroup<T extends Command> extends Command {
    private commands: T[]

    constructor(commands: T[]) {
        super()
        this.commands = commands
    }

    print(fn: (command: string) => void) {
        for (let commandIndex in this.commands) {
            this.commands[commandIndex].print(fn)
        }
    }

    async write(device: UsbDevice): Promise<void> {
        for (let commandIndex in this.commands) {
            await this.commands[commandIndex].write(device)
        }
    }

    get commandString(): string {
        return this.commands.map(c => c.commandString).join("\n")
    }
}