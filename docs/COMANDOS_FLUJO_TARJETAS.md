# Comandos Funcionales - Flujo Tarjetas

> Requisito: tener `jq` instalado.

## 1) Login admin y dejar TOKEN listo

# ¿Que hace el comand?
bash "API_URL='http://127.0.0.1:3001/api/v1'; SITE_ID=$(curl -s $API_URL/sites | jq -r '.data[0].id'); ADMIN_ID=$(curl -s \"$API_URL/auth/users?site_id=$SITE_ID\" | jq -r '.data[] | select(.role==\"admin\") | .id' | head -n1); read -s -p 'PIN admin: ' PIN; echo; TOKEN=$(curl -s -X POST $API_URL/auth/login -H 'Content-Type: application/json' -d \"{\\\"user_id\\\":\\\"$ADMIN_ID\\\",\\\"code\\\":\\\"$PIN\\\"}\" | jq -r '.data.token'); echo \"SITE_ID=$SITE_ID\"; echo \"ADMIN_ID=$ADMIN_ID\"; echo \"TOKEN=$TOKEN\""

## 2) Simular lectura UID desde API (para botón Escanear)

# ¿Que hace el comand?
bash "API_URL='http://127.0.0.1:3001/api/v1'; SITE_ID=$(curl -s $API_URL/sites | jq -r '.data[0].id'); curl -s -X POST $API_URL/cards/reader/uid -H 'Content-Type: application/json' -d \"{\\\"site_id\\\":\\\"$SITE_ID\\\",\\\"uid\\\":\\\"04A1B2C3D4\\\"}\" | jq"

## 3) Verificar UID pendiente para la caja (poll manual)

# ¿Que hace el comand?
bash "API_URL='http://127.0.0.1:3001/api/v1'; SITE_ID=$(curl -s $API_URL/sites | jq -r '.data[0].id'); AFTER=$(date +%s%3N); sleep 1; curl -s \"$API_URL/cards/reader/wait-uid?site_id=$SITE_ID&after=$AFTER\" -H \"Authorization: Bearer $TOKEN\" | jq"

## 4) Leer tarjeta por API (sin crear)

# ¿Que hace el comand?
bash "API_URL='http://127.0.0.1:3001/api/v1'; SITE_ID=$(curl -s $API_URL/sites | jq -r '.data[0].id'); curl -s -X POST $API_URL/cards/read -H \"Authorization: Bearer $TOKEN\" -H 'Content-Type: application/json' -d \"{\\\"site_id\\\":\\\"$SITE_ID\\\",\\\"uid\\\":\\\"04A1B2C3D4\\\",\\\"create_if_missing\\\":false}\" | jq"

## 5) Emitir tarjeta nueva con nombre personalizado y propietario

# ¿Que hace el comand?
bash "API_URL='http://127.0.0.1:3001/api/v1'; SITE_ID=$(curl -s $API_URL/sites | jq -r '.data[0].id'); UID='04'$(date +%s | tail -c 9); curl -s -X POST $API_URL/cards/read -H \"Authorization: Bearer $TOKEN\" -H 'Content-Type: application/json' -d \"{\\\"site_id\\\":\\\"$SITE_ID\\\",\\\"uid\\\":\\\"$UID\\\",\\\"card_name\\\":\\\"Tarjeta QA\\\",\\\"create_if_missing\\\":true,\\\"owner_customer\\\":{\\\"document_type\\\":\\\"CC\\\",\\\"document_number\\\":\\\"1234567890\\\",\\\"full_name\\\":\\\"Cliente QA\\\",\\\"phone\\\":\\\"3001234567\\\",\\\"city\\\":\\\"Bogota\\\",\\\"email\\\":\\\"qa@example.com\\\"}}\" | jq"

## 6) Recargar tarjeta (usa contexto real de caja)

# ¿Que hace el comand?
bash "API_URL='http://127.0.0.1:3001/api/v1'; SITE_ID=$(curl -s $API_URL/sites | jq -r '.data[0].id'); CTX=$(curl -s \"$API_URL/pos/context?site_id=$SITE_ID\" -H \"Authorization: Bearer $TOKEN\"); SHIFT_ID=$(echo $CTX | jq -r '.data.shift_id'); TERMINAL_ID=$(echo $CTX | jq -r '.data.terminal_id'); CASH_SESSION_ID=$(echo $CTX | jq -r '.data.cash_session_id'); ADMIN_ID=$(curl -s \"$API_URL/auth/users?site_id=$SITE_ID\" | jq -r '.data[] | select(.role==\"admin\") | .id' | head -n1); curl -s -X POST $API_URL/cards/04A1B2C3D4/recharge -H \"Authorization: Bearer $TOKEN\" -H 'Content-Type: application/json' -d \"{\\\"site_id\\\":\\\"$SITE_ID\\\",\\\"amount\\\":\\\"20000.00\\\",\\\"payment_method\\\":\\\"CASH\\\",\\\"terminal_id\\\":\\\"$TERMINAL_ID\\\",\\\"shift_id\\\":\\\"$SHIFT_ID\\\",\\\"cash_session_id\\\":\\\"$CASH_SESSION_ID\\\",\\\"created_by_user_id\\\":\\\"$ADMIN_ID\\\"}\" | jq"

## 7) Buscar tarjetas por cédula (para Select de transferencia)

# ¿Que hace el comand?
bash "API_URL='http://127.0.0.1:3001/api/v1'; SITE_ID=$(curl -s $API_URL/sites | jq -r '.data[0].id'); curl -s \"$API_URL/cards/by-owner?site_id=$SITE_ID&document_type=CC&document_number=1234567890\" -H \"Authorization: Bearer $TOKEN\" | jq"

## 8) Transferir por pérdida (anula origen y mueve saldo/puntos)

# ¿Que hace el comand?
bash "API_URL='http://127.0.0.1:3001/api/v1'; SITE_ID=$(curl -s $API_URL/sites | jq -r '.data[0].id'); ADMIN_ID=$(curl -s \"$API_URL/auth/users?site_id=$SITE_ID\" | jq -r '.data[] | select(.role==\"admin\") | .id' | head -n1); SOURCE_UID=$(curl -s \"$API_URL/cards/by-owner?site_id=$SITE_ID&document_type=CC&document_number=1234567890\" -H \"Authorization: Bearer $TOKEN\" | jq -r '.data[0].uid'); TARGET_UID='04'$(date +%s | tail -c 9); curl -s -X POST $API_URL/cards/$SOURCE_UID/migrate-balance -H \"Authorization: Bearer $TOKEN\" -H 'Content-Type: application/json' -d \"{\\\"site_id\\\":\\\"$SITE_ID\\\",\\\"target_uid\\\":\\\"$TARGET_UID\\\",\\\"reason\\\":\\\"Reposicion por perdida QA\\\",\\\"changed_by_user_id\\\":\\\"$ADMIN_ID\\\",\\\"document_type\\\":\\\"CC\\\",\\\"document_number\\\":\\\"1234567890\\\"}\" | jq"

## 9) Probar uso de máquina (debita tarjeta) - QA rápido

# ¿Que hace el comand?
bash -lc '
HASH=$(node -e "const bcrypt=require(\"bcryptjs\"); bcrypt.hash(\"dev-esp-token-ARCADE-01-R1\",10).then(h=>console.log(h))")
psql "postgresql://poliverse_app:poliverse_password@127.0.0.1:5432/poliverse_db" -c "UPDATE \"Reader\" SET \"apiTokenHash\"='\''$HASH'\'', \"hmacSecret\"='\''dev-esp-hmac-secret-123456'\'', \"isActive\"=true WHERE code='\''ARCADE-01-R1'\'';"

BODY="{\"uid\":\"04A1B2C3D4\",\"activityId\":\"ARCADE-01\",\"terminalId\":\"esp32-01\",\"requestId\":\"11111111-1111-1111-1111-111111111111\"}"
BODY_HASH=$(printf "%s" "$BODY" | openssl dgst -sha256 -binary | xxd -p -c 256)
SIG=$(printf "%s" "$BODY_HASH" | openssl dgst -sha256 -hmac "dev-esp-hmac-secret-123456" -binary | openssl base64)

curl -s -X POST "http://127.0.0.1:3001/api/v1/esp/activities/validate-and-use" \
  -H "Content-Type: application/json" \
  -H "x-reader-id: ARCADE-01-R1" \
  -H "x-api-token: dev-esp-token-ARCADE-01-R1" \
  -H "x-signature: $SIG" \
  -d "$BODY" | jq
'

## 10) Descargar PDF de factura/recibo

# ¿Que hace el comand?
bash "API_URL='http://127.0.0.1:3001/api/v1'; SITE_ID=$(curl -s $API_URL/sites | jq -r '.data[0].id'); SALE_ID='<SALE_UUID>'; curl -s -L \"$API_URL/sales/$SALE_ID/receipt.pdf?site_id=$SITE_ID\" -H \"Authorization: Bearer $TOKEN\" -o \"factura-$SALE_ID.pdf\"; ls -lh \"factura-$SALE_ID.pdf\""
