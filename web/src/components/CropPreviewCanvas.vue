<script setup lang="ts">
import {
	computed, onBeforeUnmount, onMounted, ref, watch,
} from 'vue';
import type { ContentBounds } from '../lib/core.ts';
import { getCropBounds } from '../lib/manual-crop-bounds.ts';
import type { CropMetadata, CropValue } from '../lib/matting-protocol.ts';

const croppedColor = [59, 130, 246] as const;
const contourColor = '#ef4444';
const contourSize = 2;
const previewHeightRem = 24;
const diagnosticAlpha = 192;

type CanvasLayer = {
	canvas: HTMLCanvasElement;
	context: CanvasRenderingContext2D;
};

const props = defineProps<{
	sourceUrl: string;
	sourceWidth: number;
	sourceHeight: number;
	crop: CropValue;
	metadata: CropMetadata;
	visible: boolean;
}>();

const container = ref<HTMLDivElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const previewStyle = computed(() => ({
	aspectRatio: `${props.sourceWidth} / ${props.sourceHeight}`,
	width: `min(100%, ${(props.sourceWidth / props.sourceHeight) * previewHeightRem}rem)`,
}));

let sourceImage: HTMLImageElement | undefined;
let blueLayer: CanvasLayer | undefined;
let resizeObserver: ResizeObserver | undefined;
let sourceRevision = 0;
let sourceLoaded = false;
let renderFrame: number | undefined;
let sourceLoadListener: (() => void) | undefined;

const createCanvasLayer = (width: number, height: number): CanvasLayer => {
	const layerCanvas = document.createElement('canvas');
	layerCanvas.width = width;
	layerCanvas.height = height;
	const context = layerCanvas.getContext('2d');
	if (!context) {
		throw new Error('Could not acquire a 2D canvas context');
	}

	return {
		canvas: layerCanvas,
		context,
	};
};

const createBlueLayer = (
	image: HTMLImageElement,
	width: number,
	height: number,
) => {
	const layer = createCanvasLayer(width, height);
	layer.context.drawImage(image, 0, 0, width, height);
	const imageData = layer.context.getImageData(0, 0, width, height);
	for (let offset = 0; offset < imageData.data.length; offset += 4) {
		const alpha = imageData.data[offset + 3];
		if (alpha === 0) {
			continue;
		}

		imageData.data[offset] = croppedColor[0];
		imageData.data[offset + 1] = croppedColor[1];
		imageData.data[offset + 2] = croppedColor[2];
		imageData.data[offset + 3] = Math.max(alpha, diagnosticAlpha);
	}
	layer.context.putImageData(imageData, 0, 0);
	return layer;
};

const resizeLayers = () => {
	const outputCanvas = canvas.value;
	const outputContainer = container.value;
	if (!outputCanvas) {
		return;
	}
	if (!outputContainer) {
		return;
	}
	if (!sourceImage || !sourceLoaded) {
		return;
	}

	const { width, height } = outputContainer.getBoundingClientRect();
	if (width === 0) {
		return;
	}
	if (height === 0) {
		return;
	}

	const pixelRatio = globalThis.devicePixelRatio;
	const outputWidth = Math.max(1, Math.round(width * pixelRatio));
	const outputHeight = Math.max(1, Math.round(height * pixelRatio));
	const hasSameSize = outputCanvas.width === outputWidth && outputCanvas.height === outputHeight;
	if (!hasSameSize) {
		outputCanvas.width = outputWidth;
		outputCanvas.height = outputHeight;
		blueLayer = undefined;
	}

	if (!blueLayer) {
		blueLayer = createBlueLayer(sourceImage, outputWidth, outputHeight);
	}
};

const clipInside = (
	context: CanvasRenderingContext2D,
	metadata: CropMetadata,
	bounds: ContentBounds,
	outputCanvas: HTMLCanvasElement,
) => {
	const { width, height } = outputCanvas;
	context.beginPath();
	context.rect(
		(bounds.x / metadata.width) * width,
		(bounds.y / metadata.height) * height,
		(bounds.width / metadata.width) * width,
		(bounds.height / metadata.height) * height,
	);
	context.clip();
};

const clipOutside = (
	context: CanvasRenderingContext2D,
	metadata: CropMetadata,
	bounds: ContentBounds,
	outputCanvas: HTMLCanvasElement,
) => {
	const { width, height } = outputCanvas;
	context.beginPath();
	context.rect(0, 0, width, height);
	context.rect(
		(bounds.x / metadata.width) * width,
		(bounds.y / metadata.height) * height,
		(bounds.width / metadata.width) * width,
		(bounds.height / metadata.height) * height,
	);
	context.clip('evenodd');
};

const drawBlueExclusions = (
	context: CanvasRenderingContext2D,
	layer: CanvasLayer,
	metadata: CropMetadata,
	bounds: ContentBounds | null,
	outputCanvas: HTMLCanvasElement,
) => {
	context.save();
	if (bounds) {
		clipOutside(context, metadata, bounds, outputCanvas);
	}
	context.drawImage(layer.canvas, 0, 0);
	context.restore();
};

const drawRetainedContent = (
	context: CanvasRenderingContext2D,
	image: HTMLImageElement,
	metadata: CropMetadata,
	bounds: ContentBounds | null,
	outputCanvas: HTMLCanvasElement,
) => {
	if (!bounds) {
		return;
	}

	context.save();
	clipInside(context, metadata, bounds, outputCanvas);
	context.drawImage(image, 0, 0, outputCanvas.width, outputCanvas.height);
	context.restore();
};

const drawCropContour = (
	context: CanvasRenderingContext2D,
	metadata: CropMetadata,
	bounds: ContentBounds,
	outputCanvas: HTMLCanvasElement,
) => {
	const pixelRatio = globalThis.devicePixelRatio || 1;
	context.save();
	context.strokeStyle = contourColor;
	context.globalAlpha = diagnosticAlpha / 255;
	context.lineWidth = Math.max(1, Math.round(contourSize * pixelRatio));
	context.strokeRect(
		(bounds.x / metadata.width) * outputCanvas.width,
		(bounds.y / metadata.height) * outputCanvas.height,
		(bounds.width / metadata.width) * outputCanvas.width,
		(bounds.height / metadata.height) * outputCanvas.height,
	);
	context.restore();
};

const render = () => {
	const outputCanvas = canvas.value;
	const image = sourceImage;
	const outputContext = outputCanvas?.getContext('2d');
	if (!outputCanvas || !image || !outputContext || !blueLayer) {
		return;
	}

	const outputWidth = outputCanvas.width;
	const outputHeight = outputCanvas.height;
	outputContext.clearRect(0, 0, outputWidth, outputHeight);
	if (props.crop === false) {
		outputContext.drawImage(image, 0, 0, outputWidth, outputHeight);
		return;
	}

	const bounds = getCropBounds(props.metadata, props.crop) ?? null;
	drawBlueExclusions(outputContext, blueLayer, props.metadata, bounds, outputCanvas);
	drawRetainedContent(outputContext, image, props.metadata, bounds, outputCanvas);
	if (bounds) {
		drawCropContour(outputContext, props.metadata, bounds, outputCanvas);
	}
};

const clearPreview = () => {
	blueLayer = undefined;
	const outputCanvas = canvas.value;
	const context = outputCanvas?.getContext('2d');
	if (outputCanvas && context) {
		context.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
	}
};

const queueRender = () => {
	if (renderFrame !== undefined) {
		return;
	}

	renderFrame = requestAnimationFrame(() => {
		renderFrame = undefined;
		resizeLayers();
		render();
	});
};

const loadSource = () => {
	if (!sourceImage) {
		return;
	}

	if (sourceLoadListener) {
		sourceImage.removeEventListener('load', sourceLoadListener);
	}
	clearPreview();
	sourceLoaded = false;
	sourceRevision += 1;
	const currentRevision = sourceRevision;
	sourceLoadListener = () => {
		if (currentRevision !== sourceRevision || !sourceImage) {
			return;
		}

		sourceLoaded = true;
		queueRender();
	};
	sourceImage.addEventListener('load', sourceLoadListener, { once: true });
	sourceImage.src = props.sourceUrl;
};

watch(() => props.sourceUrl, loadSource);
watch(() => props.crop, queueRender);
watch(() => props.visible, (visible) => {
	if (visible) {
		queueRender();
	}
});

onMounted(() => {
	sourceImage = new Image();
	resizeObserver = new ResizeObserver(queueRender);
	if (container.value) {
		resizeObserver.observe(container.value);
	}
	loadSource();
});

onBeforeUnmount(() => {
	if (renderFrame !== undefined) {
		cancelAnimationFrame(renderFrame);
	}
	resizeObserver?.disconnect();
	if (sourceImage && sourceLoadListener) {
		sourceImage.removeEventListener('load', sourceLoadListener);
	}
});
</script>

<template>
	<div
		ref="container"
		class="relative max-h-[24rem] max-w-full"
		:style="previewStyle"
		:aria-hidden="!visible"
	>
		<canvas
			ref="canvas"
			class="block size-full"
			role="img"
			aria-label="Crop preview with removed pixels highlighted"
		/>
	</div>
</template>
