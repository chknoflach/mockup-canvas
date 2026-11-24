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
              { id: 'A.2', title: 'Mobile', width: 390, height: 640, src: '?state=order-mobile', changed: true },
            ],
          },
          {
            title: 'Payment states',
            items: [
              { id: 'B.1', title: 'Card form', width: 520, height: 500, src: '?state=card-form' },
              { id: 'B.2', title: 'Failed notice', width: 520, height: 420, src: '?state=failed-notice', changed: true },
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
              { id: 'C.1', title: 'Admin list', width: 860, height: 520, src: '?state=admin-list', changed: true },
              { id: 'C.2', title: 'First login', width: 420, height: 460, src: '?state=first-login' },
            ],
          },
        ],
      },
      {
        id: 'invoice-drawer',
        title: 'Invoice drawer',
        groups: [
          {
            title: 'Loading & retry',
            items: [
              { id: 'D.1', title: 'Summary', width: 900, height: 560, src: '?state=order-default' },
              { id: 'D.2', title: 'Failure', width: 520, height: 420, src: '?state=failed-notice' },
            ],
          },
        ],
      },
      {
        id: 'mobile-checkout',
        title: 'Mobile checkout',
        groups: [
          {
            title: 'Phone viewport',
            items: [
              { id: 'E.1', title: 'Order', width: 390, height: 640, src: '?state=order-mobile' },
              { id: 'E.2', title: 'Verify', width: 390, height: 460, src: '?state=first-login' },
            ],
          },
        ],
      },
    ],
  })
}
