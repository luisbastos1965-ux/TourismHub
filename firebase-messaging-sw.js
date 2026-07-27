// firebase-messaging-sw.js
// 1. Importar as bibliotecas do Firebase para o Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

// 2. Coloca aqui a tua firebaseConfig IGUAL à que tens no teu firebase.js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "turmapro-....firebaseapp.com",
  projectId: "turmapro-...",
  storageBucket: "turmapro-....appspot.com",
  messagingSenderId: "...",
  appId: "1:..."
};

// 3. Inicializar a app no background
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// 4. O que fazer quando a app está fechada e chega uma notificação
messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Notificação recebida em background: ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo_tur.png', // O teu logótipo
    badge: '/logo_tur.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
