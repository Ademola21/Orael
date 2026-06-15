/* ========================================================================
   ads.js — Adsgram rewarded ad player
   Plays real Adsgram rewarded video ads in production.
   ======================================================================== */

import { haptic } from './telegram.js';

/** SVG arc circumference for the main gauge */
export const ARC_LEN = 395.8;

/** SVG arc circumference for the ad countdown ring */
export const AD_RING = 276.46;

/** @type {object|null} */
let adsgramController = null;

/** @type {boolean} */
let adPlaying = false;

/**
 * Play a real Adsgram rewarded ad.
 *
 * @param {string}   title     — overlay title text (for logging/compatibility)
 * @param {string}   body      — overlay body text (for logging/compatibility)
 * @param {number}   seconds   — countdown duration (ignored as Adsgram handles video length)
 * @param {Function} onReward  — callback fired when ad completes successfully
 */
export function playAd(title, body, seconds, onReward) {
  if (adPlaying) {
    console.warn('An ad is already playing. Ignoring request.');
    return;
  }
  adPlaying = true;
  haptic('light');

  const blockId = import.meta.env.VITE_ADSGRAM_BLOCK_ID;

  if (window.Adsgram && blockId) {
    if (!adsgramController) {
      adsgramController = window.Adsgram.init({ blockId });
    }
    adsgramController.show()
      .then((result) => {
        adPlaying = false;
        if (result.done) {
          haptic('success');
          if (onReward) onReward();
        } else {
          import('./ui.js').then(({ toast }) => {
            toast('Ad not completed', 'Please watch to the end');
          });
        }
      })
      .catch((err) => {
        adPlaying = false;
        console.error('Adsgram error:', err);
        
        let errMsg = 'No ads available at the moment. Please try again later.';
        if (err) {
          errMsg = err.description || err.message || errMsg;
        }

        import('./ui.js').then(({ toast }) => {
          toast('Ad Error', errMsg);
        });
      });
  } else {
    adPlaying = false;
    console.error('Adsgram SDK not available or blockId is missing.');
    import('./ui.js').then(({ toast }) => {
      toast('Ad failed to load', 'Please disable ad blockers and try again.');
    });
  }
}
