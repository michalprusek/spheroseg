import { ApolloServerPlugin } from '@apollo/server';
import { Context } from '../context';
import { performanceMonitor } from '../../monitoring/performanceMonitor';

export function performancePlugin(): ApolloServerPlugin<Context> {
  return {
    async requestDidStart() {
      const requestStart = Date.now();

      return {
        async willSendResponse(requestContext) {
          const duration = Date.now() - requestStart;
          const { request, contextValue } = requestContext;
          
          // Track operation metrics
          const operationType = request.query?.trim().startsWith('mutation') ? 'mutation' : 'query';
          const operationName = request.operationName || 'anonymous';
          
          // Record metrics
          performanceMonitor.recordGraphQLOperation({
            operationType,
            operationName,
            duration,
            userId: contextValue.user?.id,
            complexity: requestContext.metrics?.complexity,
          });
          
          // Set response headers for client-side monitoring
          if (contextValue.res && !contextValue.res.headersSent) {
            contextValue.res.setHeader('X-GraphQL-Operation-Name', operationName);
            contextValue.res.setHeader('X-GraphQL-Operation-Type', operationType);
            contextValue.res.setHeader('X-GraphQL-Response-Time', duration.toString());
          }
        },

        async executionDidStart() {
          return {
            willResolveField({ info }) {
              const fieldStart = Date.now();
              
              return () => {
                const fieldDuration = Date.now() - fieldStart;
                
                // Only track slow field resolvers (> 100ms)
                if (fieldDuration > 100) {
                  performanceMonitor.recordSlowField({
                    typeName: info.parentType.name,
                    fieldName: info.fieldName,
                    duration: fieldDuration,
                  });
                }
              };
            },
          };
        },
      };
    },

    async serverWillStart() {
      console.log('GraphQL server starting...');
      
      return {
        async drainServer() {
          console.log('GraphQL server shutting down...');
          // Flush any pending metrics
          await performanceMonitor.flush();
        },
      };
    },
  };
}