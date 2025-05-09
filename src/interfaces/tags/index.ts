/**
 * Interface for AWS resource tags
 */
export interface AwsResourceTags {
  [key: string]: string;
}

/**
 * Interface for stack and resource tags configuration
 */
export interface TagsConfig {
  /** Tags that will be applied to the stack itself */
  stackTags?: AwsResourceTags;
  /** Tags that will be applied to individual resources */
  resourceTags?: AwsResourceTags;
} 