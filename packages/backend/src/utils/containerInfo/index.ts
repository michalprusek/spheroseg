// Re-export containerInfo utilities
export { getContainerLimits, getEffectiveMemoryLimit } from '../containerInfo';

// Add the missing export that tests are looking for
export { getContainerLimits as getContainerInfo } from '../containerInfo';