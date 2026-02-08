import ImageUtils from "@/helpers/ImageUtils";

describe("SVG support", () => {
    test("Node rasterizes inline svg at the requested target size", async () => {
        const pixels = await ImageUtils.getPixels(
            '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect x="0" y="0" width="10" height="10" fill="black"/></svg>',
            { width: 40, height: 20 }
        )

        expect(pixels.width).toBe(40)
        expect(pixels.height).toBe(20)
        expect(pixels.data.length).toBe(40 * 20 * 4)
    })
})
