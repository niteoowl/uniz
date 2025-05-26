// js/team.js

import { db } from './firebase.js';
import { doc, setDoc } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';
import { generatePlayersForUser } from './player.js';

// 팀 생성 함수 (team.html에서 호출됨)
export async function createTeam(user, teamName, hometown) {
  if (!teamName || !hometown) {
    alert("팀 이름과 연고지를 입력해주세요.");
    return;
  }

  const teamRef = doc(db, "teams", user.uid);

  const teamData = {
    name: teamName,
    hometown: hometown,
    ownerId: user.uid,
    createdAt: new Date().toISOString()
  };

  try {
    // 팀 정보 저장
    await setDoc(teamRef, teamData);

    // 선수 자동 생성
    await generatePlayersForUser(user.uid);

    alert("✅ 팀 생성 및 선수 생성 완료!");
    window.location.href = "lineup.html"; // 다음 페이지로 이동

  } catch (error) {
    console.error("❌ 팀 생성 오류:", error);
    alert("팀 생성 중 오류가 발생했습니다.");
  }
}
