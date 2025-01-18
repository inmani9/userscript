// ==UserScript==
// @name         Progress bar for Youtube player
// @encoding     utf-8
// @namespace    https://github.com/inmani9
// @downloadURL  https://raw.githubusercontent.com/inmani9/userscript/main/youtube-progress-bar.js
// @version      0.2
// @author       BJ
// @match        https://www.youtube.com/*

// @description       Show progress bar above Youtube video player
// @description:ko    유튜브 플레이어 위쪽에 진행바를 보여줍니다.
// ==/UserScript==

(async function() {
  'use strict';

  const video = document.querySelector('#movie_player video');
  if (video === null) return;

  const bar = document.createElement('div');
  bar.style = `
    width: auto;
    height: 6px;
    border: 1px solid white;
    background-color: #3f3f3f;
    border-radius: 3px;
    margin: 0px 20px 0px 20px;
    cursor: pointer;
  `;
  bar.onclick = function (e) {
    if (video === null) return;

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

    const header = document.getElementById('masthead-container');
    header.appendChild(bar);

    video.addEventListener('timeupdate', e => {
      progress.style.width = Math.round(video.currentTime) / video.duration * 100 + '%';
    }, { passive: true });
  })).observe(document, { subtree: true, childList: true });
})();
