// js/player.js

import { db } from './firebase.js';
import { doc, setDoc, collection } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';

const POSITIONS = [
  { pos: 'P', count: 5 },
  { pos: 'C', count: 2 },
  { pos: '1B', count: 2 },
  { pos: '2B', count: 2 },
  { pos: '3B', count: 2 },
  { pos: 'SS', count: 2 },
  { pos: 'LF', count: 2 },
  { pos: 'CF', count: 2 },
  { pos: 'RF', count: 2 }
];

const koreanFirstNames = ['김', '이', '박', '최', '정', '강', '조', '윤'];
const koreanLastNames = ['민수', '영호', '진우', '성민', '하늘', '지훈', '준서', '태현'];

function randomName() {
  const first = koreanFirstNames[Math.floor(Math.random() * koreanFirstNames.length)];
  const last = koreanLastNames[Math.floor(Math.random() * koreanLastNames.length)];
  return first + last;
}

function randomStat() {
  return Math.floor(Math.random() * 60) + 40; // 40~99
}

export async function generatePlayersForUser(userId) {
  const playersRef = collection(db, "players");
  let playerCount = 0;

  for (let posData of POSITIONS) {
    for (let i = 0; i < posData.count; i++) {
      const player = {
        userId,
        name: randomName(),
        position: posData.pos,
        avg: randomStat(),
        pwr: randomStat(),
        spd: randomStat(),
        def: randomStat(),
        pit: randomStat(),
        createdAt: new Date().toISOString()
      };

      const playerId = `${userId}_${posData.pos}_${i}`;
      await setDoc(doc(playersRef, playerId), player);
      playerCount++;
    }
  }

  // 남은 인원 UTIL
  while (playerCount < 32) {
    const player = {
      userId,
      name: randomName(),
      position: 'UTIL',
      avg: randomStat(),
      pwr: randomStat(),
      spd: randomStat(),
      def: randomStat(),
      pit: randomStat(),
      createdAt: new Date().toISOString()
    };

    const playerId = `${userId}_UTIL_${playerCount}`;
    await setDoc(doc(playersRef, playerId), player);
    playerCount++;
  }

  console.log("✅ 선수 32명 생성 완료");
}
