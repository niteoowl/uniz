import React, { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, getDocs, runTransaction } from 'firebase/firestore';

// Tailwind CSS is assumed to be available

// Global variables from the Canvas environment
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Context for Firebase and User data
const AppContext = createContext(null);

// Utility function for generating unique IDs
const generateUniqueId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

// Player data structure
const createPlayer = (name, position, batting_avg, era) => ({
  id: generateUniqueId(),
  name,
  position,
  batting_avg: parseFloat(batting_avg),
  era: parseFloat(era),
});

// Helper to calculate average batting average for batters
const calculateOffensiveStrength = (batters) => {
  if (!batters || batters.length === 0) return 0.250; // Default average if no batters
  const totalBattingAvg = batters.reduce((sum, player) => sum + (player.batting_avg || 0), 0);
  return totalBattingAvg / batters.length;
};

// Helper to calculate average ERA for pitchers
const calculateDefensiveStrength = (pitchers) => {
  if (!pitchers || pitchers.length === 0) return 4.00; // Default average if no pitchers
  const totalEra = pitchers.reduce((sum, player) => sum + (player.era || 0), 0);
  // Cap ERA at a minimum to avoid extreme defensive strength from 0 ERA or division by zero if used in other calculations
  return Math.max(0.01, totalEra / pitchers.length);
};

// Game Simulation Engine (mimicking Python logic in JS)
const simulateGame = (teamA, teamB) => {
  let scoreA = 0;
  let scoreB = 0;
  let summary = [];

  summary.push(`${teamA.name} vs ${teamB.name} - 경기 시작!`);
  summary.push('---');

  // Calculate team strengths based on their lineups
  // Ensure lineups exist before calculating strength
  const teamA_offense = calculateOffensiveStrength(teamA.lineupBatters || []);
  const teamA_defense = calculateDefensiveStrength(teamA.lineupPitchers || []);
  const teamB_offense = calculateOffensiveStrength(teamB.lineupBatters || []);
  const teamB_defense = calculateDefensiveStrength(teamB.lineupPitchers || []);

  // Constants for balancing the simulation
  const BASE_RUNS_MAX = 2; // Max random runs without stat adjustment (0-2 runs)
  const OFFENSE_MULTIPLIER = 10; // How much batting average influences runs (e.g., 0.01 batting avg difference = 0.1 runs)
  const DEFENSE_MULTIPLIER = 0.2; // How much ERA influences runs (e.g., 1.0 ERA difference = 0.2 runs)
  const AVG_BAT_AVG = 0.250; // League average batting average for normalization
  const AVG_ERA = 4.00;      // League average ERA for normalization

  // Function to get runs for an inning based on offensive and defensive stats
  const getInningRuns = (attacking_offense, defending_defense) => {
    // Base random runs (0 to BASE_RUNS_MAX inclusive, e.g., 0, 1, 2)
    let runs = Math.floor(Math.random() * (BASE_RUNS_MAX + 1));

    // Adjust for offense: higher batting average -> more runs
    // For example, if attacking_offense is 0.300 (0.050 above avg), adds 0.050 * 10 = 0.5 runs
    runs += (attacking_offense - AVG_BAT_AVG) * OFFENSE_MULTIPLIER;

    // Adjust for defense: lower ERA -> fewer runs
    // For example, if defending_defense is 3.00 (1.00 below avg), subtracts 1.00 * 0.2 = 0.2 runs
    runs -= (defending_defense - AVG_ERA) * DEFENSE_MULTIPLIER;

    // Ensure runs are non-negative and capped at a reasonable maximum for an inning (e.g., 5 runs)
    return Math.max(0, Math.min(5, Math.round(runs)));
  };

  for (let inning = 1; inning <= 9; inning++) {
    // Team A's turn to bat (A's offense vs B's defense)
    let inningScoreA = getInningRuns(teamA_offense, teamB_defense);
    scoreA += inningScoreA;

    // Team B's turn to bat (B's offense vs A's defense)
    let inningScoreB = getInningRuns(teamB_offense, teamA_defense);
    scoreB += inningScoreB;

    summary.push(`[${inning}회] ${teamA.name}: ${inningScoreA}점, ${teamB.name}: ${inningScoreB}점`);
    summary.push(`현재 점수: ${teamA.name} ${scoreA} - ${teamB.name} ${scoreB}`);
  }

  summary.push('---');
  summary.push('경기 종료!');

  let winner = '';
  if (scoreA > scoreB) {
    winner = teamA.name;
    summary.push(`${teamA.name} 승리! 최종 점수: ${teamA.name} ${scoreA} - ${teamB.name} ${scoreB}`);
  } else if (scoreB > scoreA) {
    winner = teamB.name;
    summary.push(`${teamB.name} 승리! 최종 점수: ${teamA.name} ${scoreA} - ${teamB.name} ${scoreB}`);
  } else {
    // Tie-breaker: if tied after 9 innings, the team with higher overall strength wins by 1 run
    // A simplified overall strength calculation (offense minus defense)
    const teamA_overall_strength = teamA_offense - (teamA_defense / AVG_ERA); // Normalize ERA for strength comparison
    const teamB_overall_strength = teamB_offense - (teamB_defense / AVG_ERA);

    if (teamA_overall_strength >= teamB_overall_strength) {
      scoreA += 1;
      winner = teamA.name;
      summary.push(`연장전 끝에 ${teamA.name} 승리! 최종 점수: ${teamA.name} ${scoreA} - ${teamB.name} ${scoreB}`);
    } else {
      scoreB += 1;
      winner = teamB.name;
      summary.push(`연장전 끝에 ${teamB.name} 승리! 최종 점수: ${teamA.name} ${scoreA} - ${teamB.name} ${scoreB}`);
    }
  }

  return {
    teamAScore: scoreA,
    teamBScore: scoreB,
    summaryText: summary.join('\n'),
    winner: winner,
  };
};

// Main App Component
function App() {
  const [app, setApp] = useState(null);
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('home'); // home, createTeam, myTeam, lineup, simulate, gameResults, league, playerMarket

  // Firebase Initialization and Auth Listener
  useEffect(() => {
    const initializeFirebase = async () => {
      try {
        const firebaseApp = initializeApp(firebaseConfig);
        const firestoreDb = getFirestore(firebaseApp);
        const firebaseAuth = getAuth(firebaseApp);

        setApp(firebaseApp);
        setDb(firestoreDb);
        setAuth(firebaseAuth);

        // Sign in with custom token or anonymously
        if (initialAuthToken) {
          await signInWithCustomToken(firebaseAuth, initialAuthToken);
        } else {
          await signInAnonymously(firebaseAuth);
        }

        // Auth state change listener
        const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
          if (user) {
            setUserId(user.uid);
          } else {
            setUserId(null);
          }
          setLoading(false); // Auth state is ready
        });

        return () => unsubscribe();
      } catch (error) {
        console.error("Firebase 초기화 또는 인증 오류:", error);
        setLoading(false);
      }
    };

    initializeFirebase();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-lg font-semibold text-gray-700">로딩 중...</div>
      </div>
    );
  }

  // Provide context values to children
  const contextValue = { app, db, auth, userId, setCurrentPage };

  return (
    <AppContext.Provider value={contextValue}>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 font-inter text-gray-800 p-4 sm:p-6">
        <header className="bg-white rounded-xl shadow-lg p-4 mb-6 flex flex-col sm:flex-row justify-between items-center">
          <h1 className="text-3xl font-bold text-indigo-700 mb-2 sm:mb-0">
            <span className="inline-block mr-2">⚾</span> 야구 GM 시뮬레이션
          </h1>
          <nav className="flex flex-wrap gap-2 sm:gap-4 text-sm font-medium">
            <NavItem page="home" currentPage={currentPage} onClick={() => setCurrentPage('home')}>홈</NavItem>
            <NavItem page="createTeam" currentPage={currentPage} onClick={() => setCurrentPage('createTeam')}>팀 생성</NavItem>
            <NavItem page="myTeam" currentPage={currentPage} onClick={() => setCurrentPage('myTeam')}>내 팀</NavItem>
            <NavItem page="lineup" currentPage={currentPage} onClick={() => setCurrentPage('lineup')}>라인업</NavItem>
            <NavItem page="simulate" currentPage={currentPage} onClick={() => setCurrentPage('simulate')}>경기 시뮬레이션</NavItem>
            <NavItem page="gameResults" currentPage={currentPage} onClick={() => setCurrentPage('gameResults')}>경기 결과</NavItem>
            <NavItem page="league" currentPage={currentPage} onClick={() => setCurrentPage('league')}>리그 순위</NavItem>
            <NavItem page="playerMarket" currentPage={currentPage} onClick={() => setCurrentPage('playerMarket')}>선수 시장</NavItem>
          </nav>
        </header>

        <main className="bg-white rounded-xl shadow-lg p-6">
          {userId && (
            <div className="mb-4 text-sm text-gray-600">
              <span className="font-semibold">현재 사용자 ID:</span> {userId}
            </div>
          )}
          {currentPage === 'home' && <HomePage />}
          {currentPage === 'createTeam' && <CreateTeamPage />}
          {currentPage === 'myTeam' && <MyTeamPage />}
          {currentPage === 'lineup' && <LineupPage />}
          {currentPage === 'simulate' && <SimulateGamePage />}
          {currentPage === 'gameResults' && <GameResultsPage />}
          {currentPage === 'league' && <LeagueStandingsPage />}
          {currentPage === 'playerMarket' && <PlayerMarketPage />}
        </main>
      </div>
    </AppContext.Provider>
  );
}

// Nav Item Component
const NavItem = ({ page, currentPage, onClick, children }) => (
  <button
    className={`px-3 py-2 rounded-lg transition-colors duration-200
      ${currentPage === page ? 'bg-indigo-600 text-white shadow-md' : 'text-indigo-600 hover:bg-indigo-100'}
      focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
    onClick={onClick}
  >
    {children}
  </button>
);

// Home Page
const HomePage = () => {
  const { userId } = useContext(AppContext);
  return (
    <div className="text-center py-8">
      <h2 className="text-4xl font-extrabold text-gray-900 mb-4">환영합니다, GM님!</h2>
      <p className="text-lg text-gray-700 mb-6">
        나만의 야구팀을 만들고, 라인업을 편성하고, 리그를 정복하세요!
      </p>
      {userId && (
        <p className="text-md text-gray-600">
          시작하려면 상단 메뉴에서 팀을 생성하거나 내 팀을 확인하세요.
        </p>
      )}
    </div>
  );
};

// Create Team Page
const CreateTeamPage = () => {
  const { db, userId, setCurrentPage } = useContext(AppContext);
  const [teamName, setTeamName] = useState('');
  const [hometown, setHometown] = useState('');
  const [logo, setLogo] = useState('⚾'); // Default emoji logo
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // success or error
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!teamName || !hometown || !logo) {
      setMessage('모든 필드를 채워주세요.');
      setMessageType('error');
      return;
    }
    setLoading(true);
    setMessage('');
    setMessageType('');

    try {
      const teamId = generateUniqueId();
      const teamRef = doc(db, `artifacts/${appId}/users/${userId}/teams`, teamId);
      const publicTeamRef = doc(db, `artifacts/${appId}/public/data/leagueTeams`, teamId); // For league standings

      await setDoc(teamRef, {
        id: teamId,
        name: teamName,
        hometown: hometown,
        logo: logo,
        ownerId: userId,
        wins: 0,
        losses: 0,
        currency: 1000, // Initial currency for the team
        createdAt: new Date(),
      });

      // Also create a public entry for league standings
      await setDoc(publicTeamRef, {
        id: teamId,
        name: teamName,
        logo: logo,
        ownerId: userId,
        wins: 0,
        losses: 0,
      });

      // Add some default players to the team (9 batters, 2 pitchers)
      const playersCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/players`);
      const defaultPlayers = [
        createPlayer('김민수', '투수', 0.0, 3.50),
        createPlayer('이준호', '투수', 0.0, 3.80),
        createPlayer('박서준', '포수', 0.280, 0.0),
        createPlayer('최우진', '1루수', 0.310, 0.0),
        createPlayer('정하윤', '2루수', 0.295, 0.0),
        createPlayer('강지훈', '3루수', 0.270, 0.0),
        createPlayer('윤서연', '유격수', 0.265, 0.0),
        createPlayer('신지아', '좌익수', 0.300, 0.0),
        createPlayer('한예슬', '중견수', 0.290, 0.0),
        createPlayer('오지환', '우익수', 0.285, 0.0),
        createPlayer('이수민', '지명타자', 0.275, 0.0), // Added one more batter
      ];

      for (const player of defaultPlayers) {
        await setDoc(doc(playersCollectionRef, player.id), player);
      }

      setMessage('팀이 성공적으로 생성되었습니다!');
      setMessageType('success');
      setTeamName('');
      setHometown('');
      setLogo('⚾');
      setTimeout(() => setCurrentPage('myTeam'), 2000); // Redirect after 2 seconds
    } catch (error) {
      console.error("팀 생성 오류:", error);
      setMessage('팀 생성에 실패했습니다: ' + error.message);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-xl shadow-lg">
      <h2 className="text-2xl font-bold text-indigo-700 mb-6 text-center">새 팀 생성</h2>
      {message && (
        <div className={`p-3 mb-4 rounded-lg text-sm ${messageType === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {message}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="teamName" className="block text-sm font-medium text-gray-700">팀 이름</label>
          <input
            type="text"
            id="teamName"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="hometown" className="block text-sm font-medium text-gray-700">연고지</label>
          <input
            type="text"
            id="hometown"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            value={hometown}
            onChange={(e) => setHometown(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="logo" className="block text-sm font-medium text-gray-700">팀 로고 (이모지)</label>
          <input
            type="text"
            id="logo"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            value={logo}
            onChange={(e) => setLogo(e.target.value)}
            maxLength={2} // Limit to one emoji
          />
        </div>
        <button
          type="submit"
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150 ease-in-out"
          disabled={loading}
        >
          {loading ? '생성 중...' : '팀 생성'}
        </button>
      </form>
    </div>
  );
};

// My Team Page
const MyTeamPage = () => {
  const { db, userId } = useContext(AppContext);
  const [myTeam, setMyTeam] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showListModal, setShowListModal] = useState(false);
  const [playerToSell, setPlayerToSell] = useState(null);
  const [sellPrice, setSellPrice] = useState(0);
  const [listMessage, setListMessage] = useState('');
  const [listMessageType, setListMessageType] = useState('');

  useEffect(() => {
    if (!db || !userId) return;

    // Use onSnapshot for real-time updates for team and players
    const unsubscribeTeam = onSnapshot(query(collection(db, `artifacts/${appId}/users/${userId}/teams`), where("ownerId", "==", userId)), (snapshot) => {
        if (!snapshot.empty) {
            setMyTeam(snapshot.docs[0].data());
        } else {
            setMyTeam(null);
        }
        setLoading(false);
    }, (err) => {
        console.error("팀 데이터 실시간 업데이트 오류:", err);
        setError("팀 데이터 실시간 업데이트에 실패했습니다.");
        setLoading(false);
    });

    const unsubscribePlayers = onSnapshot(query(collection(db, `artifacts/${appId}/users/${userId}/players`)), (snapshot) => {
        const playersList = snapshot.docs.map(doc => doc.data());
        setPlayers(playersList);
        setLoading(false);
    }, (err) => {
        console.error("선수 데이터 실시간 업데이트 오류:", err);
        setError("선수 데이터 실시간 업데이트에 실패했습니다.");
        setLoading(false);
    });

    return () => {
        unsubscribeTeam();
        unsubscribePlayers();
    };
  }, [db, userId]);

  const handleListPlayer = (player) => {
    setPlayerToSell(player);
    setSellPrice(100); // Default sell price
    setListMessage('');
    setListMessageType('');
    setShowListModal(true);
  };

  const confirmListPlayer = async () => {
    if (!playerToSell || sellPrice <= 0) {
      setListMessage('유효한 가격을 입력해주세요.');
      setListMessageType('error');
      return;
    }

    try {
      // Remove player from user's roster
      await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/players`, playerToSell.id));

      // Add player to public market
      await setDoc(doc(db, `artifacts/${appId}/public/data/marketPlayers`, playerToSell.id), {
        ...playerToSell,
        price: sellPrice,
        currentOwnerId: userId, // Keep track of original owner for transaction
        listedAt: new Date(),
      });

      setListMessage(`${playerToSell.name} 선수가 시장에 등록되었습니다!`);
      setListMessageType('success');
      setShowListModal(false);
      setPlayerToSell(null);
    } catch (error) {
      console.error("선수 시장 등록 오류:", error);
      setListMessage('선수 시장 등록에 실패했습니다: ' + error.message);
      setListMessageType('error');
    }
  };


  if (loading) return <div className="text-center py-8">로딩 중...</div>;
  if (error) return <div className="text-center py-8 text-red-500">{error}</div>;
  if (!myTeam) return <div className="text-center py-8 text-gray-600">아직 팀이 없습니다. '팀 생성' 메뉴에서 팀을 만들어주세요.</div>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-indigo-700 mb-6 text-center">내 팀 정보</h2>
      <div className="bg-indigo-50 p-6 rounded-xl shadow-inner mb-8">
        <div className="flex items-center mb-4">
          <span className="text-5xl mr-4">{myTeam.logo}</span>
          <div>
            <h3 className="text-3xl font-extrabold text-indigo-800">{myTeam.name}</h3>
            <p className="text-lg text-indigo-600">{myTeam.hometown}</p>
          </div>
        </div>
        <div className="flex justify-around text-center mt-4">
          <div>
            <p className="text-2xl font-bold text-green-600">{myTeam.wins}</p>
            <p className="text-sm text-gray-600">승</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-600">{myTeam.losses}</p>
            <p className="text-sm text-gray-600">패</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-yellow-600">{myTeam.currency || 0}</p>
            <p className="text-sm text-gray-600">재화</p>
          </div>
        </div>
      </div>

      <h3 className="text-xl font-bold text-indigo-700 mb-4">선수 로스터</h3>
      {players.length === 0 ? (
        <p className="text-gray-600">로스터에 선수가 없습니다. 팀 생성 시 기본 선수가 추가됩니다.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {players.map(player => (
            <div key={player.id} className="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-200 flex justify-between items-center">
              <div>
                <p className="text-lg font-semibold text-gray-800">{player.name}</p>
                <p className="text-sm text-gray-600">포지션: {player.position}</p>
                {player.position === '투수' ? (
                  <p className="text-sm text-gray-600">ERA: {player.era.toFixed(2)}</p>
                ) : (
                  <p className="text-sm text-gray-600">타율: {player.batting_avg.toFixed(3)}</p>
                )}
              </div>
              <button
                onClick={() => handleListPlayer(player)}
                className="ml-4 px-3 py-1 bg-yellow-500 text-white rounded-md text-sm hover:bg-yellow-600 transition-colors"
              >
                판매 등록
              </button>
            </div>
          ))}
        </div>
      )}

      {showListModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm relative">
            <button
              onClick={() => setShowListModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 focus:outline-none"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h3 className="text-xl font-bold text-indigo-700 mb-4 text-center">선수 판매 등록</h3>
            {listMessage && (
              <div className={`p-3 mb-4 rounded-lg text-sm ${listMessageType === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {listMessage}
              </div>
            )}
            {playerToSell && (
              <>
                <p className="text-center mb-4">
                  <span className="font-semibold">{playerToSell.name}</span> 선수를 얼마에 판매하시겠습니까?
                </p>
                <div className="mb-4">
                  <label htmlFor="sellPrice" className="block text-sm font-medium text-gray-700">판매 가격</label>
                  <input
                    type="number"
                    id="sellPrice"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    value={sellPrice}
                    onChange={(e) => setSellPrice(Math.max(0, parseInt(e.target.value) || 0))}
                    min="1"
                    required
                  />
                </div>
                <button
                  onClick={confirmListPlayer}
                  className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                >
                  등록 확인
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Lineup Page
const LineupPage = () => {
  const { db, userId } = useContext(AppContext);
  const [myTeam, setMyTeam] = useState(null);
  const [allPlayers, setAllPlayers] = useState([]);
  const [selectedBatters, setSelectedBatters] = useState([]);
  const [selectedPitchers, setSelectedPitchers] = useState([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !userId) return;

    // Use onSnapshot for real-time updates
    const unsubscribeTeam = onSnapshot(query(collection(db, `artifacts/${appId}/users/${userId}/teams`), where("ownerId", "==", userId)), (snapshot) => {
        if (!snapshot.empty) {
            const teamData = snapshot.docs[0].data();
            setMyTeam(teamData);
            if (teamData.lineupBatters) setSelectedBatters(teamData.lineupBatters);
            if (teamData.lineupPitchers) setSelectedPitchers(teamData.lineupPitchers);
        } else {
            setMyTeam(null);
        }
        setLoading(false);
    }, (err) => {
        console.error("팀 데이터 실시간 업데이트 오류:", err);
        setMessage("팀 데이터 실시간 업데이트에 실패했습니다.");
        setMessageType('error');
        setLoading(false);
    });

    const unsubscribePlayers = onSnapshot(collection(db, `artifacts/${appId}/users/${userId}/players`), (snapshot) => {
        setAllPlayers(snapshot.docs.map(doc => doc.data()));
        setLoading(false);
    }, (err) => {
        console.error("선수 데이터 실시간 업데이트 오류:", err);
        setMessage("선수 데이터 실시간 업데이트에 실패했습니다.");
        setMessageType('error');
        setLoading(false);
    });

    return () => {
        unsubscribeTeam();
        unsubscribePlayers();
    };
  }, [db, userId]);

  const handleAddBatter = (player) => {
    if (selectedBatters.length < 9 && !selectedBatters.some(p => p.id === player.id)) {
      setSelectedBatters([...selectedBatters, player]);
    } else if (selectedBatters.some(p => p.id === player.id)) {
      setMessage('이미 라인업에 있는 선수입니다.');
      setMessageType('error');
    } else {
      setMessage('타자 라인업은 9명까지 가능합니다.');
      setMessageType('error');
    }
  };

  const handleRemoveBatter = (playerId) => {
    setSelectedBatters(selectedBatters.filter(p => p.id !== playerId));
  };

  const handleAddPitcher = (player) => {
    if (selectedPitchers.length < 5 && !selectedPitchers.some(p => p.id === player.id)) { // Allow multiple pitchers
      setSelectedPitchers([...selectedPitchers, player]);
    } else if (selectedPitchers.some(p => p.id === player.id)) {
      setMessage('이미 라인업에 있는 선수입니다.');
      setMessageType('error');
    } else {
      setMessage('투수 라인업은 5명까지 가능합니다.');
      setMessageType('error');
    }
  };

  const handleRemovePitcher = (playerId) => {
    setSelectedPitchers(selectedPitchers.filter(p => p.id !== playerId));
  };

  const handleSaveLineup = async () => {
    if (!myTeam) {
      setMessage('팀 정보가 없습니다. 먼저 팀을 생성해주세요.');
      setMessageType('error');
      return;
    }
    if (selectedBatters.length !== 9) {
      setMessage('타자 라인업은 9명이어야 합니다.');
      setMessageType('error');
      return;
    }
    if (selectedPitchers.length === 0) {
      setMessage('투수를 최소 1명 이상 선택해야 합니다.');
      setMessageType('error');
      return;
    }

    try {
      const teamRef = doc(db, `artifacts/${appId}/users/${userId}/teams`, myTeam.id);
      await updateDoc(teamRef, {
        lineupBatters: selectedBatters,
        lineupPitchers: selectedPitchers,
      });
      setMessage('라인업이 성공적으로 저장되었습니다!');
      setMessageType('success');
    } catch (error) {
      console.error("라인업 저장 오류:", error);
      setMessage('라인업 저장에 실패했습니다: ' + error.message);
      setMessageType('error');
    }
  };

  const availableBatters = allPlayers.filter(p => p.position !== '투수' && !selectedBatters.some(sp => sp.id === p.id));
  const availablePitchers = allPlayers.filter(p => p.position === '투수' && !selectedPitchers.some(sp => sp.id === p.id));

  if (loading) return <div className="text-center py-8">로딩 중...</div>;
  if (!myTeam) return <div className="text-center py-8 text-gray-600">아직 팀이 없습니다. '팀 생성' 메뉴에서 팀을 만들어주세요.</div>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-indigo-700 mb-6 text-center">라인업 편성</h2>
      {message && (
        <div className={`p-3 mb-4 rounded-lg text-sm ${messageType === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Batters Lineup */}
        <div className="bg-blue-50 p-6 rounded-xl shadow-inner">
          <h3 className="text-xl font-semibold text-blue-700 mb-4">타자 라인업 ({selectedBatters.length}/9)</h3>
          <div className="space-y-2 mb-4">
            {selectedBatters.map((player, index) => (
              <div key={player.id} className="flex items-center justify-between bg-white p-3 rounded-md shadow-sm border border-blue-200">
                <span>{index + 1}. {player.name} ({player.position})</span>
                <button
                  onClick={() => handleRemoveBatter(player.id)}
                  className="ml-2 text-red-500 hover:text-red-700 focus:outline-none"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1zm2 3a1 1 0 00-1 1v3a1 1 0 102 0v-3a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          <h4 className="text-lg font-medium text-blue-600 mb-3">선택 가능한 타자</h4>
          <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto border border-blue-200 rounded-md p-2">
            {availableBatters.length === 0 ? (
              <p className="col-span-2 text-gray-500 text-sm">선택 가능한 타자가 없습니다.</p>
            ) : (
              availableBatters.map(player => (
                <button
                  key={player.id}
                  onClick={() => handleAddBatter(player)}
                  className="bg-white p-2 rounded-md shadow-sm text-sm text-left hover:bg-blue-100 transition duration-150 ease-in-out border border-gray-200"
                >
                  {player.name} ({player.position})
                </button>
              ))
            )}
          </div>
        </div>

        {/* Pitchers Lineup */}
        <div className="bg-green-50 p-6 rounded-xl shadow-inner">
          <h3 className="text-xl font-semibold text-green-700 mb-4">투수 라인업 ({selectedPitchers.length}/5)</h3>
          <div className="space-y-2 mb-4">
            {selectedPitchers.map((player, index) => (
              <div key={player.id} className="flex items-center justify-between bg-white p-3 rounded-md shadow-sm border border-green-200">
                <span>{index + 1}. {player.name} ({player.position})</span>
                <button
                  onClick={() => handleRemovePitcher(player.id)}
                  className="ml-2 text-red-500 hover:text-red-700 focus:outline-none"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1zm2 3a1 1 0 00-1 1v3a1 1 0 102 0v-3a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          <h4 className="text-lg font-medium text-green-600 mb-3">선택 가능한 투수</h4>
          <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto border border-green-200 rounded-md p-2">
            {availablePitchers.length === 0 ? (
              <p className="col-span-2 text-gray-500 text-sm">선택 가능한 투수가 없습니다.</p>
            ) : (
              availablePitchers.map(player => (
                <button
                  key={player.id}
                  onClick={() => handleAddPitcher(player)}
                  className="bg-white p-2 rounded-md shadow-sm text-sm text-left hover:bg-green-100 transition duration-150 ease-in-out border border-gray-200"
                >
                  {player.name} ({player.position})
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 text-center">
        <button
          onClick={handleSaveLineup}
          className="py-3 px-8 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150 ease-in-out text-lg"
        >
          라인업 저장
        </button>
      </div>
    </div>
  );
};

// Simulate Game Page
const SimulateGamePage = () => {
  const { db, userId } = useContext(AppContext);
  const [myTeam, setMyTeam] = useState(null);
  const [opponentTeams, setOpponentTeams] = useState([]);
  const [selectedOpponentId, setSelectedOpponentId] = useState('');
  const [simulationResult, setSimulationResult] = useState(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    if (!db || !userId) return;

    // Use onSnapshot for real-time updates for my team and public teams
    const unsubscribeMyTeam = onSnapshot(query(collection(db, `artifacts/${appId}/users/${userId}/teams`), where("ownerId", "==", userId)), (snapshot) => {
        if (!snapshot.empty) {
            setMyTeam(snapshot.docs[0].data());
        } else {
            setMyTeam(null);
        }
        setLoading(false);
    }, (err) => {
        console.error("내 팀 데이터 실시간 업데이트 오류:", err);
        setMessage("내 팀 데이터 실시간 업데이트에 실패했습니다.");
        setMessageType('error');
        setLoading(false);
    });

    const unsubscribePublicTeams = onSnapshot(collection(db, `artifacts/${appId}/public/data/leagueTeams`), (snapshot) => {
        const allPublicTeams = snapshot.docs.map(doc => doc.data());
        const filteredOpponents = allPublicTeams.filter(team => team.ownerId !== userId);
        setOpponentTeams(filteredOpponents);
        if (filteredOpponents.length > 0 && !selectedOpponentId) {
            setSelectedOpponentId(filteredOpponents[0].id);
        }
        setLoading(false);
    }, (err) => {
        console.error("공개 팀 데이터 실시간 업데이트 오류:", err);
        setMessage("공개 팀 데이터 실시간 업데이트에 실패했습니다.");
        setMessageType('error');
        setLoading(false);
    });

    return () => {
        unsubscribeMyTeam();
        unsubscribePublicTeams();
    };
  }, [db, userId, selectedOpponentId]);

  const handleSimulateGame = async () => {
    if (!myTeam) {
      setMessage('팀 정보가 없습니다. 먼저 팀을 생성해주세요.');
      setMessageType('error');
      return;
    }
    if (!myTeam.lineupBatters || myTeam.lineupBatters.length !== 9 || !myTeam.lineupPitchers || myTeam.lineupPitchers.length === 0) {
      setMessage('라인업이 완성되지 않았습니다. 라인업 페이지에서 9명의 타자와 최소 1명의 투수를 선택해주세요.');
      setMessageType('error');
      return;
    }
    if (!selectedOpponentId) {
      setMessage('상대 팀을 선택해주세요.');
      setMessageType('error');
      return;
    }

    setSimulating(true);
    setMessage('');
    setMessageType('');
    setSimulationResult(null);

    try {
      const opponentTeam = opponentTeams.find(team => team.id === selectedOpponentId);
      if (!opponentTeam) {
        setMessage('선택된 상대 팀을 찾을 수 없습니다.');
        setMessageType('error');
        setSimulating(false);
        return;
      }

      // Simulate the game
      const result = simulateGame(myTeam, opponentTeam);
      setSimulationResult(result);

      // Update my team's record
      const myTeamRef = doc(db, `artifacts/${appId}/users/${userId}/teams`, myTeam.id);
      const myPublicTeamRef = doc(db, `artifacts/${appId}/public/data/leagueTeams`, myTeam.id);

      if (result.winner === myTeam.name) {
        await updateDoc(myTeamRef, { wins: myTeam.wins + 1 });
        await updateDoc(myPublicTeamRef, { wins: myTeam.wins + 1 });
      } else {
        await updateDoc(myTeamRef, { losses: myTeam.losses + 1 });
        await updateDoc(myPublicTeamRef, { losses: myTeam.losses + 1 });
      }

      // Update opponent team's record (if it's a user-owned team, otherwise just for public record)
      const opponentPublicTeamRef = doc(db, `artifacts/${appId}/public/data/leagueTeams`, opponentTeam.id);
      const opponentDoc = await getDoc(opponentPublicTeamRef);
      if (opponentDoc.exists()) {
        const opponentData = opponentDoc.data();
        if (result.winner === opponentTeam.name) {
          await updateDoc(opponentPublicTeamRef, { wins: opponentData.wins + 1 });
        } else {
          await updateDoc(opponentPublicTeamRef, { losses: opponentData.losses + 1 });
        }
      }


      // Save game result
      const gameId = generateUniqueId();
      const gameRef = doc(db, `artifacts/${appId}/public/data/games`, gameId);
      await setDoc(gameRef, {
        id: gameId,
        teamAId: myTeam.id,
        teamAName: myTeam.name,
        teamALogo: myTeam.logo,
        teamBId: opponentTeam.id,
        teamBName: opponentTeam.name,
        teamBLogo: opponentTeam.logo,
        teamAScore: result.teamAScore,
        teamBScore: result.teamBScore,
        summary: result.summaryText,
        winner: result.winner,
        timestamp: new Date(),
      });

      setMessage('경기가 성공적으로 시뮬레이션되었습니다!');
      setMessageType('success');
    } catch (error) {
      console.error("경기 시뮬레이션 오류:", error);
      setMessage('경기 시뮬레이션에 실패했습니다: ' + error.message);
      setMessageType('error');
    } finally {
      setSimulating(false);
    }
  };

  if (loading) return <div className="text-center py-8">로딩 중...</div>;
  if (!myTeam) return <div className="text-center py-8 text-gray-600">아직 팀이 없습니다. '팀 생성' 메뉴에서 팀을 만들어주세요.</div>;
  if (!myTeam.lineupBatters || myTeam.lineupBatters.length !== 9 || !myTeam.lineupPitchers || myTeam.lineupPitchers.length === 0) {
    return <div className="text-center py-8 text-red-600">경기 시뮬레이션을 시작하려면 라인업을 완성해야 합니다. '라인업' 메뉴에서 9명의 타자와 최소 1명의 투수를 선택해주세요.</div>;
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-indigo-700 mb-6 text-center">경기 시뮬레이션</h2>
      {message && (
        <div className={`p-3 mb-4 rounded-lg text-sm ${messageType === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {message}
        </div>
      )}

      <div className="bg-gray-50 p-6 rounded-xl shadow-inner mb-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">상대 팀 선택</h3>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-1 w-full sm:w-auto">
            <label htmlFor="opponentTeam" className="sr-only">상대 팀</label>
            <select
              id="opponentTeam"
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={selectedOpponentId}
              onChange={(e) => setSelectedOpponentId(e.target.value)}
            >
              {opponentTeams.length === 0 ? (
                <option value="">상대할 팀이 없습니다.</option>
              ) : (
                opponentTeams.map(team => (
                  <option key={team.id} value={team.id}>
                    {team.logo} {team.name} (ID: {team.ownerId})
                  </option>
                ))
              )}
            </select>
          </div>
          <button
            onClick={handleSimulateGame}
            className="py-2 px-6 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150 ease-in-out"
            disabled={simulating || opponentTeams.length === 0}
          >
            {simulating ? '경기 시뮬레이션 중...' : '경기 시작!'}
          </button>
        </div>
        {opponentTeams.length === 0 && (
          <p className="mt-4 text-sm text-gray-500 text-center">다른 사용자가 팀을 생성해야 상대할 팀이 생깁니다.</p>
        )}
      </div>

      {simulationResult && (
        <div className="bg-white p-6 rounded-xl shadow-lg mt-8">
          <h3 className="text-xl font-bold text-indigo-700 mb-4 text-center">경기 결과</h3>
          <div className="text-center text-2xl font-bold mb-4">
            <span className="text-indigo-800">{myTeam.name}</span> {simulationResult.teamAScore} : {simulationResult.teamBScore} <span className="text-gray-800">{opponentTeams.find(t => t.id === selectedOpponentId)?.name}</span>
          </div>
          <pre className="bg-gray-100 p-4 rounded-md text-sm whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">
            {simulationResult.summaryText}
          </pre>
        </div>
      )}
    </div>
  );
};

// Game Results Page
const GameResultsPage = () => {
  const { db } = useContext(AppContext);
  const [gameResults, setGameResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedGame, setSelectedGame] = useState(null);

  useEffect(() => {
    if (!db) return;

    const gamesCollectionRef = collection(db, `artifacts/${appId}/public/data/games`);
    const q = query(gamesCollectionRef); // No orderBy to avoid index issues

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const results = snapshot.docs.map(doc => doc.data());
      // Sort by timestamp in memory (descending)
      results.sort((a, b) => (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0));
      setGameResults(results);
      setLoading(false);
    }, (err) => {
      console.error("경기 결과 실시간 업데이트 오류:", err);
      setError("경기 결과를 불러오는 데 실패했습니다.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db]);

  if (loading) return <div className="text-center py-8">로딩 중...</div>;
  if (error) return <div className="text-center py-8 text-red-500">{error}</div>;
  if (gameResults.length === 0) return <div className="text-center py-8 text-gray-600">아직 시뮬레이션된 경기가 없습니다.</div>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-indigo-700 mb-6 text-center">경기 결과</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {gameResults.map(game => (
          <div
            key={game.id}
            className="bg-white p-4 rounded-lg shadow-md border border-gray-200 cursor-pointer hover:bg-gray-50 transition duration-150 ease-in-out"
            onClick={() => setSelectedGame(game)}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xl font-bold">{game.teamALogo} {game.teamAName}</span>
              <span className="text-xl font-bold text-gray-700"> {game.teamAScore} : {game.teamBScore} </span>
              <span className="text-xl font-bold">{game.teamBLogo} {game.teamBName}</span>
            </div>
            <p className="text-sm text-gray-500 text-center">
              {game.timestamp?.toDate().toLocaleString() || '날짜 없음'}
            </p>
            <p className="text-md font-semibold text-center mt-2">
                승리: <span className="text-green-600">{game.winner}</span>
            </p>
          </div>
        ))}
      </div>

      {selectedGame && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
            <button
              onClick={() => setSelectedGame(null)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 focus:outline-none"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h3 className="text-2xl font-bold text-indigo-700 mb-4 text-center">경기 상세 결과</h3>
            <div className="text-center text-3xl font-extrabold mb-4">
              <span className="text-indigo-800">{selectedGame.teamALogo} {selectedGame.teamAName}</span> {selectedGame.teamAScore} : {selectedGame.teamBScore} <span className="text-gray-800">{selectedGame.teamBLogo} {selectedGame.teamBName}</span>
            </div>
            <p className="text-sm text-gray-500 text-center mb-4">
              {selectedGame.timestamp?.toDate().toLocaleString() || '날짜 없음'}
            </p>
            <pre className="bg-gray-100 p-4 rounded-md text-sm whitespace-pre-wrap font-mono max-h-60 overflow-y-auto">
              {selectedGame.summary}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

// League Standings Page
const LeagueStandingsPage = () => {
  const { db } = useContext(AppContext);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!db) return;

    const publicTeamsCollectionRef = collection(db, `artifacts/${appId}/public/data/leagueTeams`);
    const q = query(publicTeamsCollectionRef); // No orderBy to avoid index issues

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedTeams = snapshot.docs.map(doc => doc.data());
      // Sort by wins (descending), then losses (ascending)
      fetchedTeams.sort((a, b) => {
        if (b.wins !== a.wins) {
          return b.wins - a.wins;
        }
        return a.losses - b.losses;
      });
      setTeams(fetchedTeams);
      setLoading(false);
    }, (err) => {
      console.error("리그 순위 실시간 업데이트 오류:", err);
      setError("리그 순위를 불러오는 데 실패했습니다.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db]);

  if (loading) return <div className="text-center py-8">로딩 중...</div>;
  if (error) return <div className="text-center py-8 text-red-500">{error}</div>;
  if (teams.length === 0) return <div className="text-center py-8 text-gray-600">아직 리그에 참여한 팀이 없습니다.</div>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-indigo-700 mb-6 text-center">리그 순위표</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white rounded-lg shadow-md">
          <thead>
            <tr className="bg-indigo-600 text-white">
              <th className="py-3 px-4 text-left text-sm font-semibold rounded-tl-lg">순위</th>
              <th className="py-3 px-4 text-left text-sm font-semibold">팀 이름</th>
              <th className="py-3 px-4 text-left text-sm font-semibold">소유자 ID</th>
              <th className="py-3 px-4 text-left text-sm font-semibold">승</th>
              <th className="py-3 px-4 text-left text-sm font-semibold rounded-tr-lg">패</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team, index) => (
              <tr key={team.id} className={`${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} border-b border-gray-200 last:border-b-0`}>
                <td className="py-3 px-4 text-sm">{index + 1}</td>
                <td className="py-3 px-4 text-sm font-medium flex items-center">
                  <span className="text-xl mr-2">{team.logo}</span> {team.name}
                </td>
                <td className="py-3 px-4 text-xs text-gray-600">{team.ownerId}</td>
                <td className="py-3 px-4 text-sm text-green-600 font-semibold">{team.wins}</td>
                <td className="py-3 px-4 text-sm text-red-600 font-semibold">{team.losses}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Player Market Page
const PlayerMarketPage = () => {
  const { db, userId } = useContext(AppContext);
  const [marketPlayers, setMarketPlayers] = useState([]);
  const [myTeam, setMyTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  useEffect(() => {
    if (!db || !userId) return;

    const unsubscribeMarket = onSnapshot(collection(db, `artifacts/${appId}/public/data/marketPlayers`), (snapshot) => {
      setMarketPlayers(snapshot.docs.map(doc => doc.data()));
      setLoading(false);
    }, (err) => {
      console.error("시장 선수 데이터 실시간 업데이트 오류:", err);
      setMessage("시장 선수 데이터를 불러오는 데 실패했습니다.");
      setMessageType('error');
      setLoading(false);
    });

    const unsubscribeMyTeam = onSnapshot(doc(db, `artifacts/${appId}/users/${userId}/teams`, userId), (docSnap) => {
      if (docSnap.exists()) {
        setMyTeam(docSnap.data());
      } else {
        setMyTeam(null);
      }
    }, (err) => {
      console.error("내 팀 데이터 실시간 업데이트 오류:", err);
      setMessage("내 팀 데이터를 불러오는 데 실패했습니다.");
      setMessageType('error');
    });

    return () => {
      unsubscribeMarket();
      unsubscribeMyTeam();
    };
  }, [db, userId]);

  const handleBuyPlayer = async (player) => {
    if (!myTeam) {
      setMessage('팀 정보가 없습니다. 먼저 팀을 생성해주세요.');
      setMessageType('error');
      return;
    }
    if (myTeam.currency < player.price) {
      setMessage('재화가 부족합니다!');
      setMessageType('error');
      return;
    }

    setMessage('');
    setMessageType('');

    // Use a Firestore transaction for atomicity
    try {
      await runTransaction(db, async (transaction) => {
        const buyerTeamRef = doc(db, `artifacts/${appId}/users/${userId}/teams`, myTeam.id);
        const marketPlayerRef = doc(db, `artifacts/${appId}/public/data/marketPlayers`, player.id);
        const sellerTeamRef = player.currentOwnerId ? doc(db, `artifacts/${appId}/users/${player.currentOwnerId}/teams`, player.currentOwnerId) : null;
        const buyerPlayersCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/players`);

        const buyerTeamDoc = await transaction.get(buyerTeamRef);
        const marketPlayerDoc = await transaction.get(marketPlayerRef);
        let sellerTeamDoc = null;
        if (sellerTeamRef) {
          sellerTeamDoc = await transaction.get(sellerTeamRef);
        }

        if (!buyerTeamDoc.exists() || !marketPlayerDoc.exists()) {
          throw "거래에 필요한 문서가 없습니다.";
        }

        const currentBuyerCurrency = buyerTeamDoc.data().currency || 0;
        const playerPrice = marketPlayerDoc.data().price;

        if (currentBuyerCurrency < playerPrice) {
          throw "재화가 부족합니다!";
        }

        // Update buyer's currency
        transaction.update(buyerTeamRef, { currency: currentBuyerCurrency - playerPrice });

        // Add player to buyer's roster
        transaction.set(doc(buyerPlayersCollectionRef, player.id), {
          id: player.id,
          name: player.name,
          position: player.position,
          batting_avg: player.batting_avg,
          era: player.era,
        });

        // Update seller's currency if there's a seller
        if (sellerTeamRef && sellerTeamDoc && sellerTeamDoc.exists()) {
          const currentSellerCurrency = sellerTeamDoc.data().currency || 0;
          transaction.update(sellerTeamRef, { currency: currentSellerCurrency + playerPrice });
        }

        // Delete player from market
        transaction.delete(marketPlayerRef);
      });

      setMessage(`${player.name} 선수를 성공적으로 구매했습니다!`);
      setMessageType('success');
    } catch (error) {
      console.error("선수 구매 오류:", error);
      setMessage('선수 구매에 실패했습니다: ' + error.message);
      setMessageType('error');
    }
  };

  if (loading) return <div className="text-center py-8">로딩 중...</div>;
  if (message) {
    setTimeout(() => setMessage(''), 3000); // Clear message after 3 seconds
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-indigo-700 mb-6 text-center">선수 시장</h2>
      {message && (
        <div className={`p-3 mb-4 rounded-lg text-sm ${messageType === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {message}
        </div>
      )}
      {myTeam && (
        <div className="text-right mb-4 text-lg font-semibold text-gray-800">
          내 재화: <span className="text-yellow-600">{myTeam.currency || 0}</span>
        </div>
      )}

      {marketPlayers.length === 0 ? (
        <p className="text-center text-gray-600 py-8">현재 시장에 등록된 선수가 없습니다.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {marketPlayers.map(player => (
            <div key={player.id} className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
              <p className="text-lg font-semibold text-gray-800">{player.name}</p>
              <p className="text-sm text-gray-600">포지션: {player.position}</p>
              {player.position === '투수' ? (
                <p className="text-sm text-gray-600">ERA: {player.era.toFixed(2)}</p>
              ) : (
                <p className="text-sm text-gray-600">타율: {player.batting_avg.toFixed(3)}</p>
              )}
              <p className="text-md font-bold text-yellow-700 mt-2">가격: {player.price}</p>
              <p className="text-xs text-gray-500">판매자 ID: {player.currentOwnerId}</p>
              {player.currentOwnerId !== userId && ( // Cannot buy your own listed player
                <button
                  onClick={() => handleBuyPlayer(player)}
                  className="mt-3 w-full py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                  구매하기
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default App;
