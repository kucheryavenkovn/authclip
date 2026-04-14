import {
	handleTextSelection,
	highlightElement,
	AnyHighlightData,
	highlights,
	isApplyingHighlights,
	sortHighlights,
	applyHighlights,
	saveHighlights,
	updateHighlights,
	updateHighlighterMenu,
} from './highlighter';
import { getElementByXPath, isDarkColor } from './dom-utils';

let hoverOverlay: HTMLElement | null = null;
let lastHoverTarget: Element | null = null;

const LINE_BY_LINE_OVERLAY_TAGS = ['P'];

function throttle<T extends (...args: any[]) => any>(func: T, limit: number): (...args: Parameters<T>) => void {
	let inThrottle: boolean;
	return function (this: any, ...args: Parameters<T>) {
		if (!inThrottle) {
			func.apply(this, args);
			inThrottle = true;
			setTimeout(() => (inThrottle = false), limit);
		}
	};
}

function isIgnoredElement(element: Element): boolean {
	const tagName = element.tagName.toUpperCase();
	const isDisallowedTag = ![
		'SPAN', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
		'MATH', 'FIGURE', 'UL', 'OL', 'TABLE', 'LI', 'TR', 'TD', 'TH', 'CODE', 'PRE', 'BLOCKQUOTE', 'EM', 'STRONG', 'A',
	].includes(tagName);

	return (
		element.tagName.toLowerCase() === 'html' ||
		element.tagName.toLowerCase() === 'body' ||
		element.classList.contains('obsidian-highlighter-menu') ||
		element.closest('.obsidian-highlighter-menu') !== null ||
		isDisallowedTag
	);
}

export function handleMouseMove(event: MouseEvent | TouchEvent) {
	let target: Element;
	if (event instanceof MouseEvent) {
		target = event.target as Element;
	} else {
		const touch = event.changedTouches[0];
		target = document.elementFromPoint(touch.clientX, touch.clientY) as Element;
	}

	if (!isIgnoredElement(target)) {
		createOrUpdateHoverOverlay(target);
	} else {
		removeHoverOverlay();
	}
}

export function handleMouseUp(event: MouseEvent | TouchEvent) {
	let target: Element;
	if (event instanceof MouseEvent) {
		target = event.target as Element;
	} else {
		const touch = event.changedTouches[0];
		target = document.elementFromPoint(touch.clientX, touch.clientY) as Element;
	}

	const selection = window.getSelection();
	if (selection && !selection.isCollapsed) {
		handleTextSelection(selection);
	} else {
		if (target.classList.contains('obsidian-highlight-overlay')) {
			handleHighlightClick(event);
		} else {
			let elementToProcess: Element | null = target;
			const targetTagName = target.tagName.toUpperCase();

			if (['TD', 'TH', 'TR'].includes(targetTagName)) {
				elementToProcess = target.closest('table');
				if (!elementToProcess) {
					return;
				}
			} else {
				if (isIgnoredElement(target)) {
					if (target.parentElement && !isIgnoredElement(target.parentElement)) {
						elementToProcess = target.parentElement;
					} else {
						return;
					}
				}
			}

			if (elementToProcess) {
				highlightElement(elementToProcess);
			}
		}
	}
}

export function updateHighlightListeners() {
	document.querySelectorAll('.obsidian-highlight-overlay').forEach((highlight) => {
		highlight.removeEventListener('click', handleHighlightClick);
		highlight.removeEventListener('touchend', handleHighlightClick);
		highlight.addEventListener('click', handleHighlightClick);
		highlight.addEventListener('touchend', handleHighlightClick);
	});
}

function findTextNodeAtOffset(element: Element, offset: number): { node: Node; offset: number } | null {
	let currentOffset = 0;
	const treeWalker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);

	let node: Node | null = treeWalker.currentNode;
	while (node) {
		const nodeLength = node.textContent?.length || 0;
		if (currentOffset + nodeLength >= offset) {
			const adjustedOffset = Math.min(Math.max(0, offset - currentOffset), nodeLength);
			return { node, offset: adjustedOffset };
		}
		currentOffset += nodeLength;
		node = treeWalker.nextNode();
	}

	const firstNode = document.createTreeWalker(element, NodeFilter.SHOW_TEXT).firstChild();
	if (firstNode) {
		return { node: firstNode, offset: 0 };
	}

	return null;
}

function calculateAverageLineHeight(rects: DOMRectList): number {
	const heights = Array.from(rects).map((rect) => rect.height);
	const sum = heights.reduce((a, b) => a + b, 0);
	return sum / heights.length;
}

function processRangeForOverlayRects(
	range: Range,
	content: string,
	existingOverlays: Element[],
	index: number,
	notes: string[] | undefined,
	targetElementForFallback: Element
) {
	const rects = range.getClientRects();

	if (rects.length === 0) {
		const rect = targetElementForFallback.getBoundingClientRect();
		mergeHighlightOverlayRects([rect], content, existingOverlays, false, index, notes);
		return;
	}

	const averageLineHeight = calculateAverageLineHeight(rects);
	const textRects = Array.from(rects).filter((rect) => rect.height <= averageLineHeight * 1.5);
	const complexRects = Array.from(rects).filter((rect) => rect.height > averageLineHeight * 1.5);

	if (textRects.length > 0) {
		mergeHighlightOverlayRects(textRects, content, existingOverlays, true, index, notes);
	}
	if (complexRects.length > 0) {
		mergeHighlightOverlayRects(complexRects, content, existingOverlays, false, index, notes);
	}
}

export function planHighlightOverlayRects(target: Element, highlight: AnyHighlightData, index: number) {
	const existingOverlays = Array.from(
		document.querySelectorAll(`.obsidian-highlight-overlay[data-highlight-index="${index}"]`)
	);
	const tagName = target.tagName.toUpperCase();

	if (highlight.type === 'complex' || highlight.type === 'element') {
		if (LINE_BY_LINE_OVERLAY_TAGS.includes(tagName)) {
			const range = document.createRange();
			try {
				range.selectNodeContents(target);
				processRangeForOverlayRects(range, highlight.content, existingOverlays, index, highlight.notes, target);
			} catch (error) {
				console.error('Error creating line-by-line highlight for element:', target, error);
				const rect = target.getBoundingClientRect();
				mergeHighlightOverlayRects([rect], highlight.content, existingOverlays, false, index, highlight.notes);
			} finally {
				range.detach();
			}
		} else {
			const rect = target.getBoundingClientRect();
			mergeHighlightOverlayRects([rect], highlight.content, existingOverlays, false, index, highlight.notes);
		}
	} else if (highlight.type === 'text') {
		const range = document.createRange();
		try {
			const startNodeResult = findTextNodeAtOffset(target, highlight.startOffset);
			const endNodeResult = findTextNodeAtOffset(target, highlight.endOffset);

			if (startNodeResult && endNodeResult) {
				try {
					try {
						range.setStart(startNodeResult.node, startNodeResult.offset);
					} catch {
						range.setStart(startNodeResult.node, 0);
					}

					try {
						range.setEnd(endNodeResult.node, endNodeResult.offset);
					} catch {
						range.setEnd(endNodeResult.node, endNodeResult.node.textContent?.length || 0);
					}

					processRangeForOverlayRects(range, highlight.content, existingOverlays, index, highlight.notes, target);
				} catch (error) {
					console.warn('Error setting range or processing rects for text highlight:', error);
					const rect = target.getBoundingClientRect();
					mergeHighlightOverlayRects([rect], highlight.content, existingOverlays, false, index, highlight.notes);
				}
			} else {
				console.warn('Could not find start/end node for text highlight, falling back to element bounds.');
				const rect = target.getBoundingClientRect();
				mergeHighlightOverlayRects([rect], highlight.content, existingOverlays, false, index, highlight.notes);
			}
		} catch (error) {
			console.error('Error creating text highlight:', error);
			const rect = target.getBoundingClientRect();
			mergeHighlightOverlayRects([rect], highlight.content, existingOverlays, false, index, highlight.notes);
		} finally {
			range.detach();
		}
	}
}

export function mergeHighlightOverlayRects(
	rects: DOMRect[],
	content: string,
	existingOverlays: Element[],
	isText: boolean = false,
	index: number,
	notes?: string[]
) {
	let mergedRects: DOMRect[] = [];
	let currentRect: DOMRect | null = null;

	for (let i = 0; i < rects.length; i++) {
		const rect = rects[i];
		if (!currentRect) {
			currentRect = new DOMRect(rect.x, rect.y, rect.width, rect.height);
		} else if (Math.abs(rect.y - currentRect.y) < 1 && Math.abs(rect.height - currentRect.height) < 1) {
			currentRect.width = rect.right - currentRect.left;
		} else {
			mergedRects.push(currentRect);
			currentRect = new DOMRect(rect.x, rect.y, rect.width, rect.height);
		}
	}
	if (currentRect) {
		mergedRects.push(currentRect);
	}

	for (const rect of mergedRects) {
		const isDuplicate = existingOverlays.some((overlay) => {
			const overlayRect = overlay.getBoundingClientRect();
			return (
				Math.abs(rect.left - overlayRect.left) < 1 &&
				Math.abs(rect.top - overlayRect.top) < 1 &&
				Math.abs(rect.width - overlayRect.width) < 1 &&
				Math.abs(rect.height - overlayRect.height) < 1
			);
		});

		if (!isDuplicate) {
			createHighlightOverlayElement(rect, content, isText, index, notes);
		}
	}
}

function createHighlightOverlayElement(
	rect: DOMRect,
	content: string,
	isText: boolean = false,
	index: number,
	notes?: string[]
) {
	const overlay = document.createElement('div');
	overlay.className = 'obsidian-highlight-overlay';
	overlay.dataset.highlightIndex = index.toString();

	overlay.style.position = 'absolute';

	overlay.style.left = `${rect.left + window.scrollX - 2}px`;
	overlay.style.top = `${rect.top + window.scrollY - 2}px`;
	overlay.style.width = `${rect.width + 4}px`;
	overlay.style.height = `${rect.height + 4}px`;

	overlay.setAttribute('data-content', content);
	if (notes && notes.length > 0) {
		overlay.setAttribute('data-notes', JSON.stringify(notes));
	}

	const elementAtPoint = document.elementFromPoint(rect.left, rect.top);
	if (elementAtPoint) {
		const bgColor = getEffectiveBackgroundColor(elementAtPoint as HTMLElement);
		if (isDarkColor(bgColor)) {
			overlay.classList.add('obsidian-highlight-overlay-dark');
		}
	}

	overlay.addEventListener('click', handleHighlightClick);
	overlay.addEventListener('touchend', handleHighlightClick);
	document.body.appendChild(overlay);
}

function getEffectiveBackgroundColor(element: HTMLElement): string {
	let currentElement: HTMLElement | null = element;
	while (currentElement) {
		const backgroundColor = window.getComputedStyle(currentElement).backgroundColor;
		if (backgroundColor !== 'rgba(0, 0, 0, 0)' && backgroundColor !== 'transparent') {
			return backgroundColor;
		}
		currentElement = currentElement.parentElement;
	}
	return 'rgb(255, 255, 255)';
}

function updateHighlightOverlayPositions() {
	highlights.forEach((highlight, index) => {
		const target = getElementByXPath(highlight.xpath);
		if (target) {
			const existingOverlays = document.querySelectorAll(
				`.obsidian-highlight-overlay[data-highlight-index="${index}"]`
			);
			if (existingOverlays.length > 0) {
				removeExistingHighlightOverlays(index);
			}
			planHighlightOverlayRects(target, highlight, index);
		}
	});
}

function removeExistingHighlightOverlays(index: number) {
	document
		.querySelectorAll(`.obsidian-highlight-overlay[data-highlight-index="${index}"]`)
		.forEach((el) => el.remove());
}

const throttledUpdateHighlights = throttle(() => {
	if (!isApplyingHighlights) {
		updateHighlightOverlayPositions();
	}
}, 100);

window.addEventListener('resize', throttledUpdateHighlights);
window.addEventListener('scroll', throttledUpdateHighlights);

const observer = new MutationObserver((mutations) => {
	if (!isApplyingHighlights) {
		const shouldUpdate = mutations.some(
			(mutation) =>
				(mutation.type === 'childList' &&
					mutation.target instanceof Element &&
					!mutation.target.id.startsWith('obsidian-highlight')) ||
				(mutation.type === 'attributes' &&
					(mutation.attributeName === 'style' || mutation.attributeName === 'class') &&
					mutation.target instanceof Element &&
					!mutation.target.id.startsWith('obsidian-highlight'))
		);
		if (shouldUpdate) {
			throttledUpdateHighlights();
		}
	}
});

observer.observe(document.body, {
	childList: true,
	subtree: true,
	attributes: true,
	attributeFilter: ['style', 'class'],
	characterData: false,
});

function createOrUpdateHoverOverlay(target: Element) {
	if (target === lastHoverTarget) return;
	lastHoverTarget = target;

	let elementForHoverRect: Element | null = target;
	const eventTargetTagName = target.tagName.toUpperCase();

	if (['TD', 'TH', 'TR'].includes(eventTargetTagName)) {
		elementForHoverRect = target.closest('table');
	}

	if (elementForHoverRect && !isIgnoredElement(elementForHoverRect)) {
		// valid element for hover rect
	} else if (
		target.parentElement &&
		!isIgnoredElement(target.parentElement) &&
		!['TD', 'TH', 'TR'].includes(eventTargetTagName)
	) {
		elementForHoverRect = target.parentElement;
	} else {
		removeHoverOverlay();
		return;
	}

	if (!elementForHoverRect) {
		removeHoverOverlay();
		return;
	}

	if (!hoverOverlay) {
		hoverOverlay = document.createElement('div');
		hoverOverlay.id = 'obsidian-highlight-hover-overlay';
		document.body.appendChild(hoverOverlay);
	}

	const rect = elementForHoverRect.getBoundingClientRect();

	hoverOverlay.style.position = 'absolute';
	hoverOverlay.style.left = `${rect.left + window.scrollX - 2}px`;
	hoverOverlay.style.top = `${rect.top + window.scrollY - 2}px`;
	hoverOverlay.style.width = `${rect.width + 4}px`;
	hoverOverlay.style.height = `${rect.height + 4}px`;
	hoverOverlay.style.display = 'block';

	document.querySelectorAll('.obsidian-highlight-overlay.is-hovering').forEach((el) => {
		el.classList.remove('is-hovering');
	});

	hoverOverlay.classList.remove('on-highlight');

	if (target.classList.contains('obsidian-highlight-overlay')) {
		const index = target.getAttribute('data-highlight-index');
		if (index) {
			document
				.querySelectorAll(`.obsidian-highlight-overlay[data-highlight-index="${index}"]`)
				.forEach((el) => {
					el.classList.add('is-hovering');
				});
			hoverOverlay.classList.add('on-highlight');
		}
	}
}

export function removeHoverOverlay() {
	if (hoverOverlay) {
		hoverOverlay.style.display = 'none';
	}
	lastHoverTarget = null;

	document.querySelectorAll('.obsidian-highlight-overlay.is-hovering').forEach((el) => {
		el.classList.remove('is-hovering');
	});
}

async function handleHighlightClick(event: Event) {
	event.stopPropagation();
	event.preventDefault();
	const overlay = event.currentTarget as HTMLElement;

	try {
		if (!overlay || !overlay.dataset) {
			return;
		}

		const index = overlay.dataset.highlightIndex;
		if (index === undefined) {
			console.warn('No highlight index found on clicked element');
			return;
		}

		const highlightIndex = parseInt(index);
		if (isNaN(highlightIndex) || highlightIndex < 0 || highlightIndex >= highlights.length) {
			console.warn(`Invalid highlight index: ${index}`);
			return;
		}

		const highlightToRemove = highlights[highlightIndex];
		const newHighlights = highlights.filter((h: AnyHighlightData) => h.id !== highlightToRemove.id);
		updateHighlights(newHighlights);
		removeExistingHighlightOverlays(highlightIndex);
		sortHighlights();
		applyHighlights();
		saveHighlights();
		updateHighlighterMenu();
	} catch (error) {
		console.error('Error handling highlight click:', error);
	}
}

export function removeExistingHighlights() {
	const existingHighlights = document.querySelectorAll('.obsidian-highlight-overlay');
	if (existingHighlights.length > 0) {
		existingHighlights.forEach((el) => el.remove());
	}
}
