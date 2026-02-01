import Printer from "@/printers/Printer"
import { Label } from "@/labels"
import Command from "@/commands/Command"
import Printable from "@/labels/Printable"

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
}

class DummyPrintable extends Printable {
    async commandForLanguage(): Promise<Command> {
        return new DummyCommand()
    }

    public generatorFor(language: any) {
        // expose protected method
        return this.commandGeneratorFor(language)
    }
}

test("Printable.commandForPrinter delegates to language", async () => {
    const printable = new DummyPrintable()

    const fakeDevice: any = { opened: true, close: jest.fn() }
    const printer = new DummyPrinter(fakeDevice)

    const cmd = await printable.commandForPrinter(printer)
    expect(cmd.commandString).toBe("X")
})

test("Printable.commandGeneratorFor returns tspl generator", () => {
    const printable = new DummyPrintable()
    const gen = printable.generatorFor("tspl")
    expect(typeof gen.text).toBe("function")
})

test("Printer.writeCommand opens device if not opened", async () => {
    const openAndConfigure = jest.fn().mockResolvedValue(undefined)

    const fakeDevice: any = {
        opened: false,
        openAndConfigure,
        writeString: jest.fn(),
        writeData: jest.fn(),
        close: jest.fn(),
    }

    const printer = new DummyPrinter(fakeDevice)
    const cmd = new DummyCommand()

    await printer.writeCommand(cmd)
    expect(openAndConfigure).toHaveBeenCalled()
})

test("Printer.print calls label.fullPrintCommand", async () => {
    const fakeDevice: any = {
        opened: true,
        openAndConfigure: jest.fn(),
        writeString: jest.fn(),
        writeData: jest.fn(),
        close: jest.fn(),
    }

    const printer = new DummyPrinter(fakeDevice)
    const label = new Label(10, 10)

    const fullPrintCommand = jest.spyOn(label, "fullPrintCommand").mockResolvedValue(new DummyCommand())
    const writeCommand = jest.spyOn(printer, "writeCommand").mockResolvedValue(undefined)

    await printer.print(label, 2, 1)

    expect(fullPrintCommand).toHaveBeenCalled()
    expect(writeCommand).toHaveBeenCalled()

    fullPrintCommand.mockRestore()
    writeCommand.mockRestore()
})
