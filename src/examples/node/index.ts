import { PrinterService } from "@/printers"
// import classicExample from "./exampleCases/classicExample"
import tableExample from "./exampleCases/tableExample"

export default async () => {
    const printers = await PrinterService.getPrinters()
    
    if(printers.length > 0) {
        const printer = printers[0]

        // const label = await classicExample()
        const label = await tableExample()

        await printer.display(label)
        await printer.close()
    }
}