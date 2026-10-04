const fs = require('fs');
const path = require('path');

const OLD = '<link rel="stylesheet" href="css/styles.css">';
const NEW = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800;900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/styles.css">`;

function walk(dir) {
  let results = [];
  fs.readdirSync(dir).forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (!['node_modules', '.git', '.vercel'].includes(file)) {
        results = results.concat(walk(filePath));
      }
    } else if (file.endsWith('.html')) {
      results.push(filePath);
    }
  });
  return results;
}

const htmlFiles = walk('.');
let fixed = 0, alreadyDone = 0, skipped = 0;

htmlFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('fonts.googleapis.com/css2?family=Montserrat')) {
    alreadyDone++;
    return;
  }
  if (content.includes(OLD)) {
    content = content.replace(OLD, NEW);
    fs.writeFileSync(file, content, 'utf8');
    fixed++;
    console.log('Fixed:', file);
  } else {
    skipped++;
    console.log('No matching stylesheet link, skipped:', file);
  }
});

console.log(`\nDone. Fixed: ${fixed} | Already had the fix: ${alreadyDone} | Skipped: ${skipped}`);