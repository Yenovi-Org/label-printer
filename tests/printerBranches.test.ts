import Printer, { PrinterStatus } from "@/printers/Printer"
import Command from "@/commands/Command"

class DummyCommand extends Command {
    get commandString(): string {
        return "X"
    }
}

class DummyPrinter extends Printer {
    get language() {
        return "tspl" as const
    }

    async feedLabel(): Promise<void> {
        return
    }

    async getModelname(): Promise<string> {
        return "Dummy"
    }

    async getStatus(): Promise<PrinterStatus> {
        return "normal"
    }
}

test("Printer.writeCommand does not open device when already opened", async () => {
    const openAndConfigure = jest.fn().mockResolvedValue(undefined)

    const fakeDevice: any = {
        opened: true,
        openAndConfigure,
        writeString: jest.fn(),
        writeData: jest.fn(),
        close: jest.fn(),
    }

    const printer = new DummyPrinter(fakeDevice)
    const cmd = new DummyCommand()

    await printer.writeCommand(cmd)
    expect(openAndConfigure).not.toHaveBeenCalled()
})
