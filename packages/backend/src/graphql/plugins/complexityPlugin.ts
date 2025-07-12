import { ApolloServerPlugin } from '@apollo/server';
import { GraphQLError } from 'graphql';
import { 
  simpleEstimator, 
  fieldExtensionsEstimator, 
  getComplexity 
} from 'graphql-query-complexity';
import { Context } from '../context';

interface ComplexityPluginOptions {
  maxComplexity: number;
}

export function complexityPlugin(options: ComplexityPluginOptions): ApolloServerPlugin<Context> {
  return {
    async requestDidStart() {
      return {
        async didResolveOperation({ request, document, schema }) {
          const complexity = getComplexity({
            schema,
            operationName: request.operationName,
            query: document,
            variables: request.variables || {},
            estimators: [
              fieldExtensionsEstimator(),
              simpleEstimator({ defaultComplexity: 1 }),
            ],
          });

          if (complexity > options.maxComplexity) {
            throw new GraphQLError(
              `Query is too complex: ${complexity}. Maximum allowed complexity: ${options.maxComplexity}`,
              {
                extensions: {
                  code: 'QUERY_TOO_COMPLEX',
                  complexity,
                  maxComplexity: options.maxComplexity,
                },
              }
            );
          }
        },
      };
    },
  };
}