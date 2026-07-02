import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Read config from the auto-provisioned file
const firebaseConfig = {
  apiKey: "AIzaSyAOU2KNUghiIOo-OMSsYExJGpbi7yE58hw",
  authDomain: "infra-motif-z2t1j.firebaseapp.com",
  projectId: "infra-motif-z2t1j",
  storageBucket: "infra-motif-z2t1j.firebasestorage.app",
  messagingSenderId: "619111923988",
  appId: "1:619111923988:web:f611e68e0f91d447544201"
};

const app = initializeApp(firebaseConfig);
// Using custom database ID if specified in config, otherwise default
const db = getFirestore(app, "ai-studio-5cardsgame-a7539fb6-1c08-4dc7-ae74-3f6432a84218");

export { db };
