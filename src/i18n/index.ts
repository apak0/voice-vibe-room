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
      "disconnected": "Disconnected"
    }
  },
  es: {
    translation: {
      // Room Manager
      "joinRoom": "Unirse a Sala",
      "createRoom": "Crear Sala",
      "roomId": "ID de Sala",
      "userName": "Tu Nombre",
      "enterRoomId": "Ingresa el ID de la sala",
      "enterYourName": "Ingresa tu nombre",
      "welcome": "Bienvenido a Voice Vibe Room",
      "connectFriends": "Conecta con amigos a través de chat de voz",
      
      // Voice Chat
      "participants": "Participantes",
      "participant": "Participante",
      "audioTesting": "Prueba de Audio",
      "testMicrophone": "Probar Micrófono",
      "testSpeakers": "Probar Altavoces",
      "voiceActivity": "Actividad de Voz",
      "volume": "Volumen",
      "mute": "Silenciar",
      "unmute": "Activar",
      "deafen": "Ensordecerse",
      "undeafen": "Escuchar",
      "leaveRoom": "Salir de Sala",
      "copyRoomId": "Copiar ID de Sala",
      "roomIdCopied": "¡ID de sala copiado al portapapeles!",
      "speaking": "Hablando",
      "muted": "Silenciado",
      "you": "Tú",
      "microphoneAccess": "Por favor permite el acceso al micrófono para usar el chat de voz",
      "connectionStatus": "Estado de Conexión",
      "connected": "Conectado",
      "connecting": "Conectando...",
      "disconnected": "Desconectado"
    }
  },
  fr: {
    translation: {
      // Room Manager
      "joinRoom": "Rejoindre Salon",
      "createRoom": "Créer Salon",
      "roomId": "ID du Salon",
      "userName": "Votre Nom",
      "enterRoomId": "Entrez l'ID du salon",
      "enterYourName": "Entrez votre nom",
      "welcome": "Bienvenue dans Voice Vibe Room",
      "connectFriends": "Connectez-vous avec des amis via le chat vocal",
      
      // Voice Chat
      "participants": "Participants",
      "participant": "Participant",
      "audioTesting": "Test Audio",
      "testMicrophone": "Tester Microphone",
      "testSpeakers": "Tester Haut-parleurs",
      "voiceActivity": "Activité Vocale",
      "volume": "Volume",
      "mute": "Couper",
      "unmute": "Activer",
      "deafen": "Sourdine",
      "undeafen": "Écouter",
      "leaveRoom": "Quitter Salon",
      "copyRoomId": "Copier ID Salon",
      "roomIdCopied": "ID du salon copié dans le presse-papiers!",
      "speaking": "Parle",
      "muted": "Coupé",
      "you": "Vous",
      "microphoneAccess": "Veuillez autoriser l'accès au microphone pour utiliser le chat vocal",
      "connectionStatus": "Statut de Connexion",
      "connected": "Connecté",
      "connecting": "Connexion...",
      "disconnected": "Déconnecté"
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