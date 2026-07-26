declare module "react-jazzicon" {
  import type { ComponentType } from "react";
  const Jazzicon: ComponentType<{ diameter: number; seed: number }>;
  export function jsNumberForAddress(address: string): number;
  export default Jazzicon;
}
