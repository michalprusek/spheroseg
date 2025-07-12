import { mapSchema, getDirective, MapperKind } from '@graphql-tools/utils';
import { GraphQLSchema, GraphQLFieldConfig, GraphQLError } from 'graphql';
import { Context } from '../context';

export function authDirective(schema: GraphQLSchema): GraphQLSchema {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (fieldConfig: GraphQLFieldConfig<any, any>) => {
      const authDirective = getDirective(schema, fieldConfig, 'auth')?.[0];
      const requiresApprovalDirective = getDirective(schema, fieldConfig, 'requiresApproval')?.[0];
      const requiresAdminDirective = getDirective(schema, fieldConfig, 'requiresAdmin')?.[0];

      if (authDirective || requiresApprovalDirective || requiresAdminDirective) {
        const { resolve = () => null } = fieldConfig;

        fieldConfig.resolve = async function (source, args, context: Context, info) {
          // Check authentication
          if (!context.user) {
            throw new GraphQLError('You must be logged in to access this resource', {
              extensions: {
                code: 'UNAUTHENTICATED',
                http: { status: 401 }
              }
            });
          }

          // Check account approval
          if (requiresApprovalDirective && !context.user.isApproved) {
            throw new GraphQLError('Your account is pending approval', {
              extensions: {
                code: 'FORBIDDEN',
                http: { status: 403 }
              }
            });
          }

          // Check admin role
          if (requiresAdminDirective && !context.user.isAdmin) {
            throw new GraphQLError('You must be an admin to access this resource', {
              extensions: {
                code: 'FORBIDDEN',
                http: { status: 403 }
              }
            });
          }

          // Call original resolver
          return resolve(source, args, context, info);
        };
      }

      return fieldConfig;
    },
  });
}