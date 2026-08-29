/*
Run from the repository root: swift scripts/generate-social-image.swift

Requires macOS because it uses AppKit and ImageIO. This script is the source
of truth for web/public/social-image.png. Change this scene and rerun it;
never edit the generated PNG incrementally.
*/

import AppKit
import ImageIO
import UniformTypeIdentifiers

let canvasWidth: CGFloat = 1200
let canvasHeight: CGFloat = 630

func color(_ red: CGFloat, _ green: CGFloat, _ blue: CGFloat, _ alpha: CGFloat = 1) -> CGColor {
	CGColor(red: red / 255, green: green / 255, blue: blue / 255, alpha: alpha)
}

func rectangle(_ x: CGFloat, _ y: CGFloat, _ width: CGFloat, _ height: CGFloat) -> CGRect {
	CGRect(x: x, y: canvasHeight - y - height, width: width, height: height)
}

func drawText(_ text: String, _ x: CGFloat, _ y: CGFloat, _ fontSize: CGFloat, _ weight: NSFont.Weight, _ fill: NSColor) {
	let font = NSFont.systemFont(ofSize: fontSize, weight: weight)
	let attributes: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: fill]
	let textHeight = font.ascender - font.descender
	NSAttributedString(string: text, attributes: attributes).draw(at: NSPoint(x: x, y: canvasHeight - y - textHeight))
}

let colorSpace = CGColorSpaceCreateDeviceRGB()
let context = CGContext(data: nil, width: Int(canvasWidth), height: Int(canvasHeight), bitsPerComponent: 8, bytesPerRow: 0, space: colorSpace, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
context.setFillColor(color(9, 9, 11))
context.fill(CGRect(x: 0, y: 0, width: canvasWidth, height: canvasHeight))

let purpleGlow = CGGradient(colorsSpace: colorSpace, colors: [color(124, 92, 255, 0.24), color(124, 92, 255, 0)] as CFArray, locations: [0, 1])!
context.drawRadialGradient(purpleGlow, startCenter: CGPoint(x: 160, y: 500), startRadius: 0, endCenter: CGPoint(x: 160, y: 500), endRadius: 360, options: [])
let cyanGlow = CGGradient(colorsSpace: colorSpace, colors: [color(34, 211, 238, 0.14), color(34, 211, 238, 0)] as CFArray, locations: [0, 1])!
context.drawRadialGradient(cyanGlow, startCenter: CGPoint(x: 1130, y: 62), startRadius: 0, endCenter: CGPoint(x: 1130, y: 62), endRadius: 340, options: [])

context.setStrokeColor(color(167, 139, 250, 0.05))
context.setLineWidth(1)
for position in stride(from: CGFloat(0), through: canvasWidth, by: 32) {
	context.move(to: CGPoint(x: position, y: 0))
	context.addLine(to: CGPoint(x: position, y: canvasHeight))
}
for position in stride(from: CGFloat(0), through: canvasHeight, by: 32) {
	context.move(to: CGPoint(x: 0, y: position))
	context.addLine(to: CGPoint(x: canvasWidth, y: position))
}
context.strokePath()

let logoGlow = CGGradient(colorsSpace: colorSpace, colors: [color(124, 92, 255, 0.24), color(34, 211, 238, 0)] as CFArray, locations: [0, 1])!
context.drawRadialGradient(logoGlow, startCenter: CGPoint(x: 260, y: 310), startRadius: 0, endCenter: CGPoint(x: 260, y: 310), endRadius: 230, options: [])

let graphicsContext = NSGraphicsContext(cgContext: context, flipped: false)
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = graphicsContext
let logo = NSImage(contentsOfFile: "web/public/logo.webp")!
logo.draw(in: rectangle(56, 105, 410, 441), from: .zero, operation: .sourceOver, fraction: 1, respectFlipped: true, hints: [.interpolation: NSImageInterpolation.high])

let pillX: CGFloat = 576
let pillY: CGFloat = 134
let pillWidth: CGFloat = 130
let pillHeight: CGFloat = 42
let pillPath = CGPath(roundedRect: rectangle(pillX, pillY, pillWidth, pillHeight), cornerWidth: pillHeight / 2, cornerHeight: pillHeight / 2, transform: nil)
context.addPath(pillPath)
context.setFillColor(color(29, 26, 52))
context.fillPath()
context.addPath(pillPath)
context.setStrokeColor(color(83, 72, 138))
context.setLineWidth(1)
context.strokePath()

let label = "100% local"
let labelFont = NSFont.systemFont(ofSize: 16, weight: .semibold)
let labelWidth = NSAttributedString(string: label, attributes: [.font: labelFont]).size().width
let contentStart = pillX + (pillWidth - (10 + 10 + labelWidth)) / 2
context.setFillColor(color(52, 211, 153))
context.fillEllipse(in: rectangle(contentStart, pillY + 16, 10, 10))
drawText(label, contentStart + 20, pillY + 11, 16, .semibold, NSColor(calibratedWhite: 212 / 255, alpha: 1))

drawText("Remove solid", 576, 183, 72, .bold, NSColor(calibratedWhite: 244 / 255, alpha: 1))
drawText("backgrounds.", 576, 263, 72, .bold, NSColor(calibratedRed: 139 / 255, green: 125 / 255, blue: 245 / 255, alpha: 1))
drawText("Create transparent images in your browser.", 580, 371, 26, .regular, NSColor(calibratedWhite: 161 / 255, alpha: 1))
context.setStrokeColor(color(63, 63, 70))
context.setLineWidth(1)
context.move(to: CGPoint(x: 576, y: canvasHeight - 454))
context.addLine(to: CGPoint(x: 932, y: canvasHeight - 454))
context.strokePath()
drawText("No upload. No server. Just unbg.", 576, 479, 23, .regular, NSColor(calibratedWhite: 113 / 255, alpha: 1))
drawText("unbg", 980, 537, 24, .bold, NSColor(calibratedWhite: 113 / 255, alpha: 1))
NSGraphicsContext.restoreGraphicsState()

let output = URL(fileURLWithPath: "web/public/social-image.png")
let destination = CGImageDestinationCreateWithURL(output as CFURL, UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(destination, context.makeImage()!, nil)
CGImageDestinationFinalize(destination)
