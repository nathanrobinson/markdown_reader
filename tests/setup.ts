// jsdom does not implement scrollIntoView, which the reader calls when highlighting a word.
Element.prototype.scrollIntoView = function scrollIntoView(): void {};
