import React, { useState, useEffect, useCallback } from 'react';
import { Search, User, ChevronLeft, ChevronRight, Circle } from 'lucide-react'; // Circle for pagination dots

// Tailwind CSS is assumed to be available

function App() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('실시간'); // State for active tab
  const [scrolled, setScrolled] = useState(false); // State to track scroll position

  // Dummy data for Hero Banners
  const heroBanners = [
    {
      id: 1,
      title1: '무면허힐러',
      title2: '즐겁게 살아가기',
      description: '오늘부터 치원 정상영업합니다!',
      imageUrl: 'https://placehold.co/1920x800/2D545E/FFFFFF?text=Your+Epic+Novel+Banner+1'
    },
    {
      id: 2,
      title1: '별빛 아래에서',
      title2: '새로운 시작',
      description: '꿈과 희망이 가득한 판타지 세계로 초대합니다!',
      imageUrl: 'https://placehold.co/1920x800/4CAF50/FFFFFF?text=Your+Epic+Novel+Banner+2'
    },
    {
      id: 3,
      title1: '도시의 그림자',
      title2: '숨겨진 이야기',
      description: '어둠 속에 감춰진 진실을 파헤쳐라!',
      imageUrl: 'https://placehold.co/1920x800/FF5722/FFFFFF?text=Your+Epic+Novel+Banner+3'
    }
  ];

  // Dummy data for "라프텔 인기 애니" section
  const popularAnime = [
    {
      id: 1,
      rank: 1,
      title: '덕선',
      description: '순간 치료 능력자인데 노움이 안 된다.',
      img: 'https://placehold.co/200x112/A0C49D/FFFFFF?text=Anime+1'
    },
    {
      id: 2,
      rank: 2,
      title: '윈브레 - WINBRE - 시즌 2',
      description: '추방당한 천재 치유사, 무면허 헐...',
      img: 'https://placehold.co/200x112/C4D7B2/FFFFFF?text=Anime+2'
    },
    {
      id: 3,
      rank: 3,
      title: '목은 숙녀의 소양이기에',
      description: '커타지 지유',
      img: 'https://placehold.co/200x112/E0A96D/FFFFFF?text=Anime+3'
    },
    {
      id: 4,
      rank: 4,
      title: '병아리 같은 남동생을 키웁니다.',
      description: '백돼지 귀족인데 전생의 기억이 떠돌',
      img: 'https://placehold.co/200x112/B8621B/FFFFFF?text=Anime+4'
    },
    {
      id: 5,
      rank: 5,
      title: '완벽해서 귀여운 구석이 없다고 파혼',
      description: '판타지 액션',
      img: 'https://placehold.co/200x112/5C8374/FFFFFF?text=Anime+5'
    },
    {
      id: 6,
      rank: 6,
      title: '진석의 거인 The FINAL part 1',
      description: '당한 성 너는 이웃 나라에 팔린다',
      img: 'https://placehold.co/200x112/183D3D/FFFFFF?text=Anime+6'
    },
    {
      id: 7,
      rank: 7,
      title: '유녀사',
      description: '환생한 김에 인생 갈아엎는다',
      img: 'https://placehold.co/200x112/93B1A6/FFFFFF?text=Anime+7'
    },
  ];

  // Dummy data for "라프텔에서만 볼 수 있는 독점 작품!" section
  const exclusiveWorks = [
    {
      id: 1,
      title: '듀라라라!!x2 결 - 판권 부활',
      img: 'https://placehold.co/200x112/5C469C/FFFFFF?text=Exclusive+1'
    },
    {
      id: 2,
      title: '피라미드 게임',
      img: 'https://placehold.co/200x112/333A73/FFFFFF?text=Exclusive+2'
    },
    {
      id: 3,
      title: 'S.A 스페셜 에이',
      img: 'https://placehold.co/200x112/4E4F50/FFFFFF?text=Exclusive+3'
    },
    {
      id: 4,
      title: 'ID:INVADED',
      img: 'https://placehold.co/200x112/7C7F7F/FFFFFF?text=Exclusive+4'
    },
    {
      id: 5,
      title: 'A3!',
      img: 'https://placehold.co/200x112/9BABB8/FFFFFF?text=Exclusive+5'
    },
    {
      id: 6,
      title: '하늘색 유틸리티',
      img: 'https://placehold.co/200x112/B7B7B7/FFFFFF?text=Exclusive+6'
    },
    {
      id: 7,
      title: '유녀사',
      img: 'https://placehold.co/200x112/DCDCDC/FFFFFF?text=Exclusive+7'
    },
  ];

  // Function to go to the previous banner
  const handlePrevBanner = useCallback(() => {
    setCurrentBannerIndex((prevIndex) =>
      prevIndex === 0 ? heroBanners.length - 1 : prevIndex - 1
    );
  }, [heroBanners.length]);

  // Function to go to the next banner
  const handleNextBanner = useCallback(() => {
    setCurrentBannerIndex((prevIndex) =>
      prevIndex === heroBanners.length - 1 ? 0 : prevIndex + 1
    );
  }, [heroBanners.length]);

  // Effect for automatic banner transition
  useEffect(() => {
    const interval = setInterval(() => {
      handleNextBanner();
    }, 5000); // 5 seconds

    // Clear interval on component unmount
    return () => clearInterval(interval);
  }, [handleNextBanner]);

  // Function to handle pagination dot click
  const handleDotClick = useCallback((index) => {
    setCurrentBannerIndex(index);
  }, []);

  // Handle scroll event to change header style
  const handleScroll = useCallback(() => {
    if (window.scrollY > 50) { // Adjust scroll threshold as needed
      setScrolled(true);
    } else {
      setScrolled(false);
    }
  }, []);

  // Add and remove scroll event listener
  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  const currentBanner = heroBanners[currentBannerIndex];

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
      {/* Header - Conditional styling based on scroll for smooth transition */}
      <header className={`fixed top-0 left-0 w-full z-50 py-3 transition-all duration-500 ease-in-out ${
        scrolled ? 'bg-white shadow-sm' : 'bg-transparent'
      }`}>
        <div className="container mx-auto px-4 flex justify-between items-center">
          {/* Left: LAFTEL Logo - Conditional text color */}
          <a href="#" className={`text-2xl font-extrabold transition-colors duration-500 ${scrolled ? 'text-teal-500' : 'text-white'}`}>
            CRAFIQ
          </a>

          {/* Center: Navigation Links - Conditional text color */}
          <nav className="hidden md:flex space-x-6">
            <a href="#" className={`text-sm font-semibold transition-colors duration-500 ${scrolled ? 'text-gray-700 hover:text-teal-600' : 'text-white hover:text-gray-300'}`}>
              대극장
            </a>
            <a href="#" className={`text-sm font-semibold transition-colors duration-500 ${scrolled ? 'text-gray-700 hover:text-teal-600' : 'text-white hover:text-gray-300'}`}>
              오리지널
            </a>
            <a href="#" className={`text-sm font-semibold transition-colors duration-500 ${scrolled ? 'text-gray-700 hover:text-teal-600' : 'text-white hover:text-gray-300'}`}>
              더빙/자막 선택
            </a>
            <a href="#" className={`text-sm font-semibold transition-colors duration-500 ${scrolled ? 'text-gray-700 hover:text-teal-600' : 'text-white hover:text-gray-300'}`}>
              팬심
            </a>
          </nav>

          {/* Right: Search and User Actions - Conditional icon and button colors */}
          <div className="flex items-center space-x-4">
            <button className={`transition-colors duration-500 ${scrolled ? 'text-gray-600 hover:text-teal-600' : 'text-white hover:text-gray-300'}`}>
              <Search className="w-5 h-5" />
            </button>
            <button className={`hidden md:block px-4 py-2 rounded-full text-sm font-semibold transition-all duration-500 ${
              scrolled
                ? 'text-teal-600 border border-teal-600 hover:bg-teal-50'
                : 'text-white border border-white hover:bg-white hover:text-teal-600'
            }`}>
              로그인/회원가입
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section - 라프텔 메인 배너 스타일 */}
        <section
          className="relative w-full h-[450px] md:h-[600px] bg-cover bg-center flex items-center overflow-hidden transition-all duration-500 ease-in-out"
          style={{
            backgroundImage: `url("${currentBanner.imageUrl}")`,
          }}
        >
          {/* Gradient Overlay for text readability and visual depth */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-l from-black/10 to-transparent"></div> {/* Subtle right fade */}

          {/* Left Arrow */}
          <button
            onClick={handlePrevBanner}
            className="absolute left-4 p-2 text-white bg-black bg-opacity-30 rounded-full hover:bg-opacity-50 transition-opacity z-10"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>

          {/* Banner Content */}
          <div className="container mx-auto px-4 relative z-10 text-white text-left max-w-lg ml-8 md:ml-20">
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-4">
              <span>{currentBanner.title1}</span><br />
              <span className="text-5xl md:text-7xl whitespace-nowrap">{currentBanner.title2}</span>
            </h1>
            <p className="text-lg md:text-xl font-medium mb-6">
              {currentBanner.description}
            </p>
            <button className="px-6 py-3 bg-white text-teal-600 font-bold rounded-md text-lg hover:bg-gray-100 transition-colors duration-300">
              보러가기 &gt;
            </button>
          </div>

          {/* Right Arrow */}
          <button
            onClick={handleNextBanner}
            className="absolute right-4 p-2 text-white bg-black bg-opacity-30 rounded-full hover:bg-opacity-50 transition-opacity z-10"
          >
            <ChevronRight className="w-8 h-8" />
          </button>

          {/* Pagination Dots */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2 z-10">
            {heroBanners.map((_, index) => (
              <Circle
                key={index}
                className={`w-2 h-2 text-white cursor-pointer ${
                  currentBannerIndex === index ? 'fill-current opacity-70' : 'opacity-40'
                }`}
                onClick={() => handleDotClick(index)}
              />
            ))}
          </div>
        </section>

        {/* New Section: 라프텔 인기 애니 (LAFTEL Popular Anime) */}
        <section className="container mx-auto px-4 py-8 mt-8">
          <h2 className="text-2xl md:text-3xl font-bold mb-6 text-gray-900">라프텔 인기 애니</h2>
          {/* Tabs */}
          <div className="flex space-x-4 mb-6 border-b border-gray-200">
            {['실시간', '이번 주', '분기', '역대'].map((tab) => (
              <button
                key={tab}
                className={`pb-2 text-lg font-semibold ${
                  activeTab === tab
                    ? 'text-teal-600 border-b-2 border-teal-600'
                    : 'text-gray-600 hover:text-teal-600'
                } transition-colors duration-200`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Content Row for Popular Anime */}
          <div className="flex overflow-x-scroll scrollbar-hide space-x-4 pb-4">
            {popularAnime.map((item) => (
              <div
                key={item.id}
                // Removed transform hover:scale-105 transition-transform duration-300
                className="flex-shrink-0 w-52 md:w-60 lg:w-72 cursor-pointer"
              >
                <div className="relative">
                  <img
                    src={item.img}
                    alt={item.title}
                    className="w-full h-auto object-cover"
                    onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/200x112/CCCCCC/333333?text=Image+Error'; }}
                  />
                  <div className="absolute bottom-0 left-0 bg-black bg-opacity-70 text-white text-xl font-bold px-3 py-1 rounded-tr-lg">
                    {item.rank}
                  </div>
                </div>
                <div className="pt-2">
                  <h3 className="text-base md:text-lg font-bold text-gray-900 truncate mb-1">
                    {item.title}
                  </h3>
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* New Section: 라프텔에서만 볼 수 있는 독점 작품! (LAFTEL Exclusive Works!) */}
        <section className="container mx-auto px-4 py-8">
          <h2 className="text-2xl md:text-3xl font-bold mb-6 text-gray-900">라프텔에서만 볼 수 있는 독점 작품!</h2>
          {/* Content Row for Exclusive Works */}
          <div className="flex overflow-x-scroll scrollbar-hide space-x-4 pb-4">
            {exclusiveWorks.map((item) => (
              <div
                key={item.id}
                // Removed transform hover:scale-105 transition-transform duration-300
                className="flex-shrink-0 w-52 md:w-60 lg:w-72 cursor-pointer"
              >
                <div className="relative">
                  <img
                    src={item.img}
                    alt={item.title}
                    className="w-full h-auto object-cover"
                    onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/200x112/CCCCCC/333333?text=Image+Error'; }}
                  />
                  <span className="absolute top-2 right-2 bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                    ONLY
                  </span>
                </div>
                <div className="pt-2">
                  <h3 className="text-base md:text-lg font-bold text-gray-900 truncate">
                    {item.title}
                  </h3>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-gray-300 py-10 px-4 mt-12">
        <div className="container mx-auto text-center">
          <div className="mb-4">
            <a href="#" className="text-teal-400 hover:text-teal-300 mx-3 text-sm">이용약관</a>
            <span className="text-gray-600 text-sm">|</span>
            <a href="#" className="text-teal-400 hover:text-teal-300 mx-3 text-sm">개인정보처리방침</a>
            <span className="text-gray-600 text-sm">|</span>
            <a href="#" className="text-teal-400 hover:text-teal-300 mx-3 text-sm">문의하기</a>
          </div>
          <p className="text-xs">&copy; 2025 내 소설 연재. All rights reserved.</p>
        </div>
      </footer>

      {/* Tailwind CSS Scrollbar Hide Utility (Optional, but good for aesthetics) */}
      <style>
        {`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;  /* IE and Edge */
          scrollbar-width: none;  /* Firefox */
        }
        `}
      </style>
    </div>
  );
}

export default App;
