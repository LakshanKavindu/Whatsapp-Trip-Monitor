// Firebase web configuration is public. Do not put the Admin service account
// credentials in this file.
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyD6la9t5ax7loSBrQKRDtrqWVcfgn50rQ4",
  authDomain: "whatsapp-trip-monitor.firebaseapp.com",
  projectId: "whatsapp-trip-monitor",
  storageBucket: "whatsapp-trip-monitor.firebasestorage.app",
  messagingSenderId: "994588088308",
  appId: "1:994588088308:web:418b2a755ec30f78154ba1",
  vapidKey: "BNjePufDaqIixL8qjR_MR_3yWlrm98xdXz1Vzo2smW0uPzETl8uSRMPptpq8T87m20DcXX4-X0WfYoyjxqqMvTg",
};

if (typeof window !== "undefined") window.FIREBASE_CONFIG = FIREBASE_CONFIG;
else self.FIREBASE_CONFIG = FIREBASE_CONFIG;
