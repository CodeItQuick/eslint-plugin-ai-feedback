// Playwright reads that look at the page once and never retry.

export const READ_METHODS = new Set(['isVisible', 'isHidden', 'isEnabled', 'isDisabled', 'isChecked', 'isEditable', 'textContent', 'innerText',
    'innerHTML', 'inputValue', 'getAttribute', 'count', 'title', 'evaluate', 'allTextContents', 'boundingBox']);

/** For `await locator.isVisible()`, the method name. Otherwise null. */
export function oneTimeRead(node) {
    if (node?.type !== 'AwaitExpression' || node.argument.type !== 'CallExpression') return null;
    const { callee } = node.argument;
    return callee.type === 'MemberExpression' && READ_METHODS.has(callee.property.name) ? callee.property.name : null;
}
