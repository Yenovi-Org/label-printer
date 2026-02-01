describe("USBUtils", () => {
    afterEach(() => {
        jest.resetModules()
        delete (globalThis as any).window
        delete (globalThis as any).navigator
    })

    test("getDevices throws usb-unsupported when in browser without navigator.usb", async () => {
        ;(globalThis as any).window = {}
        ;(globalThis as any).navigator = {}

        await jest.isolateModulesAsync(async () => {
            const { getDevices } = await import("@/helpers/USBUtils")
            await expect(getDevices()).rejects.toBe("usb-unsupported")
        })
    })

    test("UsbDevice.writeData throws when no out endpoint", async () => {
        await jest.isolateModulesAsync(async () => {
            const { UsbDevice } = await import("@/helpers/USBUtils")

            const badDevice: any = {
                opened: true,
                configuration: {
                    interfaces: [
                        {
                            alternate: {
                                endpoints: [],
                            },
                        },
                    ],
                },
                transferOut: jest.fn(),
            }

            const dev = new UsbDevice(badDevice)
            await expect(dev.writeData(new Uint8Array([1]))).rejects.toThrow("usb-no-out-endpoint")
        })
    })

    test("UsbDevice.readString returns undefined when transferIn not ok", async () => {
        await jest.isolateModulesAsync(async () => {
            const { UsbDevice } = await import("@/helpers/USBUtils")

            const device: any = {
                opened: true,
                configuration: {
                    interfaces: [
                        {
                            alternate: {
                                endpoints: [
                                    { endpointNumber: 1, direction: "in" },
                                ],
                            },
                        },
                    ],
                },
                transferIn: jest.fn().mockResolvedValue({ status: "stall", data: undefined }),
            }

            const dev = new UsbDevice(device)
            const res = await dev.readString(10)
            expect(res).toBeUndefined()
        })
    })
})
