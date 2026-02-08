import { TSPLRawCommand } from "@/commands/tspl";
import { PrinterLanguage } from "@/commands"
import Printer from "./Printer";
import { UsbDevice } from "@/helpers/USBUtils";

export default class TSPLPrinter extends Printer {
    get language(): PrinterLanguage {
        return "tspl"
    }

    async feedLabel(): Promise<void> {
        const feedCommand = new TSPLRawCommand("FORMFEED")
        await this.writeCommand(feedCommand)
    }

    static async try(device: UsbDevice): Promise<boolean> {
        if(!device.opened) await device.openAndConfigure()
        const testCommand = new TSPLRawCommand("~!I")
        await testCommand.writeTo(device)

        const response = await device.readString(64)
        await device.close()
        // If there is a response, we have a TSPL printer
        return !!response
    }
}