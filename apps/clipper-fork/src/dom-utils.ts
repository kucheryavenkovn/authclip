export function getElementXPath(element: Node): string {
	if (element.nodeType === Node.DOCUMENT_NODE) return '';
	if (element.nodeType !== Node.ELEMENT_NODE) {
		return getElementXPath(element.parentNode!);
	}

	let ix = 0;
	const siblings = element.parentNode?.childNodes || [];
	for (let i = 0; i < siblings.length; i++) {
		const sibling = siblings[i];
		if (sibling === element) {
			return (
				getElementXPath(element.parentNode!) +
				'/' +
				(element as Element).tagName.toLowerCase() +
				'[' +
				(ix + 1) +
				']'
			);
		}
		if (
			sibling.nodeType === Node.ELEMENT_NODE &&
			(sibling as Element).tagName === (element as Element).tagName
		) {
			ix++;
		}
	}
	return '';
}

export function getElementByXPath(xpath: string): Element | null {
	return document.evaluate(
		xpath,
		document,
		null,
		XPathResult.FIRST_ORDERED_NODE_TYPE,
		null
	).singleNodeValue as Element | null;
}

export function isDarkColor(color: string): boolean {
	const rgb = color.match(/\d+/g);
	if (!rgb || rgb.length < 3) return false;
	const brightness =
		(parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
	return brightness < 128;
}
