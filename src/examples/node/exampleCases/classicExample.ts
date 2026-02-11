import ImageUtils from "@/helpers/ImageUtils"
import { labels } from "@/index"
import fs from "fs"
// import QRCode from "@/labels/fields/QRCode"

export default async (): Promise<labels.Label> => {
    const fontName = "roboto"
    const testText = "<i>Exciting</i> <s>things</s> are <del>coming</del> to <strike>label-printer</strike>"
    const fontSize = 25
    const textX = 10
    const textY = 10
    const textWidth = 250

    const qrX = textX
    const qrY = textY + fontSize * 2 + 20

    const fontRegular = fs.readFileSync(__dirname+"/../Roboto-Regular.ttf").buffer
    const fontBold = fs.readFileSync(__dirname+"/../Roboto-Bold.ttf").buffer
    const fontItalic = fs.readFileSync(__dirname+"/../Roboto-Italic.ttf").buffer
    const fontBoldItalic = fs.readFileSync(__dirname+"/../Roboto-BoldItalic.ttf").buffer

    const label = new labels.Label(50, 25)

    await label.registerFont({name: fontName, data: fontRegular, weight: 400, style: "normal"})
    await label.registerFont({name: fontName, data: fontBold, weight: 700, style: "normal"})
    await label.registerFont({name: fontName, data: fontItalic, weight: 400, style: "italic"})
    await label.registerFont({name: fontName, data: fontBoldItalic, weight: 700, style: "italic"})

    const text = new labels.Text(testText, textX, textY)
    const line = new labels.Line({x: textX - 5, y: textY}, {x: textX - 5 , y: textY + fontSize * 2 + 2})
    const imageData = await ImageUtils.getBWBitmap("https://firebasestorage.googleapis.com/v0/b/tlprinting-live.appspot.com/o/user%2F1701885792189-favicon.png?alt=media&token=4a7a5940-34d6-416c-ac46-f0c6df3a00e2", 100, 100)
    const image = new labels.Image(qrX, qrY, imageData)

    // const qrCodeText = "https://tlprinting.net"
    // const qrcode = new QRCode(qrCodeText, qrX, qrY, textWidth / 2)
    // label.add(qrcode)

    text.setFont({name: fontName, size: fontSize})
    text.setMultiLine(textWidth)

    label.add(text, line, image)

    return label
}
