import { describe } from 'manten';

describe('unbg', () => {
	// Manten keeps the parent describe context across dynamic imports; no `await`
	// here means independent specs can run concurrently.
	import('./specs/difference-matting.ts');
	import('./specs/crop-transparent.ts');
	import('./specs/unbg.ts');
	import('./specs/output-path.ts');
	import('./specs/cli.ts');
	import('../web/tests/specs/web-matting.ts');
});
