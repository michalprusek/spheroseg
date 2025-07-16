import { mergeTypeDefs, mergeResolvers } from '@graphql-tools/merge';

// Import type definitions
import commonTypeDefs from './common.graphql';
import userTypeDefs from './user.graphql';
import projectTypeDefs from './project.graphql';
import imageTypeDefs from './image.graphql';
import segmentationTypeDefs from './segmentation.graphql';

// Import resolvers
import userResolvers from '../resolvers/user.resolver';
import projectResolvers from '../resolvers/project.resolver';
import imageResolvers from '../resolvers/image.resolver';
import segmentationResolvers from '../resolvers/segmentation.resolver';
import scalarResolvers from '../resolvers/scalar.resolver';

// Merge all type definitions
const typeDefs = mergeTypeDefs([
  commonTypeDefs,
  userTypeDefs,
  projectTypeDefs,
  imageTypeDefs,
  segmentationTypeDefs,
]);

// Merge all resolvers
const resolvers = mergeResolvers([
  scalarResolvers,
  userResolvers,
  projectResolvers,
  imageResolvers,
  segmentationResolvers,
]);

// Create executable schema
export const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

export default schema;
