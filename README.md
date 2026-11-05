# Label Printer

> :warning: `label-printer` is still under heavy development and is subject to frequent API changes


This package provides a TypeScript/JavaScript API to:

- **Build labels** in a printer-language-independent way
- **Generate printer commands** for **TSPL** and **ZPL**
- **Find and talk to printers**
  - **Browser**: via WebUSB
  - **Node.js**: via USB and **automatic network discovery** (TCP/9100)

## Installation

```bash
npm install label-printer 
```

## Main exports

The library exposes three main areas:

- **Commands**: `import { commands } from "label-printer"`
- **Labels**: `import { labels } from "label-printer"`
- **Printers**: `import { printers } from "label-printer"`

## Runtime support (Browser vs Node)

### Browser

- Uses **WebUSB** to communicate with USB label printers.
- Typical entry point: `printers.PrinterService.requestPrinter()`.

### Node.js

- Supports USB printing (where supported by the `usb` dependency).
- Supports **network printing over TCP** (raw printing, usually port `9100`).
- Supports **automatic network discovery**:
  - First attempts Bonjour/mDNS discovery of printer-related services
  - If Bonjour yields no candidates, falls back to a conservative private-subnet scan
  - Every discovered candidate is **verified** by sending the language's identify command (`~!I` for TSPL, `~HI` for ZPL), so the printer language is detected automatically

## Printer layer

### Discover printers

```ts
import { printers } from "label-printer"

const printersList = await printers.PrinterService.getPrinters()
if(printersList.length === 0) {
  throw new Error("No printers found")
}

const printer = printersList[0]
```

### Request a printer (browser-focused)

```ts
import { printers } from "label-printer"

const printer = await printers.PrinterService.requestPrinter()
if(!printer) throw new Error("No printer selected")
```

### Print or display a label 

```ts
import { labels } from "label-printer"

const label = new labels.Label(50, 25)
// 1 label, 3mm gap
await printer.print(label, 1, 3)
// or
await printer.display(label)

await printer.close()
```

`display` shows the label on the printer's screen. It is only available for TSPL, ZPL printers throw an
"Operation not supported" error.

### Write the print code to a file

Useful for debugging or sending the commands with an external tool (Node.js only):

```ts
import { printers } from "label-printer"

await printers.PrinterService.printToFile("out/label.zpl", label, "zpl", 1, 3)
// then for example: nc 192.168.100.31 9100 < out/label.zpl
```

### Connect directly (bypass discovery)

If you already know how to reach your printer (network address or USB identifiers), you can create a printer instance directly.

Auto-detect language (recommended default):

```ts
import { printers } from "label-printer"

const printer = await printers.PrinterService.connect({ network: { host: "192.168.100.31" } })
if(!printer) throw new Error("Printer not found or not supported")
```

Explicit language (when you know it's a TSPL or a ZPL printer). Both still probe the printer and return `undefined` if it doesn't answer:

```ts
import { printers } from "label-printer"

const printer = await printers.PrinterService.connectTSPL({ network: { host: "192.168.100.31", port: 9100 } })
if(!printer) throw new Error("Not a TSPL printer")

const zebra = await printers.PrinterService.connectZPL({ network: { host: "192.168.100.31", port: 9100 } })
if(!zebra) throw new Error("Not a ZPL printer")
```

USB (Node.js - filter without a prompt):

```ts
import { printers } from "label-printer"

const printer = await printers.PrinterService.connect({
  usb: { vendorId: 0x1234, productId: 0x5678, serialNumber: "ABC" }
})
if(!printer) throw new Error("Printer not found or not supported")
```

USB (Browser - shows a picker; you can optionally filter by `vendorId` / `productId`):

```ts
import { printers } from "label-printer"

const printer = await printers.PrinterService.connect({
  usb: { vendorId: 0x1234, productId: 0x5678 }
})
if(!printer) throw new Error("No printer selected")
```

## Device abstraction

Commands write to a transport-agnostic `Device` interface. This enables the same printer and label APIs to work over different transports.

- **USB** device implementation is internal to `USBUtils`.
- **Network** support uses a TCP implementation in Node.js.

## Label layer

The label layer provides a language-independent way to construct labels, which can then be rendered to commands for the chosen printer language.

```ts
import { labels } from "label-printer"

const label = new labels.Label(50, 25)
// label.add(...fields)
```

## Supported languages

- [TSPL](documentations/TSPL.pdf)
- [ZPL](documentations/ZPL.pdf) (Zebra). Tested on a ZT411 over USB.

The same label produces the printer code for both languages. Language-specific notes:

- **Gap, gap offset**: ZPL printers measure the gap during calibration. Only "gap" (`gap > 0`) or "continuous" (`gap = 0`) media is set. `gapOffset` is ignored.
- **Density**: TSPL density `0-15` is mapped to the ZPL darkness `~SD00-30`.
- **Copies**: `sets * copiesPerSet` labels are printed.
- **Fonts**: text without a registered font uses the printer's scalable font `0`. Registered fonts are uploaded to the printer's RAM (`R:`), so they have to be uploaded again after a power cycle.
- **Text encoding**: field data is sent as UTF-8 (`^CI28`) and reserved characters (`^`, `~`, `_`) are escaped.
- **Barcodes**: the supported symbologies are `128`, `EAN128` (GS1-128, application identifiers in parentheses), `EAN13`, `EAN8`, `UPCA`, `UPCE`, `39`, `39C`, `93`, `25`, `25C`, `ITF14`, `CODA`, `MSI`, `MSIC`, `PLESSEY` and `11`. Other types print as Code 128. For EAN/UPC the printer calculates the check digit, so data that is too long is cut. Add-on digits (`+2`, `+5`) are not supported. The human readable line is either on or off, its alignment cannot be set.
- **QR codes**: rotated codes are placed correctly, but the symbol itself is not rotated (`^BQ` has no rotation). The version is picked by the printer, so the code can be larger than the requested width when the content has lower case letters.

## Fields

Fields are available from the package root export.

### Text

Create a text field at (`x`, `y`) in **dots**.

```ts
import { labels } from "label-printer"

const label = new labels.Label(50, 25)

const text = new labels.Text("Hello", 20, 20, true)
text.setSingleLine(200)

label.add(text)
```

Text wrapping/clipping:

- `text.setSingleLine(width?)`
- `text.setMultiLine(width, height?)`

Formatted text (when `formatted = true`) supports basic tags:

- `<b>...</b>`: bold (uses weight `700`)
- `<i>...</i>`: italic
- `<u>...</u>`: underline
- `<s>...</s>`: strike

### Line

Draw a line between two points (values in **dots**).

```ts
import { labels } from "label-printer"

label.add(new labels.Line({ x: 10, y: 10 }, { x: 300, y: 10 }, 3))
```

### Image

Draw a black/white bitmap image. You can either provide a bitmap-like object directly,
or use the async helper to load/convert an image.

```ts
import { labels } from "label-printer"

const img = await labels.Image.create("./logo.png", 10, 60, 200)
label.add(img)
```

SVG inputs are supported. In Node.js, the library will automatically try to load `@resvg/resvg-js` or `sharp` for rasterization. If neither can be auto-loaded (e.g. on Vercel or other bundled environments), configure the rasterizer explicitly at app startup:

```ts
import { Resvg } from '@resvg/resvg-js'
import { configureSVGRasterizer } from 'label-printer'

configureSVGRasterizer((svg, target) => {
  const resvg = new Resvg(svg, target ? { fitTo: { mode: 'width', value: target.width } } : undefined)
  return Buffer.from(resvg.render().asPng())
})
```

This is only needed when the automatic loading fails — in standard Node.js environments with `@resvg/resvg-js` installed it works without any configuration.

### BarCode

Draw a barcode. Values are in **dots**.

```ts
import { labels } from "label-printer"

const barcode = new labels.BarCode("123456789", 20, 120, "CODE128", 80)
barcode.setHumanReadable("bottom")
barcode.setRotation(0)

label.add(barcode)
```

### QRCode

Draw a QR code.

```ts
import { labels } from "label-printer"

label.add(new labels.QRCode("https://example.com", 20, 220, 6))
```

### Table

The `Table` field draws a grid and places text into each cell. It uses the existing `Text` field for cell contents and the existing `Line` field for the grid lines.

```ts
import { labels } from "label-printer"

const label = new labels.Label(50, 25)

const table = new labels.Table(10, 10, [
  ["A1", "A2"],
  ["B1", "B2"],
], {
  size: { width: 200, height: 100 },
  columnWidths: [80, 120],
  rowHeights: [40, 60],
  lineThickness: 2,
  cellPadding: 4,
  formatted: false,
  font: { name: "default", size: 10 },
})

label.add(table)
```

Sizing rules:

- **If `size.width`/`size.height` are set**
  - Any unspecified row/column sizes share the remaining space equally.
  - Cell text is constrained to the cell content box and will wrap to multiple lines. If a row height is fixed, the text may be clipped once it reaches the height limit.
- **If table size is not set**
  - Unspecified row/column sizes are measured from their content.

## Command layer

The command layer is the lowest level and represents printer-language-specific commands.

Most users will not need this directly. It is primarily used internally by `Label` to generate
print/display command sequences.

## Public API summary

- **`Label`**
  - Construct labels and add fields
  - Generate language-specific print/display commands via printer layer
- **`PrinterService`**
  - `getPrinters()`
    - Browser: discovers accessible USB printers
    - Node: discovers USB printers + network printers (Bonjour/mDNS, then subnet scan fallback)
  - `requestPrinter()`
    - Browser: prompts user for a USB device
    - Node: selects first available USB device (may return `undefined`)
- **`Printer`**
  - `print(label, sets, gap, copiesPerSet?, direction?, mirror?, gapOffset?)`
  - `display(label, direction?, mirror?)`
  - `getModelname()`
  - `getStatus()`
  - `writeRawString(text)`
  - `close()`

- **`PrinterStatus`**
  - String union of possible status values returned by `printer.getStatus()`.
  - Access via `printers.PrinterStatus`.

## Examples

`src/examples/node` contains example labels that can be printed with `pnpm examples` (set the printer in `src/examples/node/index.ts`).
`zplExample` is a hardware test set for ZPL printers: text, lines, all barcode types, rotations, QR codes and images on 70 x 30 mm labels. Each label has a comment that describes what the printed result should look like.

## Notes

### Useful units

- 1 pt = 1/72 inch
- 1 dot = 1 / dpi

### Fonts

There are two ways to use fonts:

1. Use printer built-in fonts (by using `name: "default"`)
2. Register and use custom fonts on a per-`Label` basis

#### Set a font on `Text` / `Table`

Fonts are configured using a `FontOption`:

```ts
text.setFont({ name: "default", size: 10 })
// or
text.setFont({ name: "MyFont", size: 18, weight: 700, style: "normal" })
```

- `size` is specified in **dots**.
- `weight` defaults to `400`.
- `style` defaults to `"normal"`.

#### Register a custom font on a `Label`

Registering fonts enables better text measurement (for wrapping) and ensures the font is uploaded
as part of the generated print/display command sequence.

```ts
import { labels } from "label-printer"

const label = new labels.Label(50, 25)

await label.registerFont({
  name: "MyFont",
  data: await (await fetch("/fonts/MyFont-Regular.ttf")).arrayBuffer(),
  weight: 400,
  style: "normal",
})

await label.registerFont({
  name: "MyFont",
  data: await (await fetch("/fonts/MyFont-Bold.ttf")).arrayBuffer(),
  weight: 700,
  style: "normal",
})
```

Font notes:

- If a font is not working, make sure the extension is **TTF**.
- Text sizes are in **dots**. ZPL printers print the size rounded to a whole point (1 pt = 1/72 inch).
- If you want bold text, register a `weight: 700` variant.
- When using formatted text (`<b>...</b>`), the library will request `weight: 700`.

# Update package

Releases are made with [changesets](https://github.com/changesets/changesets) and published to npm by the
[Release workflow](.github/workflows/release.yml), which runs on every push to `main`.

- Make changes on feature branch.
- Run `pnpm changeset` on feature branch to create change. Choose the bump (patch/minor/major) and describe the change. Commit the generated file from `.changeset/`.
- Merge feature branch into main.
- The workflow collects the changesets in a "Version Packages" PR (version bump and `CHANGELOG.md`). Merge it to trigger the publish (`pnpm release`: install, build, `changeset publish`).
- Tests run on pull requests with the [Test workflow](.github/workflows/test.yml) (`pnpm test`).
