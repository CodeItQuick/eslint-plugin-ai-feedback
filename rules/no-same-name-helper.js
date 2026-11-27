import nodePath from 'node:path';
import { definitionsOf, otherDefinitions } from '../lib/files.js';

export default {
    meta: {
        type: 'suggestion',
        docs: { description: 'Report a helper name that has a different body in another spec file' },
        messages: {
            drifted: '{{name}} has a different body in {{files}}. It can be a copy that already drifted. '
                + 'Read both. If they must change together, move one copy to a support module.',
        },
        schema: [],
    },
    create(context) {
        return {
            'Program:exit'() {
                const mine = definitionsOf(context.sourceCode.ast).filter(definition => definition.kind === 'function');
                if (mine.length === 0) return;
                const others = otherDefinitions(context).filter(definition => definition.kind === 'function');
                for (const { name, key, id } of mine) {
                    const drifted = others.filter(other => other.name === name && other.key !== key);
                    if (drifted.length === 0) continue;
                    const files = [...new Set(drifted.map(other => nodePath.relative(context.cwd, other.path).replaceAll('\\', '/')))].join(', ');
                    context.report({ node: id, messageId: 'drifted', data: { name, files } });
                }
            },
        };
    },
};
