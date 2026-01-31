import { PrinterService } from "@/printers"
import { Label } from "@/labels"
// import classicExample from "./exampleCases/classicExample"
import tableExample from "./exampleCases/tableExample"

export default async () => {
    const printers = await PrinterService.getPrinters()
    
    if(printers.length > 0) {
        const printer = printers[0]

        // const label = await classicExample()
        const result = await tableExample()
        const labels: Label[] = Array.isArray(result) ? result : [result]

        for (const label of labels) {
            await printer.print(label, 1, 3)
        }
        await printer.close()
    }
}