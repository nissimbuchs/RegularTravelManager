module.exports = {
  rules: {
    // Custom rule to enforce formatResponse usage
    'no-manual-api-responses': {
      create(context) {
        return {
          ReturnStatement(node) {
            // Check if this is in a handler file
            const filename = context.getFilename();
            if (!filename.includes('/handlers/') || filename.includes('/_templates/')) {
              return;
            }

            // Check if returning an object with statusCode and body
            if (
              node.argument &&
              node.argument.type === 'ObjectExpression' &&
              node.argument.properties.some(prop =>
                prop.key && prop.key.name === 'statusCode'
              ) &&
              node.argument.properties.some(prop =>
                prop.key && prop.key.name === 'body'
              )
            ) {
              context.report({
                node,
                message: 'Use formatResponse() instead of manually building API responses. Import from "../../middleware/response-formatter"',
                suggest: [{
                  desc: 'Use formatResponse() instead',
                  fix: () => {
                    // This would provide an auto-fix suggestion
                    return null; // Simplified for now
                  }
                }]
              });
            }
          },

          // Check for JSON.stringify in return statements
          CallExpression(node) {
            const filename = context.getFilename();
            if (!filename.includes('/handlers/') || filename.includes('/_templates/')) {
              return;
            }

            if (
              node.callee &&
              node.callee.object &&
              node.callee.object.name === 'JSON' &&
              node.callee.property &&
              node.callee.property.name === 'stringify'
            ) {
              // Check if this is inside a return statement
              let parent = node.parent;
              while (parent) {
                if (parent.type === 'ReturnStatement') {
                  context.report({
                    node,
                    message: 'Avoid JSON.stringify in handler returns. Use formatResponse() instead.',
                  });
                  break;
                }
                parent = parent.parent;
              }
            }
          }
        };
      },
    }
  }
};