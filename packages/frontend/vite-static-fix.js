/**
 * Plugin pro správné zpracování statických souborů v Docker kontejneru
 */

import fs from 'fs';
import path from 'path';

export default function staticAssetsPlugin() {
  return {
    name: 'static-assets-fix',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Zpracování požadavků na ilustrační obrázky
        if (req.url && req.url.includes('/assets/illustrations/')) {
          const imageName = req.url.split('/').pop();
          const imagePath = path.resolve(process.cwd(), 'public', 'assets', 'illustrations', imageName);

          console.log(`[Static Assets] Requested: ${req.url}`);
          console.log(`[Static Assets] Looking for file at: ${imagePath}`);

          // Kontrola, zda soubor existuje
          if (fs.existsSync(imagePath)) {
            console.log(`[Static Assets] Found file: ${imagePath}`);

            // Určení MIME typu podle přípony souboru
            let contentType = 'application/octet-stream';
            if (imagePath.endsWith('.png')) contentType = 'image/png';
            else if (imagePath.endsWith('.jpg') || imagePath.endsWith('.jpeg')) contentType = 'image/jpeg';
            else if (imagePath.endsWith('.gif')) contentType = 'image/gif';
            else if (imagePath.endsWith('.svg')) contentType = 'image/svg+xml';

            // Načtení souboru
            const fileContent = fs.readFileSync(imagePath);

            // Nastavení správných hlaviček
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'public, max-age=3600');
            res.setHeader('Access-Control-Allow-Origin', '*');

            // Odeslání obsahu souboru
            res.statusCode = 200;
            res.end(fileContent);
            return;
          } else {
            console.log(`[Static Assets] File not found: ${imagePath}`);

            // Try with different casing or without UUID format
            const illustrationsDir = path.resolve(process.cwd(), 'public', 'assets', 'illustrations');
            if (fs.existsSync(illustrationsDir)) {
              const files = fs.readdirSync(illustrationsDir);

              // Try to find a case-insensitive match
              const matchingFile = files.find(file =>
                file.toLowerCase() === imageName.toLowerCase()
              );

              if (matchingFile) {
                console.log(`[Static Assets] Found file with different case: ${matchingFile}`);
                const correctPath = path.resolve(illustrationsDir, matchingFile);

                // Determine content type
                let contentType = 'application/octet-stream';
                if (correctPath.endsWith('.png')) contentType = 'image/png';
                else if (correctPath.endsWith('.jpg') || correctPath.endsWith('.jpeg')) contentType = 'image/jpeg';
                else if (correctPath.endsWith('.gif')) contentType = 'image/gif';
                else if (correctPath.endsWith('.svg')) contentType = 'image/svg+xml';

                // Read and send the file
                const fileContent = fs.readFileSync(correctPath);
                res.setHeader('Content-Type', contentType);
                res.setHeader('Cache-Control', 'public, max-age=3600');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.statusCode = 200;
                res.end(fileContent);
                return;
              }
            }
          }
        }
        return next();
      });
    }
  };
}