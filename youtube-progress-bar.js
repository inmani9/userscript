// ==UserScript==
// @name         show progress bar below Youtube player
// @namespace    https://github.com/inmani9
// @downloadURL  https://github.com/inmani9/userscript/blob/e7e85ea3cc8149e3a00d261ddee235d3354cc6a5/youtube-progress-bar.js
// @version      0.1
// @author       BJ
// @match        https://www.youtube.com/*
// ==/UserScript==

(async function() {
  'use strict';

  const video = document.querySelector('#movie_player video');
  if (video === null) return;

  const bar = document.createElement('div');
  bar.style = 'width: auto; height: 6px; border: 1px solid white; background-color: #3f3f3f; border-radius: 3px; margin: 1px 20px 0px 20px; cursor: pointer;';
  bar.onclick = function (e) {
    const rect = e.target.getBoundingClientRect();
    let mouseX = e.clientX - rect.left;
    video.currentTime = (mouseX / bar.offsetWidth) * video.duration;
  }

  const progress = document.createElement('div');
  progress.style = 'width: 100%; height: 100%; background-color: #ffff00; width: 0; transition: all 0.5s;'
  bar.appendChild(progress);

  (new MutationObserver((mutations, observer) => {
    if (document.location.pathname != '/watch') return;
    const player = document.querySelector('#ytd-player');
    if (!player) return;
    observer.disconnect();
    player.appendChild(bar); // append progress bar below video
    video.addEventListener('timeupdate', e => {
      progress.style.width = Math.round(video.currentTime) / video.duration * 100 + '%';
    }, { passive: true });
  })).observe(document, { subtree: true, childList: true });
})();
