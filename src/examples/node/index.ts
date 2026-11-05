import { PrinterService } from "@/printers"
import { Label } from "@/labels"
// import textExample from "./exampleCases/textExample";
// import classicExample from "./exampleCases/classicExample"
// import textWrappingExample from "./exampleCases/textWrappingExample"
import zplExample from "./exampleCases/zplExample"
// import tableExample from "./exampleCases/tableExample"
// import tableRotationExample from "./exampleCases/tableRotationExample"
// import svgExample from "./exampleCases/imageTypesExample"
// import barcodeExample from "./exampleCases/barcodeExample"
// import densityExample from "./exampleCases/densityExample"
// import rotationExample from "./exampleCases/rotationExample"

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export default async () => {
    const displayOverPrint = false
    const monitorPrinter = false
    const printers = await PrinterService.getPrinters()
    // const printers = [await PrinterService.connectTSPL({ network: { host: "192.168.100.31", port: 9100 } })]
    // ZPL printer (set displayOverPrint to false, ZPL can't display a label): 
    // const printers = [await PrinterService.connectZPL({ network: { host: "192.168.100.31", port: 9100 } })]

    if(!monitorPrinter && printers.length > 0 && printers[0]) {
        const printer = printers[0]!

        // const result = await textWrappingExample()
        const result = await zplExample()
        // const result = await textExample()
        // const result = await classicExample()
        // const result = await tableExample()
        // const result = await tableRotationExample()
        // const result = await barcodeExample()
        // const result = await densityExample(8)
        // const result = await rotationExample()
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