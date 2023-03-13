import {initializeApp} from 'firebase/app';
import {getFirestore} from 'firebase/firestore';

// TODO: Replace the following with your app's Firebase project configuration
const firebaseConfig = {
    apiKey: "AIzaSyAUd--c1SIZfcrijKlsMjzt3DyQtKwlPes",
    authDomain: "vacancies-bot.firebaseapp.com",
    projectId: "vacancies-bot",
    storageBucket: "vacancies-bot.appspot.com",
    messagingSenderId: "920444879660",
    appId: "1:920444879660:web:53f39693903e84bd1a2289"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);