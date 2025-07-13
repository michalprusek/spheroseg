import { GraphQLDateTime, GraphQLJSON, GraphQLJSONObject } from 'graphql-scalars';
import { GraphQLUpload } from 'graphql-upload';

const scalarResolvers = {
  DateTime: GraphQLDateTime,
  JSON: GraphQLJSON,
  JSONObject: GraphQLJSONObject,
  Upload: GraphQLUpload,
};

export default scalarResolvers;