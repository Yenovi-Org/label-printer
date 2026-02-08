import ImageUtils, { BWBitmap } from "@/helpers/ImageUtils"
import { Label } from "@/labels"
import { Image, Text } from "@/labels/fields"
import fs from "fs"

const labelForBitmap = async (title: string, bitmap: BWBitmap): Promise<Label> => {
    const widthDots = bitmap.width * 8
    const heightDots = bitmap.height
    const label = new Label(widthDots, heightDots + 30, "dot")

    const caption = new Text(title, 0, 0)
    caption.setFont({ name: "default", size: 20 })

    const image = new Image(0, 30, bitmap)
    label.add(caption, image)
    return label
}

export default async (): Promise<Label[]> => {
    const rasterUrlLarge = "https://raw.githubusercontent.com/github/explore/main/topics/python/python.png"
    const rasterUrlSmall = "https://raw.githubusercontent.com/github/explore/main/topics/typescript/typescript.png"

    const inlineSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40" viewBox="0 0 80 40">
  <rect x="0" y="0" width="80" height="40" fill="white"/>
  <rect x="2" y="2" width="76" height="36" rx="6" fill="#000"/>
  <circle cx="20" cy="20" r="10" fill="#fff"/>
  <circle cx="60" cy="20" r="10" fill="#fff"/>
</svg>`

    const svgFilePath = __dirname + "/test.svg"
    const fileSvg = fs.readFileSync(svgFilePath, "utf8")

    const labels: Label[] = []

    const rasterResized = await ImageUtils.getBWBitmap(rasterUrlLarge, 120, 80)
    labels.push(await labelForBitmap("1) Raster resized", rasterResized))

    const rasterOriginal = await ImageUtils.getBWBitmap(rasterUrlSmall)
    labels.push(await labelForBitmap("2) Raster original", rasterOriginal))

    const svgResized = await ImageUtils.getBWBitmap(inlineSvg, 120, 80)
    labels.push(await labelForBitmap("3) SVG resized", svgResized))

    const svgOriginal = await ImageUtils.getBWBitmap(fileSvg)
    labels.push(await labelForBitmap("4) SVG original", svgOriginal))

    return labels
}
