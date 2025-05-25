import React, { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';

// Firebase 및 사용자 정보를 위한 컨텍스트
const FirebaseContext = createContext(null);

const App = () => {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [teamId, setTeamId] = useState(null); // 현재 사용자의 팀 ID
    const [currentPage, setCurrentPage] = useState('auth'); // auth, teamCreation, dashboard, lineup, simulate, results, standings
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState(''); // 사용자 메시지/알림용

    // Canvas 환경에서 제공되는 전역 변수
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
    const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

    useEffect(() => {
        const initFirebase = async () => {
            try {
                const app = initializeApp(firebaseConfig);
                const firestoreDb = getFirestore(app);
                const firebaseAuth = getAuth(app);

                setDb(firestoreDb);
                setAuth(firebaseAuth);

                // 인증 상태 변경 감지
                const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
                    if (user) {
                        setUserId(user.uid);
                        // 사용자가 팀을 가지고 있는지 확인
                        const q = query(collection(firestoreDb, `artifacts/${appId}/users/${user.uid}/teams`), where("ownerId", "==", user.uid));
                        const teamSnap = await getDocs(q);
                        if (!teamSnap.empty) {
                            setTeamId(teamSnap.docs[0].id);
                            setCurrentPage('dashboard');
                        } else {
                            setCurrentPage('teamCreation');
                        }
                    } else {
                        setUserId(null);
                        setTeamId(null);
                        setCurrentPage('auth');
                    }
                    setLoading(false);
                });

                // 커스텀 토큰으로 로그인 또는 익명 로그인
                if (initialAuthToken) {
                    await signInWithCustomToken(firebaseAuth, initialAuthToken);
                } else {
                    await signInAnonymously(firebaseAuth);
                }

                return () => unsubscribe(); // 리스너 정리
            } catch (error) {
                console.error("Firebase 초기화 실패:", error);
                setMessage(`오류: ${error.message}`);
                setLoading(false);
            }
        };

        initFirebase();
    }, []);

    const showMessage = (msg, type = 'info') => {
        setMessage(msg);
        setTimeout(() => setMessage(''), 3000); // 3초 후 메시지 지우기
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
                <div className="text-lg font-semibold">Baseball GM 로딩 중...</div>
            </div>
        );
    }

    return (
        <FirebaseContext.Provider value={{ db, auth, userId, teamId, setTeamId, setCurrentPage, showMessage, appId }}>
            <div className="min-h-screen bg-gray-900 text-gray-100 font-inter">
                <header className="bg-gray-800 p-4 shadow-md flex justify-between items-center">
                    <h1 className="text-3xl font-bold text-blue-400">Baseball GM</h1>
                    {userId && (
                        <nav className="flex space-x-4">
                            <button onClick={() => setCurrentPage('dashboard')} className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 transition duration-200">대시보드</button>
                            <button onClick={() => setCurrentPage('lineup')} className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 transition duration-200">라인업</button>
                            <button onClick={() => setCurrentPage('simulate')} className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 transition duration-200">경기 시뮬레이션</button>
                            <button onClick={() => setCurrentPage('results')} className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 transition duration-200">경기 결과</button>
                            <button onClick={() => setCurrentPage('standings')} className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 transition duration-200">리그 순위</button>
                            <button onClick={async () => { await signOut(auth); showMessage('성공적으로 로그아웃되었습니다!', 'success'); }} className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 transition duration-200">로그아웃</button>
                        </nav>
                    )}
                </header>

                <main className="p-6">
                    {message && (
                        <div className="bg-blue-500 text-white p-3 rounded-md mb-4 text-center">
                            {message}
                        </div>
                    )}
                    {(() => {
                        switch (currentPage) {
                            case 'auth':
                                return <Auth />;
                            case 'teamCreation':
                                return <TeamCreation />;
                            case 'dashboard':
                                return <Dashboard />;
                            case 'lineup':
                                return <LineupEditor />;
                            case 'simulate':
                                return <GameSimulation />;
                            case 'results':
                                return <GameResults />;
                            case 'standings':
                                return <LeagueStandings />;
                            default:
                                return <Auth />;
                        }
                    })()}
                </main>
            </div>
        </FirebaseContext.Provider>
    );
};

const Auth = () => {
    const { auth, setCurrentPage, showMessage } = useContext(FirebaseContext);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSignUp = async () => {
        try {
            await createUserWithEmailAndPassword(auth, email, password);
            showMessage('성공적으로 가입되었습니다! 팀을 생성해주세요.', 'success');
            // setCurrentPage는 onAuthStateChanged 리스너에 의해 처리됩니다.
        } catch (error) {
            console.error("가입 오류:", error);
            showMessage(`가입 실패: ${error.message}`, 'error');
        }
    };

    const handleSignIn = async () => {
        try {
            await signInWithEmailAndPassword(auth, email, password);
            showMessage('성공적으로 로그인되었습니다!', 'success');
            // setCurrentPage는 onAuthStateChanged 리스너에 의해 처리됩니다.
        } catch (error) {
            console.error("로그인 오류:", error);
            showMessage(`로그인 실패: ${error.message}`, 'error');
        }
    };

    return (
        <div className="max-w-md mx-auto bg-gray-800 p-8 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold text-center mb-6 text-blue-300">로그인 / 회원가입</h2>
            <div className="mb-4">
                <label className="block text-gray-300 text-sm font-bold mb-2" htmlFor="email">
                    이메일
                </label>
                <input
                    type="email"
                    id="email"
                    className="shadow appearance-none border rounded-md w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-700 border-gray-600 text-white"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                />
            </div>
            <div className="mb-6">
                <label className="block text-gray-300 text-sm font-bold mb-2" htmlFor="password">
                    비밀번호
                </label>
                <input
                    type="password"
                    id="password"
                    className="shadow appearance-none border rounded-md w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline bg-gray-700 border-gray-600 text-white"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="********"
                />
            </div>
            <div className="flex items-center justify-between">
                <button
                    onClick={handleSignIn}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md focus:outline-none focus:shadow-outline transition duration-200"
                >
                    로그인
                </button>
                <button
                    onClick={handleSignUp}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md focus:outline-none focus:shadow-outline transition duration-200"
                >
                    회원가입
                </button>
            </div>
        </div>
    );
};

const TeamCreation = () => {
    const { db, userId, setTeamId, setCurrentPage, showMessage, appId } = useContext(FirebaseContext);
    const [teamName, setTeamName] = useState('');
    const [teamLocation, setTeamLocation] = useState('');
    const [teamLogoUrl, setTeamLogoUrl] = useState('');

    const handleCreateTeam = async () => {
        if (!teamName || !teamLocation) {
            showMessage('팀 이름과 연고지는 필수입니다!', 'error');
            return;
        }
        if (!userId) {
            showMessage('팀을 생성하려면 로그인해야 합니다.', 'error');
            return;
        }

        try {
            const teamsRef = collection(db, `artifacts/${appId}/users/${userId}/teams`);
            const newTeamRef = await addDoc(teamsRef, {
                name: teamName,
                location: teamLocation,
                logoUrl: teamLogoUrl || 'https://placehold.co/100x100/000000/FFFFFF?text=Team',
                ownerId: userId,
                wins: 0,
                losses: 0,
                lineup: [], // 선수 ID 저장
                pitcher: null, // 투수 ID 저장
                createdAt: new Date().toISOString(),
            });
            setTeamId(newTeamRef.id);
            showMessage('팀이 성공적으로 생성되었습니다!', 'success');

            // 새 팀을 위한 리그 순위표 초기화
            const leagueStandingsRef = doc(db, `artifacts/${appId}/public/data/leagueStandings`, newTeamRef.id);
            await setDoc(leagueStandingsRef, {
                teamId: newTeamRef.id,
                teamName: teamName,
                wins: 0,
                losses: 0,
                ownerId: userId, // 공개 데이터를 위해 소유자 추적
            });

            // 새 팀을 위한 초기 선수 생성
            await seedPlayers(newTeamRef.id, userId, db, appId);

            setCurrentPage('dashboard');
        } catch (error) {
            console.error("팀 생성 오류:", error);
            showMessage(`팀 생성 오류: ${error.message}`, 'error');
        }
    };

    const seedPlayers = async (teamId, userId, dbInstance, appId) => {
        const playersRef = collection(dbInstance, `artifacts/${appId}/users/${userId}/players`);
        const positions = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
        const playerNames = [
            "Mike Trout", "Shohei Ohtani", "Aaron Judge", "Mookie Betts", "Ronald Acuña Jr.",
            "Fernando Tatis Jr.", "Juan Soto", "Vladimir Guerrero Jr.", "Gerrit Cole", "Jacob deGrom",
            "Clayton Kershaw", "Justin Verlander", "Max Scherzer", "Freddie Freeman", "Jose Ramirez",
            "Manny Machado", "Trea Turner", "Francisco Lindor", "Corey Seager", "Xander Bogaerts"
        ];

        const dummyPlayers = playerNames.map((name, index) => ({
            name: name,
            position: positions[index % positions.length],
            batting: Math.floor(Math.random() * 50) + 50, // 50-99
            pitching: positions[index % positions.length] === 'P' ? Math.floor(Math.random() * 50) + 50 : 0, // P는 50-99, 나머지는 0
            defense: Math.floor(Math.random() * 50) + 50, // 50-99
            teamId: teamId,
            ownerId: userId,
            createdAt: new Date().toISOString(),
        }));

        for (const player of dummyPlayers) {
            await addDoc(playersRef, player);
        }
        showMessage('초기 선수들이 팀에 추가되었습니다!', 'info');
    };

    return (
        <div className="max-w-md mx-auto bg-gray-800 p-8 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold text-center mb-6 text-blue-300">팀 생성</h2>
            <div className="mb-4">
                <label className="block text-gray-300 text-sm font-bold mb-2" htmlFor="teamName">
                    팀 이름
                </label>
                <input
                    type="text"
                    id="teamName"
                    className="shadow appearance-none border rounded-md w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-700 border-gray-600 text-white"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="예: 부산 드래곤즈"
                />
            </div>
            <div className="mb-4">
                <label className="block text-gray-300 text-sm font-bold mb-2" htmlFor="teamLocation">
                    팀 연고지
                </label>
                <input
                    type="text"
                    id="teamLocation"
                    className="shadow appearance-none border rounded-md w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-700 border-gray-600 text-white"
                    value={teamLocation}
                    onChange={(e) => setTeamLocation(e.target.value)}
                    placeholder="예: 부산"
                />
            </div>
            <div className="mb-6">
                <label className="block text-gray-300 text-sm font-bold mb-2" htmlFor="teamLogoUrl">
                    팀 로고 URL (선택 사항)
                </label>
                <input
                    type="text"
                    id="teamLogoUrl"
                    className="shadow appearance-none border rounded-md w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-700 border-gray-600 text-white"
                    value={teamLogoUrl}
                    onChange={(e) => setTeamLogoUrl(e.target.value)}
                    placeholder="예: https://example.com/logo.png"
                />
            </div>
            <div className="flex items-center justify-center">
                <button
                    onClick={handleCreateTeam}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-md focus:outline-none focus:shadow-outline transition duration-200"
                >
                    팀 생성
                </button>
            </div>
        </div>
    );
};

const Dashboard = () => {
    const { db, userId, teamId, showMessage, appId } = useContext(FirebaseContext);
    const [team, setTeam] = useState(null);
    const [players, setPlayers] = useState([]);

    useEffect(() => {
        if (!db || !userId || !teamId) return;

        // 팀 데이터 감지
        const teamDocRef = doc(db, `artifacts/${appId}/users/${userId}/teams`, teamId);
        const unsubscribeTeam = onSnapshot(teamDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setTeam({ id: docSnap.id, ...docSnap.data() });
            } else {
                setTeam(null);
                showMessage('팀을 찾을 수 없습니다. 하나를 생성해주세요.', 'error');
            }
        }, (error) => {
            console.error("팀 가져오기 오류:", error);
            showMessage(`팀 가져오기 오류: ${error.message}`, 'error');
        });

        // 선수 감지
        const playersColRef = collection(db, `artifacts/${appId}/users/${userId}/players`);
        const q = query(playersColRef, where("teamId", "==", teamId));
        const unsubscribePlayers = onSnapshot(q, (snapshot) => {
            const fetchedPlayers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPlayers(fetchedPlayers);
        }, (error) => {
            console.error("선수 가져오기 오류:", error);
            showMessage(`선수 가져오기 오류: ${error.message}`, 'error');
        });

        return () => {
            unsubscribeTeam();
            unsubscribePlayers();
        };
    }, [db, userId, teamId, appId, showMessage]);

    if (!team) {
        return <div className="text-center text-gray-400">팀 데이터 로딩 중...</div>;
    }

    return (
        <div className="max-w-4xl mx-auto bg-gray-800 p-8 rounded-lg shadow-lg">
            <h2 className="text-3xl font-bold text-center mb-6 text-blue-300">{team.name} ({team.location})</h2>
            <div className="flex flex-col md:flex-row items-center justify-center mb-6 space-y-4 md:space-y-0 md:space-x-8">
                <img src={team.logoUrl} alt={`${team.name} 로고`} className="w-24 h-24 rounded-full border-2 border-blue-400 object-cover" onError={(e) => e.target.src = 'https://placehold.co/100x100/000000/FFFFFF?text=Team'} />
                <div className="text-center md:text-left">
                    <p className="text-xl font-semibold text-gray-200">승: <span className="text-green-400">{team.wins}</span></p>
                    <p className="text-xl font-semibold text-gray-200">패: <span className="text-red-400">{team.losses}</span></p>
                    <p className="text-sm text-gray-400 mt-2">GM 사용자 ID: <span className="font-mono text-xs">{userId}</span></p>
                </div>
            </div>

            <h3 className="text-2xl font-bold mb-4 text-blue-300">팀 로스터 ({players.length} 선수)</h3>
            {players.length === 0 ? (
                <p className="text-gray-400 text-center">아직 로스터에 선수가 없습니다. 라인업에서 관리하세요.</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {players.map(player => (
                        <div key={player.id} className="bg-gray-700 p-4 rounded-md shadow-md">
                            <h4 className="text-lg font-semibold text-blue-200">{player.name}</h4>
                            <p className="text-gray-300">포지션: <span className="font-medium">{player.position}</span></p>
                            <p className="text-gray-300">타격: <span className="font-medium">{player.batting}</span></p>
                            <p className="text-gray-300">투구: <span className="font-medium">{player.pitching}</span></p>
                            <p className="text-gray-300">수비: <span className="font-medium">{player.defense}</span></p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const LineupEditor = () => {
    const { db, userId, teamId, showMessage, appId } = useContext(FirebaseContext);
    const [players, setPlayers] = useState([]);
    const [team, setTeam] = useState(null);
    const [battingLineup, setBattingLineup] = useState([]);
    const [pitcher, setPitcher] = useState(null);

    useEffect(() => {
        if (!db || !userId || !teamId) return;

        // 기존 라인업을 가져오기 위해 팀 데이터 가져오기
        const teamDocRef = doc(db, `artifacts/${appId}/users/${userId}/teams`, teamId);
        const unsubscribeTeam = onSnapshot(teamDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const teamData = { id: docSnap.id, ...docSnap.data() };
                setTeam(teamData);
                setBattingLineup(teamData.lineup || []);
                setPitcher(teamData.pitcher || null);
            }
        });

        // 팀의 모든 선수 가져오기
        const playersColRef = collection(db, `artifacts/${appId}/users/${userId}/players`);
        const q = query(playersColRef, where("teamId", "==", teamId));
        const unsubscribePlayers = onSnapshot(q, (snapshot) => {
            const fetchedPlayers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPlayers(fetchedPlayers);
        });

        return () => {
            unsubscribeTeam();
            unsubscribePlayers();
        };
    }, [db, userId, teamId, appId]);

    const handleAddPlayerToLineup = (player) => {
        if (battingLineup.length < 9 && !battingLineup.some(p => p.id === player.id) && pitcher?.id !== player.id) {
            setBattingLineup([...battingLineup, player]);
        } else {
            showMessage('라인업이 가득 찼거나 (9명) 선수가 이미 라인업/투수에 있습니다.', 'warning');
        }
    };

    const handleRemovePlayerFromLineup = (playerId) => {
        setBattingLineup(battingLineup.filter(p => p.id !== playerId));
    };

    const handleSetPitcher = (player) => {
        if (player.position === 'P' && !battingLineup.some(p => p.id === player.id)) {
            setPitcher(player);
        } else {
            showMessage('투수만 투수로 설정할 수 있으며, 타격 라인업에 있을 수 없습니다.', 'warning');
        }
    };

    const handleClearPitcher = () => {
        setPitcher(null);
    };

    const handleSaveLineup = async () => {
        if (battingLineup.length !== 9 || !pitcher) {
            showMessage('라인업을 저장하려면 정확히 9명의 타자와 1명의 투수가 필요합니다.', 'error');
            return;
        }
        if (!db || !userId || !teamId) {
            showMessage('데이터베이스가 준비되지 않았습니다.', 'error');
            return;
        }

        try {
            const teamDocRef = doc(db, `artifacts/${appId}/users/${userId}/teams`, teamId);
            await updateDoc(teamDocRef, {
                lineup: battingLineup.map(p => p.id), // 선수 ID만 저장
                pitcher: pitcher.id, // 투수 ID만 저장
            });
            showMessage('라인업이 성공적으로 저장되었습니다!', 'success');
        } catch (error) {
            console.error("라인업 저장 오류:", error);
            showMessage(`라인업 저장 오류: ${error.message}`, 'error');
        }
    };

    const availablePlayers = players.filter(p =>
        !battingLineup.some(lp => lp.id === p.id) &&
        (pitcher ? pitcher.id !== p.id : true)
    );

    return (
        <div className="max-w-5xl mx-auto bg-gray-800 p-8 rounded-lg shadow-lg">
            <h2 className="text-3xl font-bold text-center mb-6 text-blue-300">라인업 편집기</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* 현재 라인업 */}
                <div>
                    <h3 className="text-2xl font-bold mb-4 text-blue-200">현재 타격 라인업 (9명)</h3>
                    <div className="bg-gray-700 p-4 rounded-md min-h-[250px]">
                        {battingLineup.length === 0 ? (
                            <p className="text-gray-400">라인업에 선수를 추가하세요.</p>
                        ) : (
                            <ul className="space-y-2">
                                {battingLineup.map((player, index) => (
                                    <li key={player.id} className="flex justify-between items-center bg-gray-600 p-2 rounded-md">
                                        <span className="font-semibold">{index + 1}. {player.name} ({player.position})</span>
                                        <button
                                            onClick={() => handleRemovePlayerFromLineup(player.id)}
                                            className="bg-red-500 hover:bg-red-600 text-white text-xs px-2 py-1 rounded-md transition duration-200"
                                        >
                                            제거
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <h3 className="text-2xl font-bold mt-6 mb-4 text-blue-200">현재 투수 (1명)</h3>
                    <div className="bg-gray-700 p-4 rounded-md min-h-[100px]">
                        {pitcher ? (
                            <div className="flex justify-between items-center bg-gray-600 p-2 rounded-md">
                                <span className="font-semibold">{pitcher.name} ({pitcher.position})</span>
                                <button
                                    onClick={handleClearPitcher}
                                    className="bg-red-500 hover:bg-red-600 text-white text-xs px-2 py-1 rounded-md transition duration-200"
                                >
                                    지우기
                                </button>
                            </div>
                        ) : (
                            <p className="text-gray-400">투수를 선택하세요.</p>
                        )}
                    </div>

                    <div className="mt-6 text-center">
                        <button
                            onClick={handleSaveLineup}
                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-md focus:outline-none focus:shadow-outline transition duration-200"
                        >
                            라인업 저장
                        </button>
                    </div>
                </div>

                {/* 사용 가능한 선수 */}
                <div>
                    <h3 className="text-2xl font-bold mb-4 text-blue-200">사용 가능한 선수 ({availablePlayers.length}명)</h3>
                    <div className="bg-gray-700 p-4 rounded-md max-h-[500px] overflow-y-auto">
                        {availablePlayers.length === 0 ? (
                            <p className="text-gray-400">추가할 수 있는 선수가 없습니다.</p>
                        ) : (
                            <ul className="space-y-2">
                                {availablePlayers.map(player => (
                                    <li key={player.id} className="bg-gray-600 p-2 rounded-md flex justify-between items-center">
                                        <div>
                                            <span className="font-semibold">{player.name}</span> ({player.position})
                                            <span className="block text-xs text-gray-400">타격: {player.batting}, 투구: {player.pitching}, 수비: {player.defense}</span>
                                        </div>
                                        <div className="space-x-2">
                                            <button
                                                onClick={() => handleAddPlayerToLineup(player)}
                                                className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-2 py-1 rounded-md transition duration-200"
                                            >
                                                라인업에 추가
                                            </button>
                                            {player.position === 'P' && (
                                                <button
                                                    onClick={() => handleSetPitcher(player)}
                                                    className="bg-purple-500 hover:bg-purple-600 text-white text-xs px-2 py-1 rounded-md transition duration-200"
                                                >
                                                    투수로 설정
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};


const GameSimulation = () => {
    const { db, userId, teamId, showMessage, appId } = useContext(FirebaseContext);
    const [myTeam, setMyTeam] = useState(null);
    const [myPlayers, setMyPlayers] = useState([]);
    const [opponentTeams, setOpponentTeams] = useState([]);
    const [selectedOpponentId, setSelectedOpponentId] = useState('');
    const [simulationResult, setSimulationResult] = useState(null);
    const [isSimulating, setIsSimulating] = useState(false);

    useEffect(() => {
        if (!db || !userId || !teamId) return;

        // 내 팀과 선수 가져오기
        const teamDocRef = doc(db, `artifacts/${appId}/users/${userId}/teams`, teamId);
        const unsubscribeMyTeam = onSnapshot(teamDocRef, async (docSnap) => {
            if (docSnap.exists()) {
                const teamData = { id: docSnap.id, ...docSnap.data() };
                setMyTeam(teamData);

                // 라인업 및 투수를 위한 전체 선수 객체 가져오기
                if (teamData.lineup && teamData.lineup.length > 0) {
                    const playerPromises = teamData.lineup.map(async (playerId) => {
                        const playerDocRef = doc(db, `artifacts/${appId}/users/${userId}/players`, playerId);
                        const playerSnap = await getDoc(playerDocRef);
                        return playerSnap.exists() ? { id: playerSnap.id, ...playerSnap.data() } : null;
                    });
                    const fetchedLineupPlayers = (await Promise.all(playerPromises)).filter(Boolean);
                    teamData.fullLineup = fetchedLineupPlayers;
                }

                if (teamData.pitcher) {
                    const pitcherDocRef = doc(db, `artifacts/${appId}/users/${userId}/players`, teamData.pitcher);
                    const pitcherSnap = await getDoc(pitcherDocRef);
                    teamData.fullPitcher = pitcherSnap.exists() ? { id: pitcherSnap.id, ...pitcherSnap.data() } : null;
                }
                setMyTeam(teamData);
            }
        });

        // 다른 모든 팀 (공개 데이터) 가져오기
        const publicTeamsColRef = collection(db, `artifacts/${appId}/public/data/leagueStandings`);
        const unsubscribeOpponents = onSnapshot(publicTeamsColRef, (snapshot) => {
            const teams = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(team => team.id !== teamId); // 내 팀 제외
            setOpponentTeams(teams);
            if (teams.length > 0 && !selectedOpponentId) {
                setSelectedOpponentId(teams[0].id); // 기본적으로 첫 번째 상대팀 선택
            }
        });

        return () => {
            unsubscribeMyTeam();
            unsubscribeOpponents();
        };
    }, [db, userId, teamId, appId, selectedOpponentId]);

    const simulateGame = async () => {
        if (!myTeam || !myTeam.fullLineup || myTeam.fullLineup.length !== 9 || !myTeam.fullPitcher) {
            showMessage('팀 라인업 또는 투수가 올바르게 설정되지 않았습니다. 라인업 편집기로 이동하세요.', 'error');
            return;
        }
        if (!selectedOpponentId) {
            showMessage('상대팀을 선택해주세요.', 'error');
            return;
        }

        setIsSimulating(true);
        setSimulationResult(null);

        try {
            // 상대팀의 전체 팀 데이터 가져오기 (공개 팀이 선수를 가져올 수 있다고 가정)
            // 간단하게, 여기서는 더미 상대 라인업을 사용하거나 공개 팀이 기본 스탯을 가지고 있다고 가정합니다.
            // 실제 앱에서는 상대팀이 사용자일 경우, 그들의 비공개 데이터에서 실제 라인업/투수를 가져와야 합니다.
            // 이 시뮬레이션에서는 평균 스탯을 기반으로 더미 상대 라인업을 생성합니다.

            const opponentTeamDoc = await getDoc(doc(db, `artifacts/${appId}/public/data/leagueStandings`, selectedOpponentId));
            if (!opponentTeamDoc.exists()) {
                showMessage('선택한 상대팀을 찾을 수 없습니다.', 'error');
                setIsSimulating(false);
                return;
            }
            const opponentTeamData = opponentTeamDoc.data();

            // --- 간소화된 게임 로직 (JS로 Python 로직 모방) ---
            const myTeamOverallBatting = myTeam.fullLineup.reduce((sum, p) => sum + p.batting, 0) / 9;
            const myTeamOverallPitching = myTeam.fullPitcher.pitching;
            const myTeamOverallDefense = myTeam.fullLineup.reduce((sum, p) => sum + p.defense, 0) / 9;

            // 시뮬레이션을 위한 더미 상대 스탯 생성
            // 실제 앱에서는 실제 상대 선수/스탯을 가져와야 합니다.
            const opponentOverallBatting = Math.floor(Math.random() * 30) + 60; // 60-89
            const opponentOverallPitching = Math.floor(Math.random() * 30) + 60; // 60-89
            const opponentOverallDefense = Math.floor(Math.random() * 30) + 60; // 60-89

            let myScore = 0;
            let opponentScore = 0;
            let gameSummary = [];

            gameSummary.push(`--- 경기 시작: ${myTeam.name} vs ${opponentTeamData.teamName} ---`);

            for (let inning = 1; inning <= 9; inning++) {
                let myInningRuns = 0;
                let opponentInningRuns = 0;

                // 내 팀의 타격 순서
                // 내 타격 vs 상대 투구/수비에 따른 기본 득점
                const myBattingFactor = myTeamOverallBatting / 100;
                const oppPitchingDefenseFactor = (opponentOverallPitching + opponentOverallDefense) / 200;
                const myExpectedRuns = Math.max(0, (myBattingFactor * 3) - (oppPitchingDefenseFactor * 1.5)); // 원하는 범위에 맞게 승수 조정
                myInningRuns = Math.min(2, Math.floor(Math.random() * (myExpectedRuns + 1.5))); // 0-2점, 스탯 영향

                // 상대팀의 타격 순서
                // 상대 타격 vs 내 투구/수비에 따른 기본 득점
                const oppBattingFactor = opponentOverallBatting / 100;
                const myPitchingDefenseFactor = (myTeamOverallPitching + myTeamOverallDefense) / 200;
                const oppExpectedRuns = Math.max(0, (oppBattingFactor * 3) - (myPitchingDefenseFactor * 1.5));
                opponentInningRuns = Math.min(2, Math.floor(Math.random() * (oppExpectedRuns + 1.5))); // 0-2점, 스탯 영향

                myScore += myInningRuns;
                opponentScore += opponentInningRuns;

                gameSummary.push(`이닝 ${inning}: ${myTeam.name} ${myInningRuns} - ${opponentTeamData.teamName} ${opponentInningRuns}`);
            }

            let winnerId = null;
            let loserId = null;
            let winnerName = "";
            let loserName = "";

            if (myScore > opponentScore) {
                winnerId = myTeam.id;
                loserId = selectedOpponentId;
                winnerName = myTeam.name;
                loserName = opponentTeamData.teamName;
                gameSummary.push(`${myTeam.name} 승리!`);
            } else if (opponentScore > myScore) {
                winnerId = selectedOpponentId;
                loserId = myTeam.id;
                winnerName = opponentTeamData.teamName;
                loserName = myTeam.name;
                gameSummary.push(`${opponentTeamData.teamName} 승리!`);
            } else {
                // 동점 (연장전) - 간단하게 지금은 동점으로 처리
                // 실제 게임에서는 연장전 로직을 추가해야 합니다.
                gameSummary.push("동점 경기입니다! (연장전 시뮬레이션되지 않음)");
                // 간단하게, 동점일 경우 순위표에서는 둘 다 패배로 간주합니다.
                winnerId = null; // 승자 없음
                loserId = myTeam.id; // 순위표 목적상 둘 다 패배
                winnerName = "동점";
                loserName = "동점";
            }

            gameSummary.push(`최종 점수: ${myTeam.name} ${myScore} - ${opponentTeamData.teamName} ${opponentScore}`);
            gameSummary.push(`--- 경기 종료 ---`);

            const result = {
                teamA: myTeam.name,
                teamB: opponentTeamData.teamName,
                scoreA: myScore,
                scoreB: opponentScore,
                summary: gameSummary.join('\n'),
                winnerId: winnerId,
                loserId: loserId,
                gameDate: new Date().toISOString(),
            };

            setSimulationResult(result);

            // Firestore에 경기 결과 저장
            const gamesRef = collection(db, `artifacts/${appId}/users/${userId}/games`);
            await addDoc(gamesRef, {
                myTeamId: myTeam.id,
                opponentTeamId: selectedOpponentId,
                myTeamName: myTeam.name,
                opponentTeamName: opponentTeamData.teamName,
                myScore: myScore,
                opponentScore: opponentScore,
                summary: result.summary,
                winnerId: winnerId,
                loserId: loserId,
                gameDate: result.gameDate,
                ownerId: userId,
            });

            // 리그 순위표 업데이트
            const myTeamStandingsRef = doc(db, `artifacts/${appId}/public/data/leagueStandings`, myTeam.id);
            const opponentTeamStandingsRef = doc(db, `artifacts/${appId}/public/data/leagueStandings`, selectedOpponentId);

            await updateDoc(myTeamStandingsRef, {
                wins: myScore > opponentScore ? myTeam.wins + 1 : myTeam.wins,
                losses: myScore < opponentScore ? myTeam.losses + 1 : myTeam.losses,
            });

            await updateDoc(opponentTeamStandingsRef, {
                wins: opponentScore > myScore ? opponentTeamData.wins + 1 : opponentTeamData.wins,
                losses: opponentScore < myScore ? opponentTeamData.losses + 1 : opponentTeamData.losses,
            });

            // 대시보드 표시를 위해 사용자 비공개 팀 문서의 승/패도 업데이트
            const myPrivateTeamDocRef = doc(db, `artifacts/${appId}/users/${userId}/teams`, myTeam.id);
            await updateDoc(myPrivateTeamDocRef, {
                wins: myScore > opponentScore ? myTeam.wins + 1 : myTeam.wins,
                losses: myScore < opponentScore ? myTeam.losses + 1 : myTeam.losses,
            });


            showMessage('경기가 시뮬레이션되고 결과가 저장되었습니다!', 'success');

        } catch (error) {
            console.error("경기 시뮬레이션 중 오류:", error);
            showMessage(`경기 시뮬레이션 오류: ${error.message}`, 'error');
        } finally {
            setIsSimulating(false);
        }
    };

    if (!myTeam) {
        return <div className="text-center text-gray-400">팀 데이터 로딩 중...</div>;
    }

    if (!myTeam.fullLineup || myTeam.fullLineup.length !== 9 || !myTeam.fullPitcher) {
        return (
            <div className="max-w-xl mx-auto bg-gray-800 p-8 rounded-lg shadow-lg text-center">
                <h2 className="text-2xl font-bold mb-4 text-red-400">라인업이 설정되지 않았습니다!</h2>
                <p className="text-gray-300 mb-4">게임을 시뮬레이션하기 전에 "라인업" 섹션으로 이동하여 9명의 타자와 1명의 투수를 설정해주세요.</p>
                <button
                    onClick={() => showMessage('라인업 편집기로 리디렉션 중...', 'info')} // 이 메시지는 표시되지만, 보안상의 이유로 setCurrentPage는 이 컴포넌트에서 직접 사용할 수 없습니다.
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition duration-200"
                >
                    라인업 편집기로 이동
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto bg-gray-800 p-8 rounded-lg shadow-lg">
            <h2 className="text-3xl font-bold text-center mb-6 text-blue-300">경기 시뮬레이션</h2>

            <div className="mb-6">
                <p className="text-xl font-semibold text-gray-200 mb-2">내 팀: <span className="text-blue-400">{myTeam.name}</span></p>
                <p className="text-gray-300">타격 라인업: {myTeam.fullLineup.map(p => p.name).join(', ')}</p>
                <p className="text-gray-300">선발 투수: {myTeam.fullPitcher.name}</p>
            </div>

            <div className="mb-6">
                <label htmlFor="opponent" className="block text-gray-300 text-lg font-bold mb-2">상대팀 선택:</label>
                <select
                    id="opponent"
                    className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={selectedOpponentId}
                    onChange={(e) => setSelectedOpponentId(e.target.value)}
                    disabled={isSimulating}
                >
                    {opponentTeams.length === 0 && <option value="">다른 팀 없음</option>}
                    {opponentTeams.map(team => (
                        <option key={team.id} value={team.id}>
                            {team.teamName} (승:{team.wins} 패:{team.losses})
                        </option>
                    ))}
                </select>
            </div>

            <div className="text-center mb-6">
                <button
                    onClick={simulateGame}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-md focus:outline-none focus:shadow-outline transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isSimulating || opponentTeams.length === 0}
                >
                    {isSimulating ? '시뮬레이션 중...' : '경기 시뮬레이션'}
                </button>
            </div>

            {simulationResult && (
                <div className="mt-8 p-6 bg-gray-700 rounded-md shadow-inner">
                    <h3 className="text-2xl font-bold text-blue-200 mb-4">경기 결과</h3>
                    <p className="text-xl font-semibold text-center mb-4">
                        {simulationResult.teamA} {simulationResult.scoreA} - {simulationResult.teamB} {simulationResult.scoreB}
                    </p>
                    <pre className="bg-gray-800 p-4 rounded-md text-gray-100 text-sm whitespace-pre-wrap">
                        {simulationResult.summary}
                    </pre>
                </div>
            )}
        </div>
    );
};

const GameResults = () => {
    const { db, userId, teamId, showMessage, appId } = useContext(FirebaseContext);
    const [games, setGames] = useState([]);

    useEffect(() => {
        if (!db || !userId || !teamId) return;

        const gamesColRef = collection(db, `artifacts/${appId}/users/${userId}/games`);
        // 현재 사용자의 teamId가 myTeamId인 게임을 쿼리합니다.
        const q = query(gamesColRef, where("myTeamId", "==", teamId));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedGames = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // gameDate 내림차순으로 정렬
            fetchedGames.sort((a, b) => new Date(b.gameDate) - new Date(a.gameDate));
            setGames(fetchedGames);
        }, (error) => {
            console.error("경기 가져오기 오류:", error);
            showMessage(`경기 가져오기 오류: ${error.message}`, 'error');
        });

        return () => unsubscribe();
    }, [db, userId, teamId, appId, showMessage]);

    return (
        <div className="max-w-4xl mx-auto bg-gray-800 p-8 rounded-lg shadow-lg">
            <h2 className="text-3xl font-bold text-center mb-6 text-blue-300">지난 경기 결과</h2>

            {games.length === 0 ? (
                <p className="text-gray-400 text-center">아직 경기가 없습니다. 하나를 시뮬레이션해보세요!</p>
            ) : (
                <div className="space-y-6">
                    {games.map(game => (
                        <div key={game.id} className="bg-gray-700 p-6 rounded-md shadow-md">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="text-xl font-semibold text-blue-200">
                                    {game.myTeamName} vs {game.opponentTeamName}
                                </h3>
                                <span className="text-lg font-bold">
                                    <span className={game.myScore > game.opponentScore ? 'text-green-400' : 'text-red-400'}>
                                        {game.myScore}
                                    </span>
                                    {' - '}
                                    <span className={game.opponentScore > game.myScore ? 'text-green-400' : 'text-red-400'}>
                                        {game.opponentScore}
                                    </span>
                                </span>
                            </div>
                            <p className="text-gray-400 text-sm mb-3">날짜: {new Date(game.gameDate).toLocaleString()}</p>
                            <pre className="bg-gray-800 p-4 rounded-md text-gray-100 text-sm whitespace-pre-wrap">
                                {game.summary}
                            </pre>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const LeagueStandings = () => {
    const { db, showMessage, appId } = useContext(FirebaseContext);
    const [standings, setStandings] = useState([]);

    useEffect(() => {
        if (!db) return;

        const standingsColRef = collection(db, `artifacts/${appId}/public/data/leagueStandings`);
        const unsubscribe = onSnapshot(standingsColRef, (snapshot) => {
            const fetchedStandings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // 승수 (내림차순), 그 다음 패수 (오름차순)으로 정렬
            fetchedStandings.sort((a, b) => {
                if (b.wins !== a.wins) {
                    return b.wins - a.wins;
                }
                return a.losses - b.losses;
            });
            setStandings(fetchedStandings);
        }, (error) => {
            console.error("순위 가져오기 오류:", error);
            showMessage(`순위 가져오기 오류: ${error.message}`, 'error');
        });

        return () => unsubscribe();
    }, [db, appId, showMessage]);

    return (
        <div className="max-w-3xl mx-auto bg-gray-800 p-8 rounded-lg shadow-lg">
            <h2 className="text-3xl font-bold text-center mb-6 text-blue-300">리그 순위</h2>

            {standings.length === 0 ? (
                <p className="text-gray-400 text-center">아직 리그에 팀이 없습니다.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full bg-gray-700 rounded-md overflow-hidden">
                        <thead>
                            <tr className="bg-gray-600 text-gray-200 uppercase text-sm leading-normal">
                                <th className="py-3 px-6 text-left">순위</th>
                                <th className="py-3 px-6 text-left">팀 이름</th>
                                <th className="py-3 px-6 text-center">승</th>
                                <th className="py-3 px-6 text-center">패</th>
                                <th className="py-3 px-6 text-center">소유자 ID</th>
                            </tr>
                        </thead>
                        <tbody className="text-gray-300 text-sm font-light">
                            {standings.map((team, index) => (
                                <tr key={team.id} className="border-b border-gray-600 hover:bg-gray-600">
                                    <td className="py-3 px-6 text-left whitespace-nowrap">
                                        <span className="font-medium">{index + 1}</span>
                                    </td>
                                    <td className="py-3 px-6 text-left">
                                        {team.teamName}
                                    </td>
                                    <td className="py-3 px-6 text-center">
                                        <span className="bg-green-700 text-green-100 py-1 px-3 rounded-full text-xs">{team.wins}</span>
                                    </td>
                                    <td className="py-3 px-6 text-center">
                                        <span className="bg-red-700 text-red-100 py-1 px-3 rounded-full text-xs">{team.losses}</span>
                                    </td>
                                    <td className="py-3 px-6 text-center font-mono text-xs">
                                        {team.ownerId}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default App;
