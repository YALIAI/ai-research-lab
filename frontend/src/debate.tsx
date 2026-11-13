import React from 'react';
import {createRoot} from 'react-dom/client';
import './debate.css';
function DebateApp(){return <iframe title="AI Research Lab Live Debate Room" src="/debate-room.html" />;}
createRoot(document.getElementById('root')!).render(<React.StrictMode><DebateApp/></React.StrictMode>);
