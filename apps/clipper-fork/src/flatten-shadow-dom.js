(function () {
	document.querySelectorAll("*").forEach(function (el) {
		if (el.shadowRoot && el.shadowRoot.innerHTML) {
			el.setAttribute("data-defuddle-shadow", el.shadowRoot.innerHTML);
		}
	});
})();
