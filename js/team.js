// js/team.js

import { db } from './firebase.js';
import { doc, setDoc } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';
import { generatePlayersForUser } from './player.js';  // ✅ 여기 중요!

// HTML에서 버튼 클릭 시 실행할 함수
export async function createTeam(user, teamName, hometown) {
  const teamRef = doc(db, "teams", user.uid);

  const teamData = {
    name: teamName,
    hometown: hometown,
    ownerId: user.uid,
    createdAt: new Date().toISOString()
  };

  try {
    // 1. 팀 정보 저장
    await setDoc(teamRef, teamData);

    // 2. ✅ 선수 자동 생성 호출
    await generatePlayersForUser(user.uid);

    alert("🎉 팀과 선수 생성 완료!");
    window.location.href = "lineup.html"; // 라인업 설정 페이지로 이동

  } catch (error) {
    console.error("❌ 팀 생성 실패:", error);
    alert("에러: 팀 생성 중 문제가 발생했습니다");
  }
}
