declare module "@/payload" {
  type CampaignResult = {
    docs: unknown[];
    hasNextPage: boolean;
  };

  type Payload = {
    find(options: {
      collection: "campaigns";
      depth: number;
      limit: number;
      overrideAccess: boolean;
      page: number;
      sort: "id";
    }): Promise<CampaignResult>;
  };

  export function getPayloadInstance(): Promise<Payload>;
}
