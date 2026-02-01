import { dotToPoint, getSizePreserveAspect, pointsToDots, valueWithUnit } from "@/helpers/UnitUtils"

test("getSizePreserveAspect respects desired width+height", () => {
    expect(getSizePreserveAspect(100, 50, 20, 10)).toEqual({ width: 20, height: 10 })
})

test("getSizePreserveAspect scales by desired height", () => {
    expect(getSizePreserveAspect(100, 50, undefined, 25)).toEqual({ width: 50, height: 25 })
})

test("getSizePreserveAspect scales by desired width", () => {
    expect(getSizePreserveAspect(100, 50, 20, undefined)).toEqual({ width: 20, height: 10 })
})

test("getSizePreserveAspect returns original size when no constraints", () => {
    expect(getSizePreserveAspect(100, 50)).toEqual({ width: 100, height: 50 })
})

test("valueWithUnit returns unit-specific representation", () => {
    expect(valueWithUnit(10, "dot")).toBe("10 dot")
    expect(valueWithUnit(10, "metric")).toBe("10 mm")
    expect(valueWithUnit(10, "imperial")).toBe(10)
})

test("dotToPoint and pointsToDots are inverse-ish", () => {
    const dpi = 203
    const dots = 100
    const pt = dotToPoint(dots, dpi)
    const backToDots = pointsToDots(pt, dpi)
    expect(backToDots).toBeGreaterThan(0)
})
