import { GraphQLFormattedError, GraphQLError } from 'graphql';
import { unwrapResolverError } from '@apollo/server/errors';
import logger from '../../utils/logger';

export function formatError(
  formattedError: GraphQLFormattedError,
  error: unknown
): GraphQLFormattedError {
  // Unwrap the error to get the original error
  const originalError = unwrapResolverError(error);

  // Log internal server errors
  if (originalError instanceof Error && !originalError.extensions?.code) {
    logger.error('Unhandled GraphQL error', {
      message: originalError.message,
      stack: originalError.stack,
    });
  }

  // In production, hide sensitive error details
  if (process.env.NODE_ENV === 'production') {
    // Known error codes that are safe to expose
    const safeErrorCodes = [
      'UNAUTHENTICATED',
      'FORBIDDEN',
      'BAD_USER_INPUT',
      'RATE_LIMITED',
      'QUERY_TOO_COMPLEX',
      'GRAPHQL_VALIDATION_FAILED',
      'GRAPHQL_PARSE_FAILED',
    ];

    const errorCode = formattedError.extensions?.code as string;

    // If it's not a safe error code, return a generic error
    if (!safeErrorCodes.includes(errorCode)) {
      return {
        message: 'Internal server error',
        extensions: {
          code: 'INTERNAL_SERVER_ERROR',
        },
      };
    }
  }

  // Return the formatted error as-is for known errors or in development
  return formattedError;
}