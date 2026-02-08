import { PrinterService } from "@/printers"
import { Label } from "@/labels"
// import classicExample from "./exampleCases/classicExample"
// import tableExample from "./exampleCases/tableExample"
import svgExample from "./exampleCases/imageTypesExample"

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export default async () => {
    const displayOverPrint = true
    const monitorPrinter = true
    const printers = await PrinterService.getPrinters()
    
    if(!monitorPrinter && printers.length > 0) {
        const printer = printers[0]

        // const label = await classicExample()
        // const result = await tableExample()
        const result = await svgExample()
        const labels: Label[] = Array.isArray(result) ? result : [result]

        for (const label of labels) {
            if (displayOverPrint) {
                await printer.display(label)
                await sleep(5000)
            } else {
                await printer.print(label, 1, 3)
            }
        }

        await printer.close()
    }

    if (monitorPrinter) {
        console.log("Monitoring printer")
        const printer = await PrinterService.connectTSPL({ network: { host: "192.168.100.31", port: 9100 } })
        if(!printer) {
            throw new Error("Could not connect to TSPL printer")
        }

        while(true) {
            const model = await printer.getModelname()
            const status = await printer.getStatus()
            console.log(`[${new Date().toISOString()}] ${model} - ${status}`)
            
            await sleep(5000)
        }
    }
}