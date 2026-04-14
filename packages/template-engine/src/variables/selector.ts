import { applyFilters } from '../filters';
import { selectorContentToString } from '../shared';
import { setMessageSender, SendMessageFn } from '../resolver';

let _sendToTab: SendMessageFn | null = null;

export function setSelectorSender(fn: SendMessageFn): void {
	_sendToTab = fn;
	setMessageSender(fn);
}

export async function sendExtractContent(tabId: number, selector: string, attribute: string | undefined, extractHtml: boolean): Promise<{ content: string | string[] } | undefined> {
	if (!_sendToTab) {
		console.error('No message sender configured for selector resolution');
		return undefined;
	}
	const response = await _sendToTab(tabId, {
		action: "extractContent",
		selector,
		attribute,
		extractHtml,
	}) as { content: string | string[] };
	return response || undefined;
}

export async function resolveSelector(tabId: number, selectorExpr: string): Promise<any> {
	const selectorRegex = /^(selector|selectorHtml):(.*?)(?:\?(.*))?$/;
	const matches = selectorExpr.match(selectorRegex);
	if (!matches) {
		console.error('Invalid selector format:', selectorExpr);
		return undefined;
	}

	const [, selectorType, rawSelector, attribute] = matches;
	const extractHtml = selectorType === 'selectorHtml';
	const selector = rawSelector.replace(/\\"/g, '"').replace(/\s+/g, ' ').trim();

	try {
		const response = await sendExtractContent(tabId, selector, attribute, extractHtml);
		return response ? response.content : undefined;
	} catch (error) {
		console.error('Error extracting content by selector:', error, { selector, attribute, extractHtml });
		return undefined;
	}
}

export async function processSelector(tabId: number, match: string, currentUrl: string): Promise<string> {
	const selectorRegex = /{{(selector|selectorHtml):(.*?)(?:\?(.*?))?(?:\|(.*?))?}}/;
	const matches = match.match(selectorRegex);
	if (!matches) {
		console.error('Invalid selector format:', match);
		return match;
	}

	const [, selectorType, rawSelector, attribute, filtersString] = matches;
	const extractHtml = selectorType === 'selectorHtml';
	const selector = rawSelector.replace(/\\"/g, '"').replace(/\s+/g, ' ').trim();

	try {
		const response = await sendExtractContent(tabId, selector, attribute, extractHtml);
		let content = response ? response.content : '';
		const contentString = selectorContentToString(content);
		const filteredContent = applyFilters(contentString, filtersString, currentUrl);
		return filteredContent;
	} catch (error) {
		console.error('Error extracting content by selector:', error, { selector, attribute, extractHtml });
		return '';
	}
}
