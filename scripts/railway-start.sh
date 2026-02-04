#!/usr/bin/env bash
set -e

echo "Waiting for Postgres..."
node -e "const url=process.env.DATABASE_URL; if(!url){console.error('DATABASE_URL not set'); process.exit(1);} const u=new URL(url); const host=u.hostname; const port=Number(u.port||5432); let tries=0; const max=60; const net=require('net'); const tick=()=>{tries++; const s=net.connect({host,port,timeout:1000}); s.on('connect',()=>{s.destroy(); process.exit(0);}); s.on('error',()=>{s.destroy(); if(tries>=max){console.error(\`Postgres not ready at ${host}:${port}\`); process.exit(1);} setTimeout(tick,1000);}); s.on('timeout',()=>{s.destroy(); if(tries>=max){console.error(\`Postgres not ready at ${host}:${port}\`); process.exit(1);} setTimeout(tick,1000);});}; tick();"

echo "Running Prisma migrations..."
npm run prisma:deploy

echo "Starting API..."
exec npm run api:start
