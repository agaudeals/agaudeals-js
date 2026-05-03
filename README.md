# agaudeals-js

Monorepo for the [@agaudeals](https://www.npmjs.com/org/agaudeals) package family. Maintained by [AgAu Deals](https://agaudeals.com).

| Package                                          | Description                                                                       |
| ------------------------------------------------ | --------------------------------------------------------------------------------- |
| [`@agaudeals/spot-price`](./packages/spot-price) | USD spot prices for XAU/XAG/XPT/XPD with TTL cache, sanity bounds, and SWR.       |
| [`@agaudeals/premium-calc`](./packages/premium-calc) | Compute dealer premium/percent/per-gram-pure from spot, ask, weight, purity.   |

## Local development

```sh
npm install        # installs all workspaces
npm run lint
npm run typecheck
npm test
npm run build
```

Node 20 LTS minimum. CI runs on 20 + 22.

## Releasing

Tag `spot-price@v0.1.0` or `premium-calc@v0.1.0` from `main`. The `publish.yml` workflow builds, tests, and runs `npm publish --access public --provenance` for the matching package.

## License

MIT.
