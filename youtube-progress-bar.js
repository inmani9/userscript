// ==UserScript==
// @name         show progress bar below Youtube player
// @namespace    https://github.com/inmani9
// @downloadURL  https://raw.githubusercontent.com/inmani9/userscript/refs/heads/main/youtube-progress-bar.js
// @description  유튜브 플레이어 아래쪽에 진행바를 보여준다.
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
    console.log('youtube-progress-always:', v);
    video.addEventListener('timeupdate', e => {
      progress.style.width = Math.round(v.currentTime) / v.duration * 100 + '%';
    }, { passive: true });
  })).observe(document, { subtree: true, childList: true });
})();
