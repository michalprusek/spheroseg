FROM node:20-alpine

WORKDIR /app

# Nainstalovat základní systémové závislosti
RUN apk add --no-cache openssl

# Kopírovat package.json a package-lock.json
COPY package*.json ./

# Upravíme prepare script, aby přeskočil generování Prisma klienta během instalace
RUN npm pkg delete scripts.prepare

# Nainstalovat dependence
RUN npm install

# Kopírovat prisma schéma a migrační soubory
COPY prisma ./prisma/

# Generovat Prisma klient samostatně
RUN npx prisma generate

# Kopírovat zbytek kódu
COPY . .

# Vystavit port
EXPOSE 8000

# V development módu použijeme ts-node-dev pro hot reload
CMD ["npm", "run", "dev"] 