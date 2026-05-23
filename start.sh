#!/bin/bash
# Start STT server and Angular dev server for SpeakToHermes

STT_PORT=8787
NG_PORT=4201

# Start STT server in background
echo "Starting STT server on port $STT_PORT..."
python3 /home/hhoareau/speaktohermes/stt_server.py &
STT_PID=$!

# Wait for STT to start
sleep 2

# Check STT health
curl -s --max-time 3 http://localhost:$STT_PORT/health && echo "" || echo "STT server may not be ready"

echo "STT PID: $STT_PID"
echo ""
echo "Starting Angular dev server on port $NG_PORT..."
echo "Run: ng serve --host 0.0.0.0 --port $NG_PORT"
echo ""

cd /home/hhoareau/speaktohermes
ng serve --host 0.0.0.0 --port $NG_PORT