/** Parses a valueless crop flag or a normalized alpha threshold. */
export const parseCrop = (value: string): boolean | number => {
	if (!value || value === 'true') {
		return true;
	}

	if (value === 'false') {
		return false;
	}

	const threshold = Number(value);
	if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
		throw new RangeError('Crop threshold must be between 0 and 1');
	}

	return threshold;
};
