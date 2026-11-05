import ZPLCommand from "../ZPLCommand";

export default abstract class ZPLVisualCommand extends ZPLCommand {
    protected readonly x: number
    protected readonly y: number

    constructor(x: number, y: number) {
        super()
        this.x = x
        this.y = y
    }
}
