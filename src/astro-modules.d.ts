declare module "*.astro" {
  const Component: (props: Record<string, unknown>) => unknown;
  export default Component;
}

declare module "*.svg" {
  const Component: (props: Record<string, unknown>) => unknown;
  export default Component;
}
