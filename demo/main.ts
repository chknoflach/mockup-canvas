import '../src/styles.css'
import { mountMockupCanvas } from '../src/index'
import { renderSampleScreen } from './screens'

const root = document.getElementById('root')!
const stateParam = new URLSearchParams(window.location.search).get('state')

if (stateParam) {
  renderSampleScreen(root, stateParam)
} else {
  mountMockupCanvas(root, {
    pages: [
      {
        id: 'checkout',
        title: 'Checkout flow',
        groups: [
          {
            title: 'Order summary',
            items: [
              { id: 'A.1', title: 'Default', width: 900, height: 560, src: '?state=order-default' },
              { id: 'A.2', title: 'Mobile', width: 390, height: 640, src: '?state=order-mobile' },
            ],
          },
          {
            title: 'Payment states',
            items: [
              { id: 'B.1', title: 'Card form', width: 520, height: 500, src: '?state=card-form' },
              { id: 'B.2', title: 'Failed notice', width: 520, height: 420, src: '?state=failed-notice' },
            ],
          },
        ],
      },
      {
        id: 'passkeys',
        title: 'Passkey setup',
        groups: [
          {
            title: 'Enrollment flow',
            items: [
              { id: 'C.1', title: 'Admin list', width: 860, height: 520, src: '?state=admin-list' },
              { id: 'C.2', title: 'First login', width: 420, height: 460, src: '?state=first-login' },
            ],
          },
        ],
      },
    ],
  })
}
