// js/schedule.js

import { db } from './firebase.js';
import { doc, setDoc } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';
import { collection } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';

// 10팀 이름 (예시)
const teamNames = [
  "서울불펜", "부산타이푼", "대구파이어", "인천레전드", "광주파워",
  "대전로켓", "울산스톰", "수원히어로즈", "전주드래곤즈", "청주헌터스"
];

// 일정 시작일 (YYYY-MM-DD)
const START_DATE = "2025-06-01";

// 라운드 생성 (총 90경기일 = 18라운드)
function generateMatchups(round) {
  const pairings = [];
  const order = [...teamNames];

  if (round % 2 === 0) order.reverse(); // 짝수 라운드 홈/원정 반전

  for (let i = 0; i < teamNames.length / 2; i++) {
    const home = order[i];
    const away = order[teamNames.length - 1 - i];
    pairings.push({ home, away });
  }
  return pairings;
}

// 날짜 문자열 YYYY-MM-DD 반환
function formatDate(date) {
  return date.toISOString().split("T")[0];
}

// 전체 일정 생성
export async function generateSchedule() {
  const start = new Date(START_DATE);
  let round = 0;
  let gameDays = 0;

  for (let i = 0; i < 110; i++) {
    const currentDate = new Date(start);
    currentDate.setDate(start.getDate() + i);
    const dateStr = formatDate(currentDate);
    const day = currentDate.getDay();

    let type = "";
    let data = { date: dateStr };

    if (day === 1) {
      // 월요일 휴식
      type = "rest";
    } else if (gameDays < 90) {
      // 경기일
      type = "game";
      const games = generateMatchups(round);
      data.games = games;
      round++;
      gameDays++;
    } else if (gameDays === 90) {
      // 마지막 날 올스타전
      type = "allstar";
      data.games = [{ home: "K리그", away: "W리그" }];
      gameDays++;
    } else {
      // 넘치면 스킵
      continue;
    }

    data.type = type;

    try {
      await setDoc(doc(db, "schedules", dateStr), data);
      console.log(`📅 일정 생성 완료: ${dateStr} (${type})`);
    } catch (err) {
      console.error("❌ 일정 생성 오류:", err);
    }
  }

  alert("✅ 리그 일정 110일 생성 완료!");
}
