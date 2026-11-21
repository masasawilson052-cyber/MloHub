// Empty stub for demo adapters in production builds
const createNoopProxy = () =>
  new Proxy(function () {}, {
    get: () => createNoopProxy(),
    apply: () => Promise.resolve(null),
    construct: () => createNoopProxy(),
  });

const stub = createNoopProxy();

module.exports = {
  DemoAuthAdapter: stub,
  DemoDiscoveryAdapter: stub,
  DemoOrderPipelineAdapter: stub,
  default: stub,
};
