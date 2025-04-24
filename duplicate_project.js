// Skript pro duplikaci projektu
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Konfigurace
const projectId = process.argv[2]; // ID projektu z příkazové řádky
const token = process.argv[3]; // Token z příkazové řádky
const baseUrl = 'http://localhost:3000/api';

if (!projectId || !token) {
  console.error('Použití: node duplicate_project.js <project_id> <token>');
  process.exit(1);
}

// Funkce pro duplikaci projektu
async function duplicateProject() {
  try {
    console.log(`Duplikuji projekt ${projectId}...`);
    
    // 1. Získáme informace o projektu
    const projectResponse = await axios.get(`${baseUrl}/projects/${projectId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const project = projectResponse.data;
    console.log(`Získány informace o projektu: ${project.title}`);
    
    // 2. Vytvoříme nový projekt
    const newTitle = `${project.title} (Copy)`;
    const newProjectResponse = await axios.post(`${baseUrl}/projects`, {
      title: newTitle,
      description: project.description
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const newProject = newProjectResponse.data;
    console.log(`Vytvořen nový projekt: ${newProject.title} (ID: ${newProject.id})`);
    
    // 3. Získáme seznam obrázků z původního projektu
    const imagesResponse = await axios.get(`${baseUrl}/projects/${projectId}/images`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const images = imagesResponse.data;
    console.log(`Nalezeno ${images.length} obrázků v původním projektu`);
    
    // 4. Vytvoříme adresář pro nový projekt, pokud neexistuje
    const uploadsDir = path.join(__dirname, 'public', 'uploads', newProject.id);
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log(`Vytvořen adresář pro nový projekt: ${uploadsDir}`);
    }
    
    // 5. Zkopírujeme obrázky a vytvoříme nové záznamy
    for (const image of images) {
      try {
        // Generujeme unikátní cesty k souborům
        const timestamp = Date.now();
        const randomSuffix = Math.floor(Math.random() * 1000000);
        
        // Získáme původní název souboru z cesty
        const originalFileName = image.storage_path.split('/').pop();
        const fileNameParts = originalFileName?.split('.') || ['image', 'png'];
        const fileExtension = fileNameParts.pop() || 'png';
        const fileBaseName = fileNameParts.join('.');
        
        // Vytvoříme nové cesty k souborům
        const newStoragePath = `/uploads/${newProject.id}/${fileBaseName}-copy-${timestamp}-${randomSuffix}.${fileExtension}`;
        
        // Podobně pro thumbnail
        let newThumbnailPath = null;
        if (image.thumbnail_path) {
          const originalThumbName = image.thumbnail_path.split('/').pop();
          const thumbNameParts = originalThumbName?.split('.') || ['thumb', 'png'];
          const thumbExtension = thumbNameParts.pop() || 'png';
          const thumbBaseName = thumbNameParts.join('.');
          
          newThumbnailPath = `/uploads/${newProject.id}/thumb-${thumbBaseName}-copy-${timestamp}-${randomSuffix}.${thumbExtension}`;
        }
        
        // Zkopírujeme soubory
        if (image.storage_path) {
          const sourcePath = path.join(__dirname, 'public', image.storage_path);
          const targetPath = path.join(__dirname, 'public', newStoragePath);
          
          if (fs.existsSync(sourcePath)) {
            fs.copyFileSync(sourcePath, targetPath);
            console.log(`Zkopírován soubor z ${sourcePath} do ${targetPath}`);
          } else {
            console.warn(`Zdrojový soubor nenalezen: ${sourcePath}`);
          }
        }
        
        // Zkopírujeme miniaturu
        if (image.thumbnail_path && newThumbnailPath) {
          const sourceThumbPath = path.join(__dirname, 'public', image.thumbnail_path);
          const targetThumbPath = path.join(__dirname, 'public', newThumbnailPath);
          
          if (fs.existsSync(sourceThumbPath)) {
            fs.copyFileSync(sourceThumbPath, targetThumbPath);
            console.log(`Zkopírována miniatura z ${sourceThumbPath} do ${targetThumbPath}`);
          } else {
            console.warn(`Zdrojová miniatura nenalezena: ${sourceThumbPath}`);
          }
        }
        
        // Vytvoříme nový záznam o obrázku
        const newImageResponse = await axios.post(`${baseUrl}/projects/${newProject.id}/images`, {
          name: `${image.name} (Copy)`,
          storage_path: newStoragePath,
          thumbnail_path: newThumbnailPath,
          width: image.width,
          height: image.height,
          metadata: image.metadata,
          status: 'pending',
          segmentation_status: 'pending'
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log(`Vytvořen nový záznam o obrázku: ${newImageResponse.data.name}`);
      } catch (imageError) {
        console.error(`Chyba při kopírování obrázku ${image.id}:`, imageError.message);
      }
    }
    
    console.log(`Duplikace projektu dokončena. Nový projekt ID: ${newProject.id}`);
    console.log(`Přejděte na http://localhost:3000/projects/${newProject.id} pro zobrazení nového projektu`);
    
  } catch (error) {
    console.error('Chyba při duplikaci projektu:', error.message);
    if (error.response) {
      console.error('Detaily chyby:', error.response.data);
    }
  }
}

// Spustíme duplikaci projektu
duplicateProject();
