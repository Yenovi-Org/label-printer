import ZPLCommand from "../../ZPLCommand";

/**
 * Print quantity and end of the label format. TSPL prints `sets` x `copies` labels, ZPL takes the total
 * ^PQq^XZ
 */
export default class ZPLPrintCommand extends ZPLCommand {
    private readonly total: number

    constructor(sets: number, copiesPerSet: number) {
        super()
        this.total = Math.max(1, Math.round(sets) * Math.max(1, Math.round(copiesPerSet)))
    }

    get commandString(): string {
        return `^PQ${this.total}^XZ`
    }
}
