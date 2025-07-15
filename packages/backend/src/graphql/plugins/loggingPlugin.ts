import { ApolloServerPlugin } from '@apollo/server';
import { Context } from '../context';
import logger from '../../utils/logger';

export function loggingPlugin(): ApolloServerPlugin<Context> {
  return {
    async requestDidStart() {
      const start = Date.now();

      return {
        async willSendResponse(requestContext) {
          const duration = Date.now() - start;
          const { request, response, contextValue, errors } = requestContext;

          // Extract operation info
          const operationType = request.query?.trim().startsWith('mutation') ? 'mutation' : 'query';
          const operationName = request.operationName || 'anonymous';

          // Log based on outcome
          if (errors && errors.length > 0) {
            logger.error('GraphQL Error', {
              operationType,
              operationName,
              duration,
              userId: contextValue.user?.id,
              errors: errors.map((e) => ({
                message: e.message,
                code: e.extensions?.code,
                path: e.path,
              })),
            });
          } else {
            logger.info('GraphQL Request', {
              operationType,
              operationName,
              duration,
              userId: contextValue.user?.id,
              variables: request.variables,
            });
          }
        },

        async didEncounterErrors(requestContext) {
          const { errors, contextValue, request } = requestContext;

          // Log validation errors separately
          const validationErrors = errors.filter(
            (e) => e.extensions?.code === 'GRAPHQL_VALIDATION_FAILED'
          );

          if (validationErrors.length > 0) {
            logger.warn('GraphQL Validation Error', {
              operationName: request.operationName,
              userId: contextValue.user?.id,
              errors: validationErrors.map((e) => e.message),
            });
          }
        },
      };
    },
  };
}
