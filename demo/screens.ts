/** Interactive sample screens rendered inside ?state=<id> iframes for canvas QA. */

const BASE_CSS = `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
    background: #ffffff;
    color: #18181b;
    font-size: 14px;
    line-height: 1.45;
  }
  .screen { padding: 28px; display: flex; flex-direction: column; gap: 20px; }
  h1 { margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -0.02em; }
  p { margin: 0; color: #52525b; }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .card { border: 1px solid #e4e4e7; border-radius: 8px; padding: 16px; background: #fafafa; }
  .scroll-list {
    max-height: 220px;
    overflow-y: auto;
    border: 1px solid #e4e4e7;
    border-radius: 8px;
  }
  .list-item {
    display: flex;
    justify-content: space-between;
    padding: 12px 14px;
    border-bottom: 1px solid #f0f0f2;
    transition: background 120ms;
  }
  .list-item:last-child { border-bottom: none; }
  .list-item:hover { background: #f4f4f5; }
  .btn {
    appearance: none;
    border: 1px solid #18181b;
    background: #18181b;
    color: #ffffff;
    font: inherit;
    font-weight: 500;
    padding: 9px 14px;
    border-radius: 6px;
    cursor: pointer;
  }
  .btn:hover { background: #27272a; }
  .btn-ghost {
    background: #ffffff;
    color: #18181b;
    border-color: #d4d4d8;
  }
  .btn-ghost:hover { background: #f4f4f5; }
  input[type="text"], input[type="email"] {
    width: 100%;
    padding: 9px 12px;
    border: 1px solid #d4d4d8;
    border-radius: 6px;
    font: inherit;
  }
  label { display: flex; flex-direction: column; gap: 6px; font-weight: 500; font-size: 13px; }
  .num { font-variant-numeric: tabular-nums; }
`

function mountStyle(): void {
  const style = document.createElement('style')
  style.textContent = BASE_CSS
  document.head.appendChild(style)
}

export function renderSampleScreen(root: HTMLElement, state: string): void {
  mountStyle()

  if (state === 'order-default' || state === 'order-mobile') {
    const mobile = state === 'order-mobile'
    let seats = 2
    const price = 1490

    const items = Array.from({ length: 10 }, (_, idx) => ({
      name: `Module ${idx + 1} · Leadership Workshop`,
      date: `2026-12-${String(idx + 2).padStart(2, '0')}`,
    }))

    root.innerHTML = `
      <div class="screen" style="padding: ${mobile ? '20px' : '28px'};">
        <div class="row">
          <div>
            <h1>AI Circle · Order summary</h1>
            <p>Scroll the schedule list or change seats to verify Static vs Active.</p>
          </div>
        </div>
        <div class="card row">
          <div>
            <strong>Seats</strong>
            <div style="color:#52525b;font-size:13px;">€1,490 per seat</div>
          </div>
          <div class="row" style="gap:8px;">
            <button class="btn btn-ghost" data-dec>−</button>
            <strong class="num" data-seats style="min-width:24px;text-align:center;">${seats}</strong>
            <button class="btn btn-ghost" data-inc>+</button>
          </div>
        </div>
        <div class="scroll-list" data-scroll-list>
          ${items
            .map(
              (it) =>
                `<div class="list-item"><span>${it.name}</span><span class="num" style="color:#71717a;">${it.date}</span></div>`,
            )
            .join('')}
        </div>
        <div class="row">
          <strong class="num" data-total>Total: €${(seats * price).toLocaleString('en-US')}</strong>
          <button class="btn" data-submit>Continue to payment</button>
        </div>
      </div>
    `

    const seatsEl = root.querySelector('[data-seats]')!
    const totalEl = root.querySelector('[data-total]')!
    const submitBtn = root.querySelector('[data-submit]') as HTMLButtonElement
    const update = () => {
      seatsEl.textContent = String(seats)
      totalEl.textContent = `Total: €${(seats * price).toLocaleString('en-US')}`
    }
    root.querySelector('[data-dec]')?.addEventListener('click', () => {
      seats = Math.max(1, seats - 1)
      update()
    })
    root.querySelector('[data-inc]')?.addEventListener('click', () => {
      seats += 1
      update()
    })
    submitBtn.addEventListener('click', () => {
      submitBtn.textContent = 'Clicked ✓'
    })
    return
  }

  if (state === 'card-form') {
    root.innerHTML = `
      <div class="screen">
        <h1>Payment details</h1>
        <label>
          Cardholder name
          <input type="text" value="Mirjam Walenta" />
        </label>
        <label>
          Billing email
          <input type="email" value="mirjam@example.com" />
        </label>
        <label>
          Payment method
          <div style="display:flex;gap:12px;margin-top:4px;">
            <label style="flex-direction:row;align-items:center;font-weight:400;">
              <input type="radio" name="pm" checked /> Card
            </label>
            <label style="flex-direction:row;align-items:center;font-weight:400;">
              <input type="radio" name="pm" /> SEPA
            </label>
            <label style="flex-direction:row;align-items:center;font-weight:400;">
              <input type="radio" name="pm" /> PayPal
            </label>
          </div>
        </label>
        <div>
          <button class="btn" data-pay>Confirm order</button>
        </div>
      </div>
    `
    const payBtn = root.querySelector('[data-pay]') as HTMLButtonElement
    payBtn.addEventListener('click', () => {
      payBtn.textContent = 'Submitted ✓'
    })
    return
  }

  if (state === 'failed-notice') {
    root.innerHTML = `
      <div class="screen">
        <h1>Order not placed</h1>
        <p>Your bank declined the 3-D Secure confirmation. No order was placed and no money was charged.</p>
        <div class="card">
          <strong>Need a hand?</strong>
          <p style="margin-top:4px;">We are happy to help directly — call +43 1 555 0142 or reply to your offer email.</p>
        </div>
        <div class="row" style="justify-content:flex-start;">
          <button class="btn" data-retry>Try another card</button>
        </div>
      </div>
    `
    const retryBtn = root.querySelector('[data-retry]') as HTMLButtonElement
    retryBtn.addEventListener('click', () => {
      retryBtn.textContent = 'Retrying…'
    })
    return
  }

  if (state === 'admin-list') {
    const people = [
      ['Anna Berger', 'Active', '2026-11-20'],
      ['Lukas Hofer', 'Window open (12m)', '2026-11-24'],
      ['Mirjam Walenta', 'Not enrolled', '—'],
      ['Stefan Gruber', 'Active', '2026-11-18'],
      ['Julia Moser', 'Active', '2026-11-12'],
      ['David Pichler', 'Not enrolled', '—'],
      ['Katrin Bauer', 'Active', '2026-11-04'],
      ['Thomas Leitner', 'Active', '2026-10-29'],
    ]
    root.innerHTML = `
      <div class="screen">
        <div class="row">
          <div>
            <h1>Staff passkeys</h1>
            <p>Open a 15-minute enrollment window for new team members.</p>
          </div>
          <button class="btn" data-open-window>Open window</button>
        </div>
        <div class="scroll-list">
          ${people
            .map(
              ([name, status, date]) =>
                `<div class="list-item"><strong>${name}</strong><span>${status}</span><span class="num" style="color:#71717a;">${date}</span></div>`,
            )
            .join('')}
        </div>
      </div>
    `
    const btn = root.querySelector('[data-open-window]') as HTMLButtonElement
    btn.addEventListener('click', () => {
      btn.textContent = 'Window open (15m)'
    })
    return
  }

  root.innerHTML = `
    <div class="screen">
      <h1>Confirm with passkey</h1>
      <p>Use Touch ID or your hardware security key to finish signing in.</p>
      <div>
        <button class="btn" data-verify>Use Touch ID</button>
      </div>
    </div>
  `
  const verifyBtn = root.querySelector('[data-verify]') as HTMLButtonElement
  verifyBtn.addEventListener('click', () => {
    verifyBtn.textContent = 'Verified ✓'
  })
}
