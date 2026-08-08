// ==UserScript==
// @name         Progress bar for Youtube player
// @encoding     utf-8
// @namespace    https://github.com/inmani9
// @downloadURL  https://raw.githubusercontent.com/inmani9/userscript/main/youtube-progress-bar.js
// @version      0.8
// @author       BJ
// @match        https://www.youtube.com/*

// @description       Show progress bar below Youtube video player with hover current time and thumbnail preview
// @description:ko    유튜브 플레이어 아래쪽에 진행바와 현재 재생 시간, 썸네일 미리보기 기능을 추가합니다.
// ==/UserScript==

(async function() {
  'use strict';

  // 시간을 초 단위에서 MM:SS 형식으로 변환하는 헬퍼 함수
  function formatTime(seconds) {
    if (isNaN(seconds)) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  // 1. 진행바 및 현재 시간 툴팁 생성
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

  // 툴팁 글자 크기 확대 및 스타일 조정
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
  `;
  bar.appendChild(tooltip);

  bar.onclick = function (e) {
    const video = document.querySelector('#movie_player video');
    if (video === null) return;

    const rect = bar.getBoundingClientRect();
    let mouseX = e.clientX - rect.left;
    video.currentTime = (mouseX / bar.offsetWidth) * video.duration;
  };

  // 마우스를 올리는 동안 현재 재생 시간을 실시간으로 표시
  bar.addEventListener('mouseenter', function () {
    const video = document.querySelector('#movie_player video');
    if (video === null) return;

    const rect = bar.getBoundingClientRect();
    // 마우스가 위치한 곳의 X 좌표를 기준으로 툴팁 위치 설정
    bar.onmousemove = function(e) {
      let mouseX = e.clientX - rect.left;
      tooltip.style.left = `${mouseX}px`;
    };

    tooltip.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
    tooltip.style.display = 'block';
  });

  // 비디오가 재생 중일 때 호버 상태라면 현재 시간 갱신
  bar.addEventListener('mousemove', function () {
    const video = document.querySelector('#movie_player video');
    if (video === null) return;
    tooltip.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
  });

  bar.addEventListener('mouseleave', function () {
    bar.onmousemove = null;
    tooltip.style.display = 'none';
  });

  const progress = document.createElement('div');
  progress.style = 'width: 0%; height: 100%; background-color: #ffff00; transition: all 0.1s;';
  bar.appendChild(progress);

  // 2. 썸네일 버튼 텍스트 축소 (아이콘 + 간결한 텍스트)
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
  `;
  thumbIcon.appendChild(thumbPreview);

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

  // 3. 페이지 감지 및 요소 삽입
  (new MutationObserver((mutations, observer) => {
    if (document.location.pathname != '/watch') return;
    const player = document.querySelector('#ytd-player');
    if (!player) return;

    const video = document.querySelector('#movie_player video');
    if (!video) return;

    if (!player.contains(bar)) {
      player.appendChild(bar);
    }

    const subscribeButton = document.querySelector('ytd-watch-metadata #owner #subscribe-button');
    if (subscribeButton && !subscribeButton.contains(thumbIcon)) {
      subscribeButton.style.display = 'flex';
      subscribeButton.style.alignItems = 'center';
      subscribeButton.appendChild(thumbIcon);
    }

    video.addEventListener('timeupdate', () => {
      if (video.duration) {
        progress.style.width = (video.currentTime / video.duration) * 100 + '%';
      }
    }, { passive: true });

  })).observe(document, { subtree: true, childList: true });
})();
