// ==UserScript==
// @name         Progress bar for Youtube player
// @encoding     utf-8
// @namespace    https://github.com/inmani9
// @downloadURL  https://raw.githubusercontent.com/inmani9/userscript/main/youtube-progress-bar.js
// @version      1.0
// @author       BJ
// @match        https://www.youtube.com/*

// @description       Show progress bar below Youtube video player with optimized performance
// @description:ko    유튜브 플레이어 아래쪽에 성능이 최적화된 진행바와 썸네일 미리보기 기능을 추가합니다.
// ==/UserScript==

(async function() {
  'use strict';

  function formatTime(seconds) {
    if (isNaN(seconds)) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  // 1. 진행바 및 툴팁 생성
  const bar = document.createElement('div');
  bar.style = `
    position: relative;
    width: auto;
    height: 6px;
    border: 1px solid white;
    background-color: #3f3f3f;
    border-radius: 3px;
    margin: 1px 20px 2px 20px;
    cursor: pointer;
  `;

  const tooltip = document.createElement('div');
  tooltip.style = `
    position: absolute;
    bottom: 12px;
    transform: translateX(-50%);
    background-color: rgba(0, 0, 0, 0.85);
    color: white;
    padding: 4px 8px;
    font-size: 13px;
    font-weight: bold;
    border-radius: 4px;
    white-space: nowrap;
    display: none;
    z-index: 9999;
    pointer-events: none;
  `;
  bar.appendChild(tooltip);

  const progress = document.createElement('div');
  progress.style = 'width: 0%; height: 100%; background-color: #ffff00;';
  bar.appendChild(progress);

  // 2. 썸네일 버튼 생성
  const thumbIcon = document.createElement('div');
  thumbIcon.textContent = '🖼️ 썸네일';
  thumbIcon.style = `
    display: inline-flex;
    align-items: center;
    cursor: pointer;
    margin-left: 8px;
    padding: 0 14px;
    height: 36px;
    font-size: 14px;
    font-weight: 500;
    background-color: rgba(255, 255, 255, 0.1);
    border-radius: 18px;
    vertical-align: middle;
    position: relative;
    color: var(--yt-spec-text-primary);
    box-sizing: border-box;
    transition: background-color 0.2s;
  `;

  const thumbPreview = document.createElement('div');
  thumbPreview.style = `
    position: absolute;
    top: 44px;
    left: 0;
    width: 480px;
    height: 270px;
    background-size: cover;
    background-position: center;
    border: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0px 6px 24px rgba(0,0,0,0.8);
    display: none;
    z-index: 9999;
    border-radius: 12px;
    pointer-events: none;
  `;
  thumbIcon.appendChild(thumbPreview);

  let cachedVideo = null;
  let isHoveringBar = false;

  // 이벤트 핸들러 미리 등록 (중복 방지)
  bar.onclick = function (e) {
    if (!cachedVideo) return;
    const rect = bar.getBoundingClientRect();
    let mouseX = e.clientX - rect.left;
    cachedVideo.currentTime = (mouseX / bar.offsetWidth) * cachedVideo.duration;
  };

  bar.addEventListener('mouseenter', () => {
    isHoveringBar = true;
    if (!cachedVideo) return;
    tooltip.textContent = `${formatTime(cachedVideo.currentTime)} / ${formatTime(cachedVideo.duration)}`;
    tooltip.style.display = 'block';
  });

  bar.addEventListener('mousemove', (e) => {
    const rect = bar.getBoundingClientRect();
    tooltip.style.left = `${e.clientX - rect.left}px`;
  });

  bar.addEventListener('mouseleave', () => {
    isHoveringBar = false;
    tooltip.style.display = 'none';
  });

  thumbIcon.addEventListener('mouseenter', () => {
    thumbIcon.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
    const videoId = new URLSearchParams(window.location.search).get('v');
    if (videoId) {
      thumbPreview.style.backgroundImage = `url(https://img.youtube.com/vi/${videoId}/hqdefault.jpg)`;
      thumbPreview.style.display = 'block';
    }
  });

  thumbIcon.addEventListener('mouseleave', () => {
    thumbIcon.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    thumbPreview.style.display = 'none';
  });

  // 3. 최적화된 감지 및 이벤트 연결
  let lastVideoElement = null;

  (new MutationObserver(() => {
    if (document.location.pathname != '/watch') return;
    
    const player = document.querySelector('#ytd-player');
    const video = document.querySelector('#movie_player video');
    const subscribeButton = document.querySelector('ytd-watch-metadata #owner #subscribe-button');

    if (!player || !video) return;

    // 비디오 요소가 바뀌었을 때만 이벤트 리스너 재장착
    if (video !== lastVideoElement) {
      lastVideoElement = video;
      cachedVideo = video;

      video.addEventListener('timeupdate', () => {
        if (!cachedVideo || isNaN(cachedVideo.duration)) return;
        
        // 진행바 너비 갱신
        progress.style.width = (cachedVideo.currentTime / cachedVideo.duration) * 100 + '%';
        
        // 호버 중일 때만 시간 텍스트 갱신 (불필요한 연산 차단)
        if (isHoveringBar) {
          tooltip.textContent = `${formatTime(cachedVideo.currentTime)} / ${formatTime(cachedVideo.duration)}`;
        }
      }, { passive: true });
    }

    // UI 요소 삽입
    if (!player.contains(bar)) {
      player.appendChild(bar);
    }

    if (subscribeButton && !subscribeButton.contains(thumbIcon)) {
      subscribeButton.style.display = 'flex';
      subscribeButton.style.alignItems: 'center';
      subscribeButton.appendChild(thumbIcon);
    }

  })).observe(document.getElementById('content') || document.body, { childList: true, subtree: true });
})();
