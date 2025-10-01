import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Translation resources
const resources = {
  en: {
    translation: {
      // Room Manager
      "joinRoom": "Join Room",
      "createRoom": "Create Room",
      "roomId": "Room ID",
      "userName": "Your Name",
      "enterRoomId": "Enter room ID",
      "enterYourName": "Enter your name",
      "welcome": "Welcome to Voice Vibe Room",
      "connectFriends": "Connect with friends through voice chat",
      
      // Voice Chat
      "participants": "Participants",
      "participant": "Participant",
      "audioTesting": "Audio Testing",
      "testMicrophone": "Test Microphone",
      "testSpeakers": "Test Speakers",
      "voiceActivity": "Voice Activity",
      "volume": "Volume",
      "mute": "Mute",
      "unmute": "Unmute",
      "deafen": "Deafen",
      "undeafen": "Undeafen",
      "leaveRoom": "Leave Room",
      "copyRoomId": "Copy Room ID",
      "roomIdCopied": "Room ID copied to clipboard!",
      "speaking": "Speaking",
      "muted": "Muted",
      "you": "You",
      "microphoneAccess": "Please allow microphone access to use voice chat",
      "connectionStatus": "Connection Status",
      "connected": "Connected",
      "connecting": "Connecting...",
      "disconnected": "Disconnected",
      "pushToTalk": "Push to Talk",
      "holdSpaceToTalk": "Hold Space key or press button below to talk",
      "pushToTalkEnabled": "Push to Talk is enabled - manual mute disabled",
      "talking": "Talking...",
      "holdToTalk": "Hold to Talk",
      "creatingRoom": "Creating Room..."
    }
  },
  tr: {
    translation: {
      // Room Manager
      "joinRoom": "Odaya Katıl",
      "createRoom": "Oda Oluştur",
      "roomId": "Oda Kimliği",
      "userName": "Adınız",
      "enterRoomId": "Oda kimliğini girin",
      "enterYourName": "Adınızı girin",
      "welcome": "Voice Vibe Odasına Hoş Geldiniz",
      "connectFriends": "Sesli sohbet ile arkadaşlarınızla bağlanın",
      
      // Voice Chat
      "participants": "Katılımcılar",
      "participant": "Katılımcı",
      "audioTesting": "Ses Testi",
      "testMicrophone": "Mikrofonu Test Et",
      "testSpeakers": "Hoparlörleri Test Et",
      "voiceActivity": "Ses Etkinliği",
      "volume": "Ses",
      "mute": "Sessize Al",
      "unmute": "Sesi Aç",
      "deafen": "Sağırlaştır",
      "undeafen": "Sağırlaştırmayı Kaldır",
      "leaveRoom": "Odadan Çık",
      "copyRoomId": "Oda Kimliğini Kopyala",
      "roomIdCopied": "Oda kimliği panoya kopyalandı!",
      "speaking": "Konuşuyor",
      "muted": "Sessiz",
      "you": "Sen",
      "microphoneAccess": "Sesli sohbeti kullanmak için lütfen mikrofon erişimine izin verin",
      "connectionStatus": "Bağlantı Durumu",
      "connected": "Bağlandı",
      "connecting": "Bağlanıyor...",
      "disconnected": "Bağlantı kesildi",
      "pushToTalk": "Basılı Tutarak Konuş",
      "holdSpaceToTalk": "Konuşmak için Space tuşuna basılı tutun veya aşağıdaki butona basın",
      "pushToTalkEnabled": "Basılı Tutarak Konuş etkin - manuel susturma devre dışı",
      "talking": "Konuşuyor...",
      "holdToTalk": "Konuşmak İçin Basılı Tut",
      "creatingRoom": "Oda Oluşturuluyor..."
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: false,
    
    detection: {
      order: ['navigator', 'htmlTag', 'path', 'subdomain'],
      caches: ['localStorage'],
    },

    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;