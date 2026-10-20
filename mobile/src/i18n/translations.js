// Multi-language Support System - دعم اللغات المتعددة
// Supported Languages: العربية (ar), English (en), Francais (fr), Turkce (tr)

export const SUPPORTED_LANGUAGES = [
  { code: 'ar', name: 'العربية', icon: 'globe', rtl: true },
  { code: 'en', name: 'English', icon: 'globe', rtl: false },
  { code: 'fr', name: 'Francais', icon: 'globe', rtl: false },
  { code: 'tr', name: 'Turkce', icon: 'globe', rtl: false },
];

export const translations = {
  ar: {
    // Common
    app_name: 'صقر',
    loading: 'جاري التحميل...',
    error: 'خطأ',
    success: 'تم بنجاح',
    cancel: 'إلغاء',
    confirm: 'تأكيد',
    save: 'حفظ',
    delete: 'حذف',
    edit: 'تعديل',
    back: 'رجوع',
    next: 'التالي',
    done: 'تم',
    retry: 'إعادة المحاولة',
    close: 'إغلاق',
    yes: 'نعم',
    no: 'لا',
    
    // Auth
    login: 'تسجيل الدخول',
    register: 'إنشاء حساب',
    logout: 'تسجيل الخروج',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    name: 'الاسم',
    phone: 'رقم الهاتف',
    forgot_password: 'نسيت كلمة المرور؟',
    create_account: 'إنشاء حساب جديد',
    already_have_account: 'لديك حساب بالفعل؟',
    dont_have_account: 'ليس لديك حساب؟',
    login_with_google: 'تسجيل الدخول بـ Google',
    login_with_apple: 'تسجيل الدخول بـ Apple',
    continue_as_guest: 'المتابعة كزائر',
    
    // Home
    welcome: 'أهلاً',
    ready_to_play: 'جاهز للتحدي؟',
    play_now: 'العب الآن',
    view_all: 'عرض الكل',
    featured_games: 'ألعاب مميزة',
    daily_rewards: 'المكافآت اليومية',
    leaderboard: 'المتصدرين',
    
    // Games
    games: 'الألعاب',
    chess: 'الشطرنج',
    tic_tac_toe: 'إكس أو',
    memory: 'الذاكرة',
    puzzle: 'تركيب الصور',
    trivia: 'أسئلة ثقافية',
    riddles: 'الألغاز',
    snake: 'الثعبان',
    brick_breaker: 'تكسير الطوب',
    math_race: 'سباق الحساب',
    word_race: 'سباق الكلمات',
    color_switch: 'تبديل الألوان',
    ai_quest: 'AI Quest',
    
    // Game UI
    start_game: 'ابدأ اللعبة',
    restart: 'إعادة',
    pause: 'إيقاف',
    resume: 'متابعة',
    game_over: 'انتهت اللعبة',
    you_won: 'فزت!',
    you_lost: 'خسرت',
    draw: 'تعادل',
    score: 'النتيجة',
    time: 'الوقت',
    moves: 'الحركات',
    level: 'المستوى',
    hint: 'تلميح',
    hints_remaining: 'التلميحات المتبقية',
    
    // Profile
    profile: 'الملف الشخصي',
    my_profile: 'ملفي الشخصي',
    statistics: 'الإحصائيات',
    achievements: 'الإنجازات',
    settings: 'الإعدادات',
    language: 'اللغة',
    notifications: 'الإشعارات',
    privacy: 'الخصوصية',
    help: 'المساعدة',
    about: 'حول التطبيق',
    
    // Currency
    points: 'جواهر صقر',
    diamonds: 'جواهر صقر',
    buy_diamonds: 'جمع الجواهر',
    
    // Ads
    watch_ad: 'شاهد إعلان',
    earn_points: 'اربح نقاط',
    ads: 'الإعلانات',
    
    // Achievements
    achievement_unlocked: 'إنجاز جديد!',
    first_win: 'الفوز الأول',
    first_win_desc: 'فز بأول لعبة',
    ai_master: 'سيد الذكاء الاصطناعي',
    ai_master_desc: 'اهزم AI Quest 10 مرات',
    trivia_expert: 'خبير الأسئلة',
    trivia_expert_desc: 'أجب على 100 سؤال صحيح',
    puzzle_solver: 'حلّال الألغاز',
    puzzle_solver_desc: 'أكمل 50 لغز',
    streak_master: 'سيد السلسلة',
    streak_master_desc: 'حقق سلسلة 10 فوز متتالي',
    diamond_collector: 'جامع الجواهر',
    diamond_collector_desc: 'اجمع 1000 جوهرة صقر',
    point_millionaire: 'مليونير النقاط',
    point_millionaire_desc: 'اجمع 10000 نقطة',
    daily_player: 'لاعب يومي',
    daily_player_desc: 'سجل دخول 30 يوم متتالي',
    game_variety: 'منوع الألعاب',
    game_variety_desc: 'العب 10 ألعاب مختلفة',
    speed_demon: 'شيطان السرعة',
    speed_demon_desc: 'أكمل لعبة في أقل من دقيقة',
    
    // Connection
    no_connection: 'لا يوجد اتصال بالإنترنت',
    connection_restored: 'تم استعادة الاتصال',
    check_connection: 'تحقق من اتصالك بالإنترنت',
    
    // Errors
    error_login: 'خطأ في تسجيل الدخول',
    error_register: 'خطأ في إنشاء الحساب',
    error_network: 'خطأ في الشبكة',
    try_again: 'حاول مرة أخرى',
  },
  
  en: {
    // Common
    app_name: 'Saqr',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    cancel: 'Cancel',
    confirm: 'Confirm',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    back: 'Back',
    next: 'Next',
    done: 'Done',
    retry: 'Retry',
    close: 'Close',
    yes: 'Yes',
    no: 'No',
    
    // Auth
    login: 'Login',
    register: 'Register',
    logout: 'Logout',
    email: 'Email',
    password: 'Password',
    name: 'Name',
    phone: 'Phone',
    forgot_password: 'Forgot Password?',
    create_account: 'Create Account',
    already_have_account: 'Already have an account?',
    dont_have_account: "Don't have an account?",
    login_with_google: 'Login with Google',
    login_with_apple: 'Login with Apple',
    continue_as_guest: 'Continue as Guest',
    
    // Home
    welcome: 'Welcome',
    ready_to_play: 'Ready to play?',
    play_now: 'Play Now',
    view_all: 'View All',
    featured_games: 'Featured Games',
    daily_rewards: 'Daily Rewards',
    leaderboard: 'Leaderboard',
    
    // Games
    games: 'Games',
    chess: 'Chess',
    tic_tac_toe: 'Tic Tac Toe',
    memory: 'Memory',
    puzzle: 'Puzzle',
    trivia: 'Trivia',
    riddles: 'Riddles',
    snake: 'Snake',
    brick_breaker: 'Brick Breaker',
    math_race: 'Math Race',
    word_race: 'Word Race',
    color_switch: 'Color Switch',
    ai_quest: 'AI Quest',
    
    // Game UI
    start_game: 'Start Game',
    restart: 'Restart',
    pause: 'Pause',
    resume: 'Resume',
    game_over: 'Game Over',
    you_won: 'You Won!',
    you_lost: 'You Lost',
    draw: 'Draw',
    score: 'Score',
    time: 'Time',
    moves: 'Moves',
    level: 'Level',
    hint: 'Hint',
    hints_remaining: 'Hints Remaining',
    
    // Profile
    profile: 'Profile',
    my_profile: 'My Profile',
    statistics: 'Statistics',
    achievements: 'Achievements',
    settings: 'Settings',
    language: 'Language',
    notifications: 'Notifications',
    privacy: 'Privacy',
    help: 'Help',
    about: 'About',
    
    // Currency
    points: 'Saqr Gems',
    diamonds: 'Saqr Gems',
    buy_diamonds: 'Earn Gems',
    
    // Ads
    watch_ad: 'Watch Ad',
    earn_points: 'Earn Points',
    ads: 'Ads',
    
    // Achievements
    achievement_unlocked: 'Achievement Unlocked!',
    first_win: 'First Victory',
    first_win_desc: 'Win your first game',
    ai_master: 'AI Master',
    ai_master_desc: 'Beat AI Quest 10 times',
    trivia_expert: 'Trivia Expert',
    trivia_expert_desc: 'Answer 100 questions correctly',
    puzzle_solver: 'Puzzle Solver',
    puzzle_solver_desc: 'Complete 50 puzzles',
    streak_master: 'Streak Master',
    streak_master_desc: 'Achieve 10 wins in a row',
    diamond_collector: 'Gem Collector',
    diamond_collector_desc: 'Collect 1000 Saqr gems',
    point_millionaire: 'Point Millionaire',
    point_millionaire_desc: 'Collect 10000 points',
    daily_player: 'Daily Player',
    daily_player_desc: 'Login 30 days in a row',
    game_variety: 'Game Variety',
    game_variety_desc: 'Play 10 different games',
    speed_demon: 'Speed Demon',
    speed_demon_desc: 'Complete a game in under 1 minute',
    
    // Connection
    no_connection: 'No Internet Connection',
    connection_restored: 'Connection Restored',
    check_connection: 'Check your internet connection',
    
    // Errors
    error_login: 'Login Error',
    error_register: 'Registration Error',
    error_network: 'Network Error',
    try_again: 'Try Again',
  },
  
  fr: {
    // Common
    app_name: 'Saqr',
    loading: 'Chargement...',
    error: 'Erreur',
    success: 'Succès',
    cancel: 'Annuler',
    confirm: 'Confirmer',
    save: 'Enregistrer',
    delete: 'Supprimer',
    edit: 'Modifier',
    back: 'Retour',
    next: 'Suivant',
    done: 'Terminé',
    retry: 'Réessayer',
    close: 'Fermer',
    yes: 'Oui',
    no: 'Non',
    
    // Auth
    login: 'Connexion',
    register: "S'inscrire",
    logout: 'Déconnexion',
    email: 'Email',
    password: 'Mot de passe',
    name: 'Nom',
    phone: 'Téléphone',
    forgot_password: 'Mot de passe oublié?',
    create_account: 'Créer un compte',
    already_have_account: 'Vous avez déjà un compte?',
    dont_have_account: "Vous n'avez pas de compte?",
    login_with_google: 'Connexion avec Google',
    login_with_apple: 'Connexion avec Apple',
    continue_as_guest: 'Continuer en tant qu\'invité',
    
    // Home
    welcome: 'Bienvenue',
    ready_to_play: 'Prêt à jouer?',
    play_now: 'Jouer maintenant',
    view_all: 'Voir tout',
    featured_games: 'Jeux vedettes',
    daily_rewards: 'Récompenses quotidiennes',
    leaderboard: 'Classement',
    
    // Games
    games: 'Jeux',
    chess: 'Échecs',
    tic_tac_toe: 'Morpion',
    memory: 'Mémoire',
    puzzle: 'Puzzle',
    trivia: 'Quiz',
    riddles: 'Énigmes',
    snake: 'Serpent',
    brick_breaker: 'Casse-briques',
    math_race: 'Course de maths',
    word_race: 'Course de mots',
    color_switch: 'Changeur de couleur',
    ai_quest: 'AI Quest',
    
    // Game UI
    start_game: 'Commencer',
    restart: 'Recommencer',
    pause: 'Pause',
    resume: 'Reprendre',
    game_over: 'Partie terminée',
    you_won: 'Vous avez gagné!',
    you_lost: 'Vous avez perdu',
    draw: 'Match nul',
    score: 'Score',
    time: 'Temps',
    moves: 'Mouvements',
    level: 'Niveau',
    hint: 'Indice',
    hints_remaining: 'Indices restants',
    
    // Profile
    profile: 'Profil',
    my_profile: 'Mon profil',
    statistics: 'Statistiques',
    achievements: 'Succès',
    settings: 'Paramètres',
    language: 'Langue',
    notifications: 'Notifications',
    privacy: 'Confidentialité',
    help: 'Aide',
    about: 'À propos',
    
    // Currency
    points: 'Gemmes Saqr',
    diamonds: 'Gemmes Saqr',
    buy_diamonds: 'Gagner des gemmes',
    
    // Ads
    watch_ad: 'Regarder une pub',
    earn_points: 'Gagner des points',
    ads: 'Publicités',
    
    // Achievements
    achievement_unlocked: 'Succès débloqué!',
    first_win: 'Première victoire',
    first_win_desc: 'Gagnez votre premier jeu',
    ai_master: 'Maître de l\'IA',
    ai_master_desc: 'Battez AI Quest 10 fois',
    trivia_expert: 'Expert Quiz',
    trivia_expert_desc: 'Répondez correctement à 100 questions',
    puzzle_solver: 'Résolveur de puzzles',
    puzzle_solver_desc: 'Complétez 50 puzzles',
    streak_master: 'Maître des séries',
    streak_master_desc: 'Obtenez 10 victoires consécutives',
    diamond_collector: 'Collectionneur de gemmes',
    diamond_collector_desc: 'Collectez 1000 gemmes Saqr',
    point_millionaire: 'Millionnaire de points',
    point_millionaire_desc: 'Collectez 10000 points',
    daily_player: 'Joueur quotidien',
    daily_player_desc: 'Connectez-vous 30 jours de suite',
    game_variety: 'Variété de jeux',
    game_variety_desc: 'Jouez à 10 jeux différents',
    speed_demon: 'Démon de la vitesse',
    speed_demon_desc: 'Terminez un jeu en moins d\'une minute',
    
    // Connection
    no_connection: 'Pas de connexion Internet',
    connection_restored: 'Connexion rétablie',
    check_connection: 'Vérifiez votre connexion Internet',
    
    // Errors
    error_login: 'Erreur de connexion',
    error_register: 'Erreur d\'inscription',
    error_network: 'Erreur réseau',
    try_again: 'Réessayez',
  },
  
  tr: {
    // Common
    app_name: 'Saqr',
    loading: 'Yükleniyor...',
    error: 'Hata',
    success: 'Başarılı',
    cancel: 'İptal',
    confirm: 'Onayla',
    save: 'Kaydet',
    delete: 'Sil',
    edit: 'Düzenle',
    back: 'Geri',
    next: 'İleri',
    done: 'Tamam',
    retry: 'Tekrar Dene',
    close: 'Kapat',
    yes: 'Evet',
    no: 'Hayır',
    
    // Auth
    login: 'Giriş Yap',
    register: 'Kayıt Ol',
    logout: 'Çıkış Yap',
    email: 'E-posta',
    password: 'Şifre',
    name: 'İsim',
    phone: 'Telefon',
    forgot_password: 'Şifremi Unuttum?',
    create_account: 'Hesap Oluştur',
    already_have_account: 'Zaten hesabınız var mı?',
    dont_have_account: 'Hesabınız yok mu?',
    login_with_google: 'Google ile Giriş',
    login_with_apple: 'Apple ile Giriş',
    continue_as_guest: 'Misafir olarak devam et',
    
    // Home
    welcome: 'Hoş geldiniz',
    ready_to_play: 'Oynamaya hazır mısın?',
    play_now: 'Şimdi Oyna',
    view_all: 'Tümünü Gör',
    featured_games: 'Öne Çıkan Oyunlar',
    daily_rewards: 'Günlük Ödüller',
    leaderboard: 'Liderlik Tablosu',
    
    // Games
    games: 'Oyunlar',
    chess: 'Satranç',
    tic_tac_toe: 'XOX',
    memory: 'Hafıza',
    puzzle: 'Yapboz',
    trivia: 'Bilgi Yarışması',
    riddles: 'Bulmacalar',
    snake: 'Yılan',
    brick_breaker: 'Tuğla Kırıcı',
    math_race: 'Matematik Yarışı',
    word_race: 'Kelime Yarışı',
    color_switch: 'Renk Değiştir',
    ai_quest: 'AI Quest',
    
    // Game UI
    start_game: 'Oyunu Başlat',
    restart: 'Yeniden Başlat',
    pause: 'Duraklat',
    resume: 'Devam Et',
    game_over: 'Oyun Bitti',
    you_won: 'Kazandınız!',
    you_lost: 'Kaybettiniz',
    draw: 'Berabere',
    score: 'Skor',
    time: 'Süre',
    moves: 'Hamle',
    level: 'Seviye',
    hint: 'İpucu',
    hints_remaining: 'Kalan İpuçları',
    
    // Profile
    profile: 'Profil',
    my_profile: 'Profilim',
    statistics: 'İstatistikler',
    achievements: 'Başarılar',
    settings: 'Ayarlar',
    language: 'Dil',
    notifications: 'Bildirimler',
    privacy: 'Gizlilik',
    help: 'Yardım',
    about: 'Hakkında',
    
    // Currency
    points: 'Saqr Mücevherleri',
    diamonds: 'Saqr Mücevherleri',
    buy_diamonds: 'Mücevher Kazan',
    
    // Ads
    watch_ad: 'Reklam İzle',
    earn_points: 'Puan Kazan',
    ads: 'Reklamlar',
    
    // Achievements
    achievement_unlocked: 'Başarı Kazanıldı!',
    first_win: 'İlk Zafer',
    first_win_desc: 'İlk oyununu kazan',
    ai_master: 'Yapay Zeka Ustası',
    ai_master_desc: 'AI Quest\'i 10 kez yen',
    trivia_expert: 'Bilgi Uzmanı',
    trivia_expert_desc: '100 soruyu doğru yanıtla',
    puzzle_solver: 'Bulmaca Çözücü',
    puzzle_solver_desc: '50 bulmaca tamamla',
    streak_master: 'Seri Ustası',
    streak_master_desc: 'Arka arkaya 10 galibiyet al',
    diamond_collector: 'Mücevher Toplayıcı',
    diamond_collector_desc: '1000 Saqr mücevheri topla',
    point_millionaire: 'Puan Milyoneri',
    point_millionaire_desc: '10000 puan topla',
    daily_player: 'Günlük Oyuncu',
    daily_player_desc: '30 gün üst üste giriş yap',
    game_variety: 'Oyun Çeşitliliği',
    game_variety_desc: '10 farklı oyun oyna',
    speed_demon: 'Hız Şeytanı',
    speed_demon_desc: 'Bir oyunu 1 dakikadan kısa sürede bitir',
    
    // Connection
    no_connection: 'İnternet Bağlantısı Yok',
    connection_restored: 'Bağlantı Yeniden Kuruldu',
    check_connection: 'İnternet bağlantınızı kontrol edin',
    
    // Errors
    error_login: 'Giriş Hatası',
    error_register: 'Kayıt Hatası',
    error_network: 'Ağ Hatası',
    try_again: 'Tekrar Deneyin',
  },
};

// Default language
export const DEFAULT_LANGUAGE = 'ar';

// Get translation function
export const getTranslation = (language, key) => {
  const lang = translations[language] || translations[DEFAULT_LANGUAGE];
  return lang[key] || translations[DEFAULT_LANGUAGE][key] || key;
};

// Get all translations for a language
export const getLanguageTranslations = (language) => {
  return translations[language] || translations[DEFAULT_LANGUAGE];
};

export default translations;
