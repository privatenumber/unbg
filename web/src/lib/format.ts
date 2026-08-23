import type { Rgb } from './core.ts';

export const formatBytes = (bytes: number): string => {
	const units = ['B', 'KB', 'MB', 'GB'];
	let value = bytes;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit += 1;
	}

	return `${unit === 0 ? value : value.toFixed(1)} ${units[unit]}`;
};

const toHexByte = (value: number) => value.toString(16).padStart(2, '0');

export const rgbToHex = ({ r, g, b }: Rgb): string => `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;

export const rgbToCss = ({ r, g, b }: Rgb): string => `rgb(${r} ${g} ${b})`;

export const hexToRgb = (hex: string): Rgb => {
	const value = hex.replace(/^#/, '');
	return {
		r: Number.parseInt(value.slice(0, 2), 16),
		g: Number.parseInt(value.slice(2, 4), 16),
		b: Number.parseInt(value.slice(4, 6), 16),
	};
};
