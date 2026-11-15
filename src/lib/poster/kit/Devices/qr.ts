import qrcode from 'qrcode-generator'

/** The dark modules of a QR code as one SVG path, inside a four-module quiet zone. */
export function qrPath(value: string): { size: number; path: string } {
    const code = qrcode(0, 'M')
    code.addData(value)
    code.make()
    const count = code.getModuleCount()
    const parts: string[] = []
    for (let row = 0; row < count; row++) {
        for (let col = 0; col < count; col++) {
            if (code.isDark(row, col)) parts.push(`M${col + 4} ${row + 4}h1v1h-1z`)
        }
    }
    return { size: count + 8, path: parts.join('') }
}
