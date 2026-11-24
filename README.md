# mockup-canvas

Zero-dependency, framework-agnostic multi-page infinite canvas for rendering real-component design mockups.

## Usage

```ts
import { mountMockupCanvas } from 'mockup-canvas'
import 'mockup-canvas/styles.css'

mountMockupCanvas(document.getElementById('root')!, {
  pages: [
    {
      id: 'checkout',
      title: 'Checkout flow',
      groups: [
        {
          title: 'Order summary',
          items: [
            { id: 'A.1', title: 'Default', width: 960, height: 600, src: '?state=order-default' },
            { id: 'A.2', title: 'Mobile', width: 390, height: 680, src: '?state=order-mobile' },
          ],
        },
      ],
    },
  ],
})
```

Deep-link to any mockup with `?page=checkout&mockup=A.2` (or `?mockup=A.2`): opens the page and pans — without changing zoom — to the target mockup.

## Development & QA

```bash
pnpm install
pnpm dev     # local QA playground at http://127.0.0.1:4173
pnpm check   # typecheck + unit/DOM tests + build
```
