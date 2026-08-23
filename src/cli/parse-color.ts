import type { Rgb } from '../core/index.ts';

/**
 * Parses a CLI color string into an RGB object.
 * Accepts hex (`#rrggbb`, `#rgb`, with or without `#`) and `r,g,b`.
 */
export const parseColor = (value: string): Rgb => {
	const input = value.trim();
	const hex = input.replace(/^#/, '');

	if (/^[0-9a-f]{3}$/i.test(hex)) {
		return {
			r: Number.parseInt(hex[0] + hex[0], 16),
			g: Number.parseInt(hex[1] + hex[1], 16),
			b: Number.parseInt(hex[2] + hex[2], 16),
		};
	}

	if (/^[0-9a-f]{6}$/i.test(hex)) {
		return {
			r: Number.parseInt(hex.slice(0, 2), 16),
			g: Number.parseInt(hex.slice(2, 4), 16),
			b: Number.parseInt(hex.slice(4, 6), 16),
		};
	}

	const parts = input.split(',');
	if (parts.length === 3) {
		const [r, g, b] = parts.map(Number);
		if ([r, g, b].every(component => (
			Number.isFinite(component)
			&& component >= 0
			&& component <= 255
		))) {
			return {
				r,
				g,
				b,
			};
		}
	}

	throw new Error(`Invalid color "${value}". Use hex (#rrggbb) or "r,g,b".`);
};
