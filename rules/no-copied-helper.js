import { relative } from 'node:path';
import { definitionsOf, otherDefinitions } from '../lib/files.js';

export default {
    meta: {
        type: 'problem',
        docs: { description: 'Disallow a helper or string constant with the same body as one in another spec file' },
        messages: {
            copied: '{{name}} has the same body as {{other}} in {{file}}. A change that reaches one copy misses the other. '
                + 'Move one copy to a support module, and import it in both specs.',
        },
        schema: [],
    },
    create(context) {
        return {
            'Program:exit'() {
                const mine = definitionsOf(context.sourceCode.ast);
                if (!mine.length) return;
                const others = otherDefinitions(context);
                for (const { name, key, id } of mine) {
                    const copy = others.find(other => other.key === key);
                    if (copy) context.report({ node: id, messageId: 'copied', data: { name, other: copy.name, file: relative(context.cwd, copy.path).replace(/\\/g, '/') } });
                }
            },
        };
    },
};
