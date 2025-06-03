export interface IVpcConfig {
  vpcId: string;
  subnetIds?: string[];
  securityGroupIds?: string[];
}