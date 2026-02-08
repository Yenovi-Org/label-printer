import { TSPLRawCommand } from "@/commands/tspl";
import { PrinterLanguage } from "@/commands"
import Printer from "./Printer";
import Device from "@/helpers/Device";
import NetworkDevice from "@/helpers/NetworkDevice";
import { discoverBonjourServices } from "@/helpers/BonjourUtils";

export default class TSPLPrinter extends Printer {
    get language(): PrinterLanguage {
        return "tspl"
    }

    async feedLabel(): Promise<void> {
        const feedCommand = new TSPLRawCommand("FORMFEED")
        await this.writeCommand(feedCommand)
    }

    static async try(device: Device): Promise<boolean> {
        if(!device.opened) await device.openAndConfigure()
        const testCommand = new TSPLRawCommand("~!I")
        await testCommand.writeTo(device)

        const response = await device.readString(64)
        await device.close()
        // If there is a response, we have a TSPL printer
        return !!response
    }

    static async discoverDevices(): Promise<NetworkDevice[]> {
        if(typeof window !== "undefined") return []

        const services = await discoverBonjourServices([
            "pdl-datastream",
            "printer",
        ])

        return services.map(s => new NetworkDevice(s.host, s.port))
    }
}