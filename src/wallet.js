import { api } from './api.js';
import { getState, updateState } from './state.js';
import { $, render, toast, reward } from './ui.js';
import { haptic } from './telegram.js';

export function setupWallet() {
  const withdrawBtn = $('withdrawBtn');
  const proBtn      = $('proBtn');
  const methods     = document.querySelectorAll('.method');

  // 1. Withdrawal method selection
  if (methods.length > 0) {
    methods.forEach(m => {
      m.addEventListener('click', () => {
        haptic('light');
        methods.forEach(x => x.classList.remove('sel'));
        m.classList.add('sel');
        
        const S = getState();
        S._selectedMethod = {
          name: m.dataset.name,
          min: parseInt(m.dataset.min)
        };
        render();
      });
    });
  }

  // 2. Withdrawal action
  if (withdrawBtn) {
    withdrawBtn.addEventListener('click', async () => {
      const S = getState();
      const minRequired = S._selectedMethod?.min || 50000;
      if (S.balance < minRequired) {
        toast('Insufficient balance', `Minimum is ${minRequired} ORL`);
        return;
      }
      
      haptic('medium');
      try {
        const res = await api('/api/wallet/withdraw', { method: 'POST' });
        if (!res.success) {
          toast(res.message || 'Coming soon');
        }
      } catch (e) {
        // api() already toasted
      }
    });
  }



  // 5. Pro Upgrade action
  if (proBtn) {
    proBtn.addEventListener('click', async () => {
      const tg = window.Telegram?.WebApp;
      haptic('light');

      try {
        const res = await api('/api/wallet/pro', { method: 'POST' });
        if (res.invoiceLink) {
          if (tg?.openInvoice) {
            tg.openInvoice(res.invoiceLink, async (status) => {
              if (status === 'paid') {
                haptic('success');
                toast('Payment successful!', 'Orael Pro active');
                try {
                  const state = await api('/api/user');
                  updateState(state);
                  render();
                } catch (err) {
                  console.error('Failed to sync user state after payment:', err);
                }
              } else {
                toast('Payment incomplete', 'Subscription was not activated');
              }
            });
          } else {
            toast('Open inside Telegram', 'Stars checkout requires the Telegram app.');
          }
        } else {
          toast('Error', 'Failed to generate invoice link');
        }
      } catch (e) {
        // api() toasted
      }
    });
  }
}


