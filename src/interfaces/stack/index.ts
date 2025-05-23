import { AwsResourceTags } from "../tags";

/**
 * Interface for stack operations
 */
export interface IStack {
  /**
   * Get the resource tags from the stack
   */
  getResourceTags(): AwsResourceTags;
} 