/**
 * Custom ESLint rule to ensure all page components use lazy imports in App.tsx
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Ensure all page components are imported using React.lazy() in App.tsx',
      category: 'Best Practices',
      recommended: true,
    },
    fixable: 'code',
    schema: [],
    messages: {
      missingLazyImport: 'Page component "{{componentName}}" should be imported using React.lazy()',
      unusedLazyImport: 'Lazy import "{{componentName}}" is defined but not used in any route',
      missingRouteImport: 'Route uses component "{{componentName}}" but it is not imported',
    },
  },

  create(context) {
    // Only apply this rule to App.tsx
    const filename = context.getFilename();
    if (!filename.endsWith('App.tsx')) {
      return {};
    }

    const lazyImports = new Map();
    const usedComponents = new Set();
    const directPageImports = new Set();

    return {
      // Track lazy imports
      VariableDeclarator(node) {
        if (
          node.init &&
          node.init.type === 'CallExpression' &&
          node.init.callee.name === 'lazy'
        ) {
          const componentName = node.id.name;
          lazyImports.set(componentName, node);
        }
      },

      // Track direct imports of page components
      ImportDeclaration(node) {
        const source = node.source.value;
        if (source.includes('./pages/') || source.includes('./Pages/')) {
          node.specifiers.forEach(specifier => {
            if (specifier.type === 'ImportDefaultSpecifier') {
              directPageImports.add(specifier.local.name);
            }
          });
        }
      },

      // Track component usage in routes
      JSXOpeningElement(node) {
        if (node.name.name === 'Route') {
          const elementProp = node.attributes.find(
            attr => attr.name && attr.name.name === 'element'
          );
          
          if (elementProp && elementProp.value && elementProp.value.expression) {
            const expr = elementProp.value.expression;
            
            // Handle <Component /> syntax
            if (expr.type === 'JSXElement' && expr.openingElement.name.name) {
              usedComponents.add(expr.openingElement.name.name);
            }
            
            // Handle {<Component />} syntax
            if (expr.type === 'JSXFragment') {
              expr.children.forEach(child => {
                if (child.type === 'JSXElement' && child.openingElement.name.name) {
                  usedComponents.add(child.openingElement.name.name);
                }
              });
            }
          }
        }
      },

      'Program:exit'() {
        // Check for direct imports that should be lazy
        directPageImports.forEach(componentName => {
          context.report({
            node: context.getSourceCode().ast,
            messageId: 'missingLazyImport',
            data: { componentName },
          });
        });

        // Check for used components without imports
        usedComponents.forEach(componentName => {
          if (!lazyImports.has(componentName) && !directPageImports.has(componentName)) {
            // Skip built-in components
            if (!['ErrorBoundary', 'ProtectedRoute', 'Suspense'].includes(componentName)) {
              context.report({
                node: context.getSourceCode().ast,
                messageId: 'missingRouteImport',
                data: { componentName },
              });
            }
          }
        });

        // Check for unused lazy imports
        lazyImports.forEach((node, componentName) => {
          if (!usedComponents.has(componentName)) {
            context.report({
              node,
              messageId: 'unusedLazyImport',
              data: { componentName },
            });
          }
        });
      },
    };
  },
};