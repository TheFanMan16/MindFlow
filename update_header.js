const fs = require('fs');
const content = fs.readFileSync('src/components/FlashcardDashboard.jsx', 'utf8');
const lines = content.split('\n');

// Find the Back button and update text
const backButtonIdx = lines.findIndex((l, i) => i > 740 && l.includes('Back') && !l.includes('Back to'));
if (backButtonIdx !== -1) {
  lines[backButtonIdx] = lines[backButtonIdx].replace('Back', 'Back to Library');
  console.log('Updated Back button text');
}

// Find the h1 title and update it to show folder name
const h1StartIdx = lines.findIndex((l, i) => i > 765 && l.includes('<h1 style={{'));
if (h1StartIdx !== -1) {
  // Find where the h1 content starts (after style closing)
  let h1ContentIdx = h1StartIdx + 1;
  while (h1ContentIdx < lines.length && (lines[h1ContentIdx].includes('fontSize:') || lines[h1ContentIdx].includes('fontWeight:') || lines[h1ContentIdx].includes('color:') || lines[h1ContentIdx].includes('margin:') || lines[h1ContentIdx].includes('fontFamily:') || lines[h1ContentIdx].trim() === '' || lines[h1ContentIdx].includes('}}>'))) {
    h1ContentIdx++;
  }
  
  // Find where h1 closes
  const h1CloseIdx = lines.findIndex((l, i) => i > h1ContentIdx && l.includes('</h1>'));
  
  if (h1CloseIdx !== -1) {
    // Replace the h1 content with conditional rendering
    const newTitleContent = [
      '              {currentFolderId !== null ? (() => {',
      '                const folder = items.find(item => item.type === \'folder\' && item.id === currentFolderId);',
      '                return folder ? (',
      '                  <span style={{ textShadow: \'0 0 8px rgba(0, 255, 148, 0.5)\' }}>{folder.title}</span>',
      '                ) : (',
      '                  <>',
      '                    My <span style={{ textShadow: \'0 0 8px rgba(0, 255, 148, 0.5)\' }}>Library</span>',
      '                  </>',
      '                );',
      '              })() : (',
      '                <>',
      '                  My <span style={{ textShadow: \'0 0 8px rgba(0, 255, 148, 0.5)\' }}>Library</span>',
      '                </>',
      '              )}',
    ];
    
    // Remove old content and insert new
    lines.splice(h1ContentIdx, h1CloseIdx - h1ContentIdx, ...newTitleContent);
    console.log('Updated h1 title to show folder name');
  }
}

// Remove the breadcrumb span if it exists (we don't need it anymore since title shows folder name)
const breadcrumbIdx = lines.findIndex((l, i) => i > 780 && l.includes('/ {folder.title}'));
if (breadcrumbIdx !== -1) {
  // Find the entire breadcrumb block
  let breadcrumbStart = breadcrumbIdx;
  while (breadcrumbStart > 0 && !lines[breadcrumbStart - 1].includes('</h1>')) {
    breadcrumbStart--;
  }
  const breadcrumbEnd = lines.findIndex((l, i) => i > breadcrumbIdx && (l.includes('</span>') || l.includes('})()')));
  if (breadcrumbEnd !== -1) {
    // Check if it's the breadcrumb we want to remove
    const breadcrumbSection = lines.slice(breadcrumbStart, breadcrumbEnd + 1).join('\n');
    if (breadcrumbSection.includes('currentFolderId !== null') && breadcrumbSection.includes('/ {folder.title}')) {
      lines.splice(breadcrumbStart, breadcrumbEnd - breadcrumbStart + 1);
      console.log('Removed breadcrumb span');
    }
  }
}

fs.writeFileSync('src/components/FlashcardDashboard.jsx', lines.join('\n'));
console.log('Done!');

