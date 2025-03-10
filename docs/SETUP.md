# SpheroSeg - Návod na spuštění

## Prerekvizity
- Docker a Docker Compose
- Git
- Node.js 18+ (pro lokální vývoj)
- Python 3.11+ (pro lokální vývoj)

## 1. Klonování repozitáře
```bash
git clone https://github.com/your-org/spheroseg.git
cd spheroseg
```

## 2. Konfigurace prostředí

### Vytvoření .env souborů

Backend (.env):
```bash
DATABASE_URL=postgresql://postgres:postgres@db:5432/spheroseg
MINIO_HOST=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
JWT_SECRET=your-secret-key
```

Frontend (.env.local):
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
```

## 3. Spuštění pomocí Docker Compose

### Vývojové prostředí
```bash
docker-compose up --build
```

### Produkční prostředí
```bash
docker-compose -f docker-compose.prod.yml up --build
```

## 4. Inicializace databáze
```bash
docker-compose exec backend poetry run alembic upgrade head
docker-compose exec backend poetry run python -m scripts.init_db
```

## 5. Vytvoření admin účtu
```bash
docker-compose exec backend poetry run python -m scripts.create_admin
```

## 6. Přístup k aplikaci
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API dokumentace: http://localhost:8000/docs
- MinIO Console: http://localhost:9001
- Grafana: http://localhost:3001

## Lokální vývoj

### Backend
```bash
cd backend
poetry install
poetry run uvicorn src.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Kubernetes Deployment

1. Nastavení Kubernetes clusteru:
```bash
kubectl apply -k k8s/base
```

2. Nastavení monitoringu:
```bash
kubectl apply -f k8s/monitoring
```

3. Kontrola stavu:
```bash
kubectl get pods
kubectl get services
```

## Monitoring a Logging

### Prometheus
- URL: http://localhost:9090
- Metriky: http://localhost:9090/metrics

### Grafana
- URL: http://localhost:3001
- Default login: admin/admin

### Kibana (logy)
- URL: http://localhost:5601

## Troubleshooting

### Reset databáze
```bash
docker-compose down -v
docker-compose up --build
```

### Vyčištění cache
```bash
docker-compose exec frontend npm run clean
docker system prune -a
```

### Kontrola logů
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
```

## Bezpečnostní poznámky
- V produkci změňte všechna výchozí hesla
- Nastavte proper SSL/TLS certifikáty
- Pravidelně aktualizujte závislosti
- Zálohujte databázi a MinIO data

## Užitečné příkazy

### Backend
```bash
# Spuštění testů
docker-compose exec backend poetry run pytest

# Lint
docker-compose exec backend poetry run black src/
docker-compose exec backend poetry run mypy src/

# Migrace databáze
docker-compose exec backend poetry run alembic revision --autogenerate
docker-compose exec backend poetry run alembic upgrade head
```

### Frontend
```bash
# Lint
docker-compose exec frontend npm run lint

# Testy
docker-compose exec frontend npm run test

# Build
docker-compose exec frontend npm run build
```